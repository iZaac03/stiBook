<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Post;
use App\Models\Friend;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PostController extends Controller
{
    public function toggleLike(Request $request, $id)
    {
        $post = Post::findOrFail($id);
        $user = $request->user();

        // check if user already liked the post
        $like = $post->likes()->where('user_id', $user->id)->first();

        if ($like) {
            // 👇 UNLIKE
            $like->delete();
            $liked = false;
        } else {
            // 👇 LIKE
            $post->likes()->create([
                'user_id' => $user->id
            ]);
            $liked = true;
        }

        return response()->json([
            'liked'       => $liked,
            'likes_count' => $post->likes()->count(),
            'post_id'     => $post->post_id,
        ]);
    }

    /**
     * Display all posts with user, comments, likes_count, and liked status.
     */
    public function index(Request $request)
    {
        $userId = $request->user()?->id;

        $posts = Post::with(['user', 'comments.user'])
            ->withCount('likes')
            ->latest()
            ->paginate(10);

        if ($userId) {
            $posts->getCollection()->transform(function ($post) use ($userId) {
                $post->liked = $post->likes()->where('user_id', $userId)->exists();
                return $post;
            });
        }

        return response()->json($posts);
    }

    /**
     * Store a new post.
     */
    public function store(Request $request)
    {
        $request->validate([
            'content'   => 'required|string',
            'image_url' => 'nullable|string',
        ]);

        $imageUrl = $request->image_url;

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $filename = 'post_' . $request->user()->id . '_' . time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('posts', $filename, 'public');
            $imageUrl = $request->schemeAndHttpHost() . '/storage/' . $path;
        } elseif ($request->filled('image') && is_string($request->image)) {
            $rawImage = $request->image;
            if (preg_match('/^data:image\/(\w+);base64,/', $rawImage, $matches)) {
                $ext = strtolower($matches[1]);
                if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                    $ext = 'jpg';
                }
                $base64Data = substr($rawImage, strpos($rawImage, ',') + 1);
                $decoded = base64_decode($base64Data);

                if ($decoded !== false) {
                    $filename = 'post_' . $request->user()->id . '_' . time() . '_' . uniqid() . '.' . $ext;
                    Storage::disk('public')->put('posts/' . $filename, $decoded);
                    $imageUrl = $request->schemeAndHttpHost() . '/storage/posts/' . $filename;
                }
            } elseif (filter_var($rawImage, FILTER_VALIDATE_URL)) {
                $imageUrl = $rawImage;
            }
        }

        $post = Post::create([
            'user_id'   => $request->user()->id,
            'content'   => $request->content,
            'image_url' => $imageUrl,
        ]);

        // Notify friends about the new post
        $friends = Friend::where('user_id', $request->user()->id)->get();
        $preview = Str::limit($post->content, 60, '...');
        foreach ($friends as $friend) {
            Notification::create([
                'user_id'   => $friend->friend_id,
                'sender_id' => $request->user()->id,
                'type'      => 'friend_post',
                'title'     => 'New Post from Friend',
                'message'   => $request->user()->name . ' posted: "' . $preview . '"',
                'target_id' => $post->post_id,
            ]);
        }

        return response()->json([
            'message' => 'Post created successfully',
            'post'    => $post->load('user'),
        ], 201);
    }

    /**
     * Display a single post.
     */
    public function show(string $id)
    {
        $post = Post::with(['user', 'comments.user'])->findOrFail($id);

        return response()->json($post);
    }

    /**
     * Update a post. Owner or admin only.
     */
    public function update(Request $request, string $id)
    {
        $post = Post::findOrFail($id);
        $authUser = $request->user();

        if ($authUser->id !== $post->user_id && $authUser->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'content'   => 'sometimes|required|string',
            'image_url' => 'nullable|string',
        ]);

        if ($request->has('content')) {
            $post->content = $request->content;
        }

        if ($request->boolean('remove_image')) {
            $post->image_url = null;
        } elseif ($request->hasFile('image')) {
            $file = $request->file('image');
            $filename = 'post_' . $authUser->id . '_' . time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('posts', $filename, 'public');
            $post->image_url = $request->schemeAndHttpHost() . '/storage/' . $path;
        } elseif ($request->filled('image') && is_string($request->image)) {
            $rawImage = $request->image;
            if (preg_match('/^data:image\/(\w+);base64,/', $rawImage, $matches)) {
                $ext = strtolower($matches[1]);
                if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                    $ext = 'jpg';
                }
                $base64Data = substr($rawImage, strpos($rawImage, ',') + 1);
                $decoded = base64_decode($base64Data);

                if ($decoded !== false) {
                    $filename = 'post_' . $authUser->id . '_' . time() . '_' . uniqid() . '.' . $ext;
                    Storage::disk('public')->put('posts/' . $filename, $decoded);
                    $post->image_url = $request->schemeAndHttpHost() . '/storage/posts/' . $filename;
                }
            } elseif (filter_var($rawImage, FILTER_VALIDATE_URL)) {
                $post->image_url = $rawImage;
            }
        } elseif ($request->has('image_url')) {
            $post->image_url = $request->image_url ?: null;
        }

        $post->save();

        // Log if admin is editing someone else's post
        if ($authUser->role === 'admin' && $authUser->id !== $post->user_id) {
            AdminLog::create([
                'admin_id'     => $authUser->id,
                'action'       => 'update_post',
                'target_table' => 'posts',
                'target_id'    => $post->post_id,
                'details'      => 'Admin edited post ID ' . $post->post_id,
            ]);
        }

        $post->load(['user', 'comments.user']);
        $post->likes_count = $post->likes()->count();
        $post->liked = $post->likes()->where('user_id', $authUser->id)->exists();

        return response()->json([
            'message' => 'Post updated successfully',
            'post'    => $post,
        ]);
    }

    /**
     * Delete a post. Owner or admin only.
     */
    public function destroy(Request $request, string $id)
    {
        $post = Post::findOrFail($id);
        $authUser = $request->user();

        if ($authUser->id !== $post->user_id && $authUser->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Log if admin is deleting someone else's post
        if ($authUser->role === 'admin' && $authUser->id !== $post->user_id) {
            AdminLog::create([
                'admin_id'     => $authUser->id,
                'action'       => 'delete_post',
                'target_table' => 'posts',
                'target_id'    => $post->post_id,
                'details'      => 'Admin deleted post ID ' . $post->post_id,
            ]);
        }

        $post->delete();

        return response()->json(['message' => 'Post deleted successfully']);
    }
}