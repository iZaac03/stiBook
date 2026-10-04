<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Post;
use App\Models\Comment;
use App\Models\AdminLog;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Create or update Default Admin
        $admin = User::updateOrCreate(
            ['email' => 'admin@stibook.com'],
            [
                'name'              => 'System Admin',
                'username'          => 'admin',
                'password'          => Hash::make('admin123'),
                'role'              => 'admin',
                'is_active'         => true,
                'bio'               => 'Official STIBook System Administrator',
                'email_verified_at' => now(),
            ]
        );

        // 2. Create or update Default Student / User
        $student = User::updateOrCreate(
            ['email' => 'student@stibook.com'],
            [
                'name'              => 'Juan Dela Cruz',
                'username'          => 'juandelacruz',
                'password'          => Hash::make('student123'),
                'role'              => 'user',
                'is_active'         => true,
                'bio'               => 'STI College BSIT Student 🎓',
                'email_verified_at' => now(),
            ]
        );

        // 3. Seed an initial welcome post if no posts exist
        if (Post::count() === 0) {
            $welcomePost = Post::create([
                'user_id'   => $admin->id,
                'content'   => 'Welcome to STIBook! 🚀 Connect, share updates, and collaborate with your fellow STIers.',
                'image_url' => 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800',
            ]);

            Comment::create([
                'post_id'      => $welcomePost->post_id,
                'user_id'      => $student->id,
                'comment_text' => 'Glad to be here! Mabuhay STI! 🎉',
            ]);
        }

        // 4. Initial admin log entry
        AdminLog::create([
            'admin_id'     => $admin->id,
            'action'       => 'system_seed',
            'target_table' => 'users',
            'target_id'    => $admin->id,
            'details'      => 'Database seeded with default Admin and Student accounts.',
        ]);

        $this->command->info("Admin account seeded: admin@stibook.com / admin123");
        $this->command->info("Student account seeded: student@stibook.com / student123");
    }
}