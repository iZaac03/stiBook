<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Friend;
use App\Models\FriendRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Update the authenticated user's profile details.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'     => 'sometimes|required|string|max:255',
            'username' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('users')->ignore($user->id),
            ],
            'bio'      => 'nullable|string|max:500',
            'status'   => 'nullable|string|max:255',
        ]);

        $user->update($validated);

        return response()->json([
            'message' => 'Profile updated successfully',
            'user'    => $user->fresh(),
        ]);
    }

    /**
     * Search or list active users with friendship status relative to the authenticated user.
     */
    public function index(Request $request)
    {
        $viewerId = $request->user()->id;
        $search   = trim((string) $request->query('search', ''));

        $query = User::where('id', '!=', $viewerId)
            ->where('is_active', true);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $users = $query->latest()->limit(30)->get(['id', 'name', 'username', 'profile_picture', 'bio', 'status']);

        $myFriendIds = Friend::where('user_id', $viewerId)->pluck('friend_id')->toArray();
        $sentRequestIds = FriendRequest::where('sender_id', $viewerId)
            ->where('status', 'pending')
            ->pluck('receiver_id')
            ->toArray();
        $receivedRequestIds = FriendRequest::where('receiver_id', $viewerId)
            ->where('status', 'pending')
            ->pluck('sender_id')
            ->toArray();

        $users->transform(function ($u) use ($myFriendIds, $sentRequestIds, $receivedRequestIds) {
            if (in_array($u->id, $myFriendIds)) {
                $u->friend_status = 'friends';
            } elseif (in_array($u->id, $sentRequestIds)) {
                $u->friend_status = 'request_sent';
            } elseif (in_array($u->id, $receivedRequestIds)) {
                $u->friend_status = 'request_received';
            } else {
                $u->friend_status = 'none';
            }
            return $u;
        });

        return response()->json($users);
    }

    /**
     * Upload and update user's profile picture.
     * Supports multipart file upload, base64 image strings, and data URLs.
     */
    public function uploadProfilePicture(Request $request)
    {
        $user = $request->user();

        // 1. Multipart file upload
        if ($request->hasFile('profile_picture')) {
            $request->validate([
                'profile_picture' => 'required|image|mimes:jpeg,png,jpg,webp,gif|max:10240',
            ]);
            $file = $request->file('profile_picture');
            $ext = $file->getClientOriginalExtension() ?: 'jpg';
            $filename = 'avatar_' . $user->id . '_' . time() . '_' . uniqid() . '.' . $ext;
            $path = $file->storeAs('profile_pictures', $filename, 'public');

            $url = $request->schemeAndHttpHost() . '/storage/' . $path;
            $user->update(['profile_picture' => $url]);

            return response()->json([
                'message'         => 'Profile picture uploaded successfully',
                'profile_picture' => $url,
                'user'            => $user->fresh(),
            ]);
        }

        // 2. Base64 data URL or raw base64 string
        $rawImage = $request->input('profile_picture');
        if ($rawImage && is_string($rawImage)) {
            if (preg_match('/^data:image\/(\w+);base64,/', $rawImage, $matches)) {
                $ext = strtolower($matches[1]);
                if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                    $ext = 'jpg';
                }
                $base64Data = substr($rawImage, strpos($rawImage, ',') + 1);
                $decoded = base64_decode($base64Data);

                if ($decoded !== false) {
                    $filename = 'avatar_' . $user->id . '_' . time() . '_' . uniqid() . '.' . $ext;
                    Storage::disk('public')->put('profile_pictures/' . $filename, $decoded);
                    $url = $request->schemeAndHttpHost() . '/storage/profile_pictures/' . $filename;
                    $user->update(['profile_picture' => $url]);

                    return response()->json([
                        'message'         => 'Profile picture uploaded successfully',
                        'profile_picture' => $url,
                        'user'            => $user->fresh(),
                    ]);
                }
            } elseif (filter_var($rawImage, FILTER_VALIDATE_URL)) {
                $user->update(['profile_picture' => $rawImage]);
                return response()->json([
                    'message'         => 'Profile picture updated successfully',
                    'profile_picture' => $rawImage,
                    'user'            => $user->fresh(),
                ]);
            }
        }

        return response()->json(['message' => 'Please provide a valid image file or photo.'], 422);
    }

    /**
     * View any user's profile and their posts.
     */
    public function show(Request $request, $id)
    {
        $viewerId = $request->user()->id;

        $user = \App\Models\User::withCount(['posts', 'comments'])->findOrFail($id);

        $posts = $user->posts()
            ->with(['user:id,name,username,profile_picture', 'comments.user:id,name,username,profile_picture'])
            ->withCount('likes')
            ->latest()
            ->get();

        $posts->transform(function ($post) use ($viewerId) {
            $post->liked = $post->likes()->where('user_id', $viewerId)->exists();
            return $post;
        });

        // Friend status with viewer
        $isFriend = \App\Models\Friend::where('user_id', $viewerId)
            ->where('friend_id', $id)
            ->exists();

        $pendingRequest = \App\Models\FriendRequest::where(function ($q) use ($viewerId, $id) {
                $q->where('sender_id', $viewerId)->where('receiver_id', $id);
            })
            ->orWhere(function ($q) use ($viewerId, $id) {
                $q->where('sender_id', $id)->where('receiver_id', $viewerId);
            })
            ->where('status', 'pending')
            ->first();

        $friendStatus = 'none';
        if ($isFriend) {
            $friendStatus = 'friends';
        } elseif ($pendingRequest) {
            $friendStatus = $pendingRequest->sender_id === $viewerId ? 'request_sent' : 'request_received';
        }

        return response()->json([
            'user' => [
                'id'              => $user->id,
                'name'            => $user->name,
                'username'        => $user->username,
                'email'           => $user->email,
                'role'            => $user->role,
                'is_active'       => $user->is_active,
                'profile_picture' => $user->profile_picture,
                'bio'             => $user->bio,
                'status'          => $user->status,
                'created_at'      => $user->created_at,
                'posts_count'     => $user->posts_count,
            ],
            'posts'             => $posts,
            'friend_status'     => $friendStatus,
            'friend_request_id' => $pendingRequest?->request_id,
            'is_self'           => $viewerId === (int)$id,
        ]);
    }
}
