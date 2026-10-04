<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\PostController;
use App\Http\Controllers\API\CommentController;
use App\Http\Controllers\API\UserController;
use App\Http\Controllers\API\AdminController;
use App\Http\Controllers\API\FriendRequestController;
use App\Http\Controllers\API\MessageController;
use App\Http\Controllers\API\NotificationController;

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
*/

Route::get('/test', fn() => response()->json(['message' => 'Laravel API connected!']));

Route::post('/register',        [AuthController::class, 'register']);
Route::post('/login',           [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password',  [AuthController::class, 'resetPassword']);

/*
|--------------------------------------------------------------------------
| AUTHENTICATED ROUTES
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    // Current user
    Route::get('/user',    fn(Request $r) => $r->user());
    Route::post('/logout', [AuthController::class, 'logout']);

    // Profile & Users
    Route::get ('users',                 [UserController::class, 'index']);
    Route::get ('users/{id}',            [UserController::class, 'show']);
    Route::put ('/user/profile',          [UserController::class, 'updateProfile']);
    Route::post('/user/profile-picture', [UserController::class, 'uploadProfilePicture']);

    // Posts — full CRUD
    Route::get   ('posts',             [PostController::class, 'index']);
    Route::post  ('posts',             [PostController::class, 'store']);
    Route::get   ('posts/{post}',      [PostController::class, 'show']);
    Route::put   ('posts/{post}',      [PostController::class, 'update']);
    Route::delete('posts/{post}',      [PostController::class, 'destroy']);
    Route::post  ('posts/{post}/like', [PostController::class, 'toggleLike']);

    // Comments — Create, Read, Update (owner), Delete (owner)
    Route::get   ('posts/{postId}/comments', [CommentController::class, 'index']);
    Route::post  ('posts/{postId}/comments', [CommentController::class, 'store']);
    Route::put   ('comments/{id}',           [CommentController::class, 'update']);
    Route::delete('comments/{id}',           [CommentController::class, 'destroy']);

    // Friends & Friend Requests
    Route::get   ('friend-requests',             [FriendRequestController::class, 'index']);
    Route::post  ('friend-requests',             [FriendRequestController::class, 'send']);
    Route::put   ('friend-requests/{id}/accept', [FriendRequestController::class, 'accept']);
    Route::put   ('friend-requests/{id}/reject', [FriendRequestController::class, 'reject']);
    Route::get   ('friends',                     [FriendRequestController::class, 'friends']);
    Route::delete('friends/{friendId}',          [FriendRequestController::class, 'unfriend']);

    // Direct Messages & Conversations
    Route::get ('conversations',       [MessageController::class, 'conversations']);
    Route::get ('messages/{userId}',   [MessageController::class, 'index']);
    Route::post('messages/{userId}',   [MessageController::class, 'store']);

    // Notifications
    Route::get   ('notifications',              [NotificationController::class, 'index']);
    Route::get   ('notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put   ('notifications/mark-all-read',[NotificationController::class, 'markAllAsRead']);
    Route::put   ('notifications/{id}/read',    [NotificationController::class, 'markAsRead']);
    Route::delete('notifications/{id}',         [NotificationController::class, 'destroy']);
    Route::delete('notifications',              [NotificationController::class, 'clearAll']);

    /*
    |--------------------------------------------------------------------------
    | ADMIN ROUTES
    |--------------------------------------------------------------------------
    */
    Route::middleware('can:isAdmin')->prefix('admin')->group(function () {
        Route::get   ('stats',               [AdminController::class, 'stats']);
        Route::get   ('users',               [AdminController::class, 'listUsers']);
        Route::get   ('users/{id}',          [AdminController::class, 'showUser']);
        Route::put   ('users/{id}/ban',      [AdminController::class, 'banUser']);
        Route::put   ('users/{id}/activate', [AdminController::class, 'activateUser']);
        Route::delete('posts/{id}',          [AdminController::class, 'deletePost']);
        Route::get   ('logs',                [AdminController::class, 'logs']);
    });
});