<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Friend;
use App\Models\FriendRequest;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Http\Request;

class FriendRequestController extends Controller
{
    /**
     * List all pending friend requests received by the authenticated user.
     */
    public function index(Request $request)
    {
        $requests = FriendRequest::with('sender')
            ->where('receiver_id', $request->user()->id)
            ->where('status', 'pending')
            ->latest()
            ->get();

        return response()->json($requests);
    }

    /**
     * Send a friend request.
     */
    public function send(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
        ]);

        $authUser = $request->user();
        $receiverId = $request->receiver_id;

        if ($authUser->id === (int) $receiverId) {
            return response()->json(['message' => 'You cannot send a friend request to yourself'], 422);
        }

        // Check if already friends
        $alreadyFriends = Friend::where('user_id', $authUser->id)
            ->where('friend_id', $receiverId)
            ->exists();

        if ($alreadyFriends) {
            return response()->json(['message' => 'You are already friends'], 422);
        }

        // Check if request already exists
        $existing = FriendRequest::where('sender_id', $authUser->id)
            ->where('receiver_id', $receiverId)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Friend request already sent'], 422);
        }

        $friendRequest = FriendRequest::create([
            'sender_id'   => $authUser->id,
            'receiver_id' => $receiverId,
            'status'      => 'pending',
        ]);

        Notification::create([
            'user_id'   => $receiverId,
            'sender_id' => $authUser->id,
            'type'      => 'friend_request',
            'title'     => 'Friend Request',
            'message'   => $authUser->name . ' sent you a friend request.',
            'target_id' => $authUser->id,
        ]);

        return response()->json([
            'message'        => 'Friend request sent successfully',
            'friend_request' => $friendRequest,
        ], 201);
    }

    /**
     * Accept a friend request.
     */
    public function accept(Request $request, string $id)
    {
        $friendRequest = FriendRequest::findOrFail($id);
        $authUser = $request->user();

        if ($friendRequest->receiver_id !== $authUser->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($friendRequest->status !== 'pending') {
            return response()->json(['message' => 'Friend request is no longer pending'], 422);
        }

        $friendRequest->update(['status' => 'accepted']);

        // Create bidirectional friendship
        Friend::firstOrCreate([
            'user_id'   => $friendRequest->sender_id,
            'friend_id' => $friendRequest->receiver_id,
        ]);
        Friend::firstOrCreate([
            'user_id'   => $friendRequest->receiver_id,
            'friend_id' => $friendRequest->sender_id,
        ]);

        Notification::create([
            'user_id'   => $friendRequest->sender_id,
            'sender_id' => $authUser->id,
            'type'      => 'friend_accepted',
            'title'     => 'Friend Request Accepted',
            'message'   => $authUser->name . ' accepted your friend request. You are now friends!',
            'target_id' => $authUser->id,
        ]);

        return response()->json(['message' => 'Friend request accepted']);
    }

    /**
     * Reject a friend request.
     */
    public function reject(Request $request, string $id)
    {
        $friendRequest = FriendRequest::findOrFail($id);
        $authUser = $request->user();

        if ($friendRequest->receiver_id !== $authUser->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($friendRequest->status !== 'pending') {
            return response()->json(['message' => 'Friend request is no longer pending'], 422);
        }

        $friendRequest->update(['status' => 'rejected']);

        return response()->json(['message' => 'Friend request rejected']);
    }

    /**
     * List all friends of the authenticated user.
     */
    public function friends(Request $request)
    {
        $friends = Friend::with('friend:id,name,username,profile_picture')
            ->where('user_id', $request->user()->id)
            ->get()
            ->pluck('friend');

        return response()->json($friends);
    }

    /**
     * Remove a friendship both ways.
     */
    public function unfriend(Request $request, string $friendId)
    {
        $me = $request->user()->id;

        Friend::where(function ($q) use ($me, $friendId) {
            $q->where('user_id', $me)->where('friend_id', $friendId);
        })->orWhere(function ($q) use ($me, $friendId) {
            $q->where('user_id', $friendId)->where('friend_id', $me);
        })->delete();

        FriendRequest::where(function ($q) use ($me, $friendId) {
            $q->where('sender_id', $me)->where('receiver_id', $friendId);
        })->orWhere(function ($q) use ($me, $friendId) {
            $q->where('sender_id', $friendId)->where('receiver_id', $me);
        })->delete();

        return response()->json(['message' => 'Unfriended successfully']);
    }
}