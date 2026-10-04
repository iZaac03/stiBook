<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    /**
     * Get all messages between authenticated user and another user.
     */
    public function index(Request $request, $userId)
    {
        $myId = $request->user()->id;
        $targetId = (int) $userId;

        // Mark incoming messages as read
        Message::where('sender_id', $targetId)
            ->where('receiver_id', $myId)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        $messages = Message::with('sender:id,name,username,profile_picture')
            ->where(function ($q) use ($myId, $targetId) {
                $q->where('sender_id', $myId)->where('receiver_id', $targetId);
            })
            ->orWhere(function ($q) use ($myId, $targetId) {
                $q->where('sender_id', $targetId)->where('receiver_id', $myId);
            })
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($messages);
    }

    /**
     * Send a message to another user.
     */
    public function store(Request $request, $userId)
    {
        $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        $myId = $request->user()->id;
        $targetId = (int) $userId;

        if ($myId === $targetId) {
            return response()->json(['message' => 'Cannot message yourself'], 422);
        }

        $receiver = User::findOrFail($targetId);

        $message = Message::create([
            'sender_id'   => $myId,
            'receiver_id' => $targetId,
            'body'        => $request->body,
            'is_read'     => false,
        ]);

        return response()->json([
            'message' => $message->load('sender:id,name,username,profile_picture'),
        ], 201);
    }

    /**
     * List all conversations with latest message and unread count.
     */
    public function conversations(Request $request)
    {
        $myId = $request->user()->id;

        // Find all partner user IDs from sent and received messages
        $sentPartners = Message::where('sender_id', $myId)->pluck('receiver_id');
        $receivedPartners = Message::where('receiver_id', $myId)->pluck('sender_id');
        $partnerIds = $sentPartners->merge($receivedPartners)->unique()->values();

        $conversations = [];

        foreach ($partnerIds as $partnerId) {
            $user = User::select('id', 'name', 'username', 'profile_picture', 'status')->find($partnerId);
            if (!$user) continue;

            $lastMessage = Message::where(function ($q) use ($myId, $partnerId) {
                    $q->where('sender_id', $myId)->where('receiver_id', $partnerId);
                })
                ->orWhere(function ($q) use ($myId, $partnerId) {
                    $q->where('sender_id', $partnerId)->where('receiver_id', $myId);
                })
                ->latest()
                ->first();

            $unreadCount = Message::where('sender_id', $partnerId)
                ->where('receiver_id', $myId)
                ->where('is_read', false)
                ->count();

            $conversations[] = [
                'other_user'   => $user,
                'last_message' => $lastMessage ? [
                    'id'         => $lastMessage->id,
                    'body'       => $lastMessage->body,
                    'sender_id'  => $lastMessage->sender_id,
                    'created_at' => $lastMessage->created_at,
                ] : null,
                'unread_count' => $unreadCount,
                'updated_at'   => $lastMessage ? $lastMessage->created_at : $user->created_at,
            ];
        }

        // Sort conversations by updated_at descending
        usort($conversations, function ($a, $b) {
            return strtotime($b['updated_at']) <=> strtotime($a['updated_at']);
        });

        return response()->json($conversations);
    }
}
