<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use App\Models\AdminLog;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    /**
     * GET /api/posts/{postId}/comments
     */
    public function index($postId)
    {
        $post     = Post::findOrFail($postId);
        $comments = $post->comments()
            ->with('user:id,name,username,profile_picture')
            ->latest()
            ->get();

        return response()->json($comments);
    }

    /**
     * POST /api/posts/{postId}/comments
     */
    public function store(Request $request, $postId)
    {
        Post::findOrFail($postId);

        $text = $request->input('comment_text') ?? $request->input('content');
        if (empty($text) || !is_string($text)) {
            return response()->json(['message' => 'The comment_text field is required.'], 422);
        }

        $comment = Comment::create([
            'post_id'      => $postId,
            'user_id'      => $request->user()->id,
            'comment_text' => trim($text),
        ]);

        return response()->json([
            'message' => 'Comment added',
            'comment' => $comment->load('user:id,name,username,profile_picture'),
        ], 201);
    }

    /**
     * PUT /api/comments/{id}
     * Only the comment owner or admin can edit.
     */
    public function update(Request $request, $id)
    {
        $comment = Comment::findOrFail($id);

        if ($request->user()->id !== $comment->user_id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $text = $request->input('comment_text') ?? $request->input('content');
        if (empty($text) || !is_string($text)) {
            return response()->json(['message' => 'The comment_text field is required.'], 422);
        }

        $comment->update(['comment_text' => trim($text)]);

        return response()->json([
            'message' => 'Comment updated',
            'comment' => $comment->fresh()->load('user:id,name,username,profile_picture'),
        ]);
    }

    /**
     * DELETE /api/comments/{id}
     * Owner or admin can delete.
     */
    public function destroy(Request $request, $id)
    {
        $comment  = Comment::findOrFail($id);
        $authUser = $request->user();

        if ($authUser->id !== $comment->user_id && $authUser->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($authUser->role === 'admin' && $authUser->id !== $comment->user_id) {
            AdminLog::create([
                'admin_id'     => $authUser->id,
                'action'       => 'delete_comment',
                'target_table' => 'comments',
                'target_id'    => $comment->comment_id,
                'details'      => 'Admin deleted comment ID ' . $comment->comment_id,
            ]);
        }

        $comment->delete();

        return response()->json(['message' => 'Comment deleted']);
    }
}