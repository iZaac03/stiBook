<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    /**
     * Get dashboard summary statistics.
     */
    public function stats()
    {
        $totalUsers   = User::count();
        $activeUsers  = User::where('is_active', true)->count();
        $bannedUsers  = User::where('is_active', false)->count();
        $totalPosts   = Post::count();
        $totalAdmins  = User::where('role', 'admin')->count();

        return response()->json([
            'total_users'  => $totalUsers,
            'active_users' => $activeUsers,
            'banned_users' => $bannedUsers,
            'total_posts'  => $totalPosts,
            'total_admins' => $totalAdmins,
        ]);
    }

    /**
     * List all users with optional search and pagination.
     */
    public function listUsers(Request $request)
    {
        $query = User::query();

        $search = $request->query('search', $request->query('q'));
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->latest()->paginate(20);

        return response()->json($users);
    }

    /**
     * Show a single user details.
     */
    public function showUser($id)
    {
        $user = User::withCount(['posts', 'comments'])->findOrFail($id);

        return response()->json($user);
    }

    /**
     * Ban a user account.
     */
    public function banUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($user->role === 'admin') {
            return response()->json(['message' => 'Admin accounts cannot be banned.'], 403);
        }

        $user->is_active = false;
        $user->save();

        AdminLog::create([
            'admin_id'     => $request->user()->id,
            'action'       => 'ban_user',
            'target_table' => 'users',
            'target_id'    => $user->id,
            'details'      => 'Admin banned user ' . $user->name . ' (@' . $user->username . ')',
        ]);

        return response()->json([
            'message' => 'User banned successfully',
            'user'    => $user,
        ]);
    }

    /**
     * Reactivate a banned user account.
     */
    public function activateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $user->is_active = true;
        $user->save();

        AdminLog::create([
            'admin_id'     => $request->user()->id,
            'action'       => 'activate_user',
            'target_table' => 'users',
            'target_id'    => $user->id,
            'details'      => 'Admin activated user ' . $user->name . ' (@' . $user->username . ')',
        ]);

        return response()->json([
            'message' => 'User activated successfully',
            'user'    => $user,
        ]);
    }

    /**
     * Admin delete any post.
     */
    public function deletePost(Request $request, $id)
    {
        $post = Post::findOrFail($id);

        AdminLog::create([
            'admin_id'     => $request->user()->id,
            'action'       => 'delete_post',
            'target_table' => 'posts',
            'target_id'    => $post->post_id,
            'details'      => 'Admin deleted post #' . $post->post_id,
        ]);

        $post->delete();

        return response()->json(['message' => 'Post deleted successfully']);
    }

    /**
     * View admin audit logs.
     */
    public function logs(Request $request)
    {
        $logs = AdminLog::with('admin:id,name,username,profile_picture')
            ->latest('created_at')
            ->paginate(20);

        return response()->json($logs);
    }
}