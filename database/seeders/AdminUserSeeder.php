<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // Kelvin Silas — admin (the client)
        User::firstOrCreate(
            ['email' => 'kelvin@myextremetrainer.com'],
            [
                'name'                     => 'Kelvin Silas',
                // Public profiles are addressed by username (/social/{username}).
                // Without one these links render as /social/null and land on
                // "User not found" - which included the client's own account.
                'username'                 => 'kelvinsilas',
                'password'                 => Hash::make('password123'),
                // Seeded accounts are verified. Without this a fresh seed produces
                // accounts that cannot use the app at all: EnsureEmailIsVerified
                // refuses every request with 403 "Please verify your email address",
                // so the dashboard, membership and everything else fail to load.
                'email_verified_at'        => now(),
                'is_admin'                 => true,
                'gender'                   => 'male',
                'date_of_birth'            => '1985-03-15',
                'height_cm'                => 182,
                'current_weight_kg'        => 88,
                'goal_weight_kg'           => 85,
                'activity_level'           => 'very_active',
                'primary_goal'             => 'gain_muscle',
                'daily_calorie_goal'       => 3000,
                'daily_protein_goal_g'     => 220,
                'daily_carbs_goal_g'       => 300,
                'daily_fat_goal_g'         => 90,
                'daily_water_goal_glasses' => 10,
                'trial_starts_at'          => now()->subYears(1),
                'trial_ends_at'            => now()->addYears(10),
                'subscription_status'      => 'active',
                'onboarding_completed'     => true,
                'bio'                      => 'Founder of Team Extreme. Certified fitness coach with 15+ years experience.',
            ]
        );

        // Test member account
        User::firstOrCreate(
            ['email' => 'member@myextremetrainer.com'],
            [
                'name'                     => 'Alex Rivera',
                // Public profiles are addressed by username (/social/{username}).
                // Without one these links render as /social/null and land on
                // "User not found" - which included the client's own account.
                'username'                 => 'alexrivera',
                'password'                 => Hash::make('password123'),
                // Seeded accounts are verified. Without this a fresh seed produces
                // accounts that cannot use the app at all: EnsureEmailIsVerified
                // refuses every request with 403 "Please verify your email address",
                // so the dashboard, membership and everything else fail to load.
                'email_verified_at'        => now(),
                'is_admin'                 => false,
                'gender'                   => 'male',
                'date_of_birth'            => '1995-07-22',
                'height_cm'                => 175,
                'current_weight_kg'        => 80,
                'goal_weight_kg'           => 72,
                'activity_level'           => 'moderately_active',
                'primary_goal'             => 'lose_weight',
                'daily_calorie_goal'       => 1900,
                'daily_protein_goal_g'     => 143,
                'daily_carbs_goal_g'       => 190,
                'daily_fat_goal_g'         => 63,
                'daily_water_goal_glasses' => 8,
                'trial_starts_at'          => now()->subDays(5),
                'trial_ends_at'            => now()->addDays(25),
                'subscription_status'      => 'trial',
                'onboarding_completed'     => true,
            ]
        );

        $this->command->info('Admin: kelvin@myextremetrainer.com / password123');
        $this->command->info('Member: member@myextremetrainer.com / password123');
    }
}
