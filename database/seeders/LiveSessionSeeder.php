<?php
namespace Database\Seeders;

use App\Models\LiveSession;
use Illuminate\Database\Seeder;

class LiveSessionSeeder extends Seeder
{
    public function run(): void
    {
        // One live session right now
        LiveSession::create([
            'title'           => 'Morning HIIT Burn — Live Now',
            'description'     => 'Join Coach Kelvin for a high-intensity interval training session to kickstart your day!',
            'instructor_name' => 'Coach Kelvin',
            'thumbnail_url'   => 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
            'stream_url'      => 'https://www.youtube.com/embed/ml6cT4AZdqI',
            'status'          => 'live',
            'scheduled_at'    => now(),
            'viewers_count'   => 0,
            'likes_count'     => 0,
            'category'        => 'HIIT',
            'difficulty'      => 'Intermediate',
        ]);

        // Upcoming session
        LiveSession::create([
            'title'           => 'Evening Yoga & Stretch',
            'description'     => 'Wind down with Sarah Chen in this relaxing yoga and stretching session.',
            'instructor_name' => 'Sarah Chen',
            'thumbnail_url'   => 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
            'stream_url'      => null,
            'status'          => 'scheduled',
            'scheduled_at'    => now()->addHours(4),
            'viewers_count'   => 0,
            'likes_count'     => 0,
            'category'        => 'Yoga',
            'difficulty'      => 'Beginner',
        ]);

        // Replays
        $replays = [
            [
                'title'           => 'Full Body Strength — Sunday Session',
                'description'     => 'Missed Sunday\'s live? Catch up with this comprehensive full-body strength workout.',
                'instructor_name' => 'Marcus Bell',
                'thumbnail_url'   => 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=640&q=80',
                'status'          => 'ended',
                'viewers_count'   => 0,
                'likes_count'     => 0,
                'duration_minutes'=> 45,
                'category'        => 'Strength',
                'difficulty'      => 'Advanced',
            ],
            [
                'title'           => 'Cardio Dance Party',
                'description'     => 'Fun cardio workout combining dance moves with HIIT bursts.',
                'instructor_name' => 'Coach Kelvin',
                'thumbnail_url'   => 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=640&q=80',
                'status'          => 'ended',
                'viewers_count'   => 0,
                'likes_count'     => 0,
                'duration_minutes'=> 30,
                'category'        => 'Cardio',
                'difficulty'      => 'Beginner',
            ],
            [
                'title'           => 'Core & Stability Deep Dive',
                'description'     => 'Build a bulletproof core with Coach Sarah. Focus on deep core engagement.',
                'instructor_name' => 'Sarah Chen',
                'thumbnail_url'   => 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=640&q=80',
                'status'          => 'ended',
                'viewers_count'   => 0,
                'likes_count'     => 0,
                'duration_minutes'=> 25,
                'category'        => 'Core',
                'difficulty'      => 'Intermediate',
            ],
            [
                'title'           => 'Leg Day with Marcus',
                'description'     => 'Heavy leg day session. Squats, deadlifts, lunges, and calf raises.',
                'instructor_name' => 'Marcus Bell',
                'thumbnail_url'   => 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=640&q=80',
                'status'          => 'ended',
                'viewers_count'   => 0,
                'likes_count'     => 0,
                'duration_minutes'=> 60,
                'category'        => 'Strength',
                'difficulty'      => 'Advanced',
            ],
        ];

        foreach ($replays as $r) {
            LiveSession::create($r);
        }

        $this->command->info('6 live sessions seeded.');
    }
}
