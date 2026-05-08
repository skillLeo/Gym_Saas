<?php
namespace Database\Seeders;
use App\Models\FoodItem;
use App\Models\FoodLogEntry;
use App\Models\User;
use App\Models\WaterLog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'test@myextremetrainer.com'],
            [
                'name'                    => 'Test User',
                'password'                => Hash::make('password123'),
                'gender'                  => 'male',
                'date_of_birth'           => '1990-01-15',
                'height_cm'               => 178,
                'current_weight_kg'       => 85,
                'goal_weight_kg'          => 75,
                'activity_level'          => 'moderately_active',
                'primary_goal'            => 'lose_weight',
                'daily_calorie_goal'      => 2100,
                'daily_protein_goal_g'    => 158,
                'daily_carbs_goal_g'      => 210,
                'daily_fat_goal_g'        => 70,
                'daily_water_goal_glasses'=> 8,
                'trial_starts_at'         => now()->subDays(10),
                'trial_ends_at'           => now()->addDays(20),
                'subscription_status'     => 'trial',
                'onboarding_completed'    => true,
            ]
        );

        $foods = FoodItem::take(5)->get();
        if ($foods->isEmpty()) return;

        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();

            foreach (['breakfast', 'lunch', 'dinner'] as $meal) {
                $food    = $foods->random();
                $servings = round(rand(1, 3) * 0.5, 1);
                FoodLogEntry::firstOrCreate(
                    ['user_id' => $user->id, 'food_item_id' => $food->id, 'meal_type' => $meal, 'logged_date' => $date],
                    [
                        'servings'        => $servings,
                        'total_calories'  => round($food->calories * $servings, 2),
                        'total_protein_g' => round($food->protein_g * $servings, 2),
                        'total_carbs_g'   => round($food->carbs_g * $servings, 2),
                        'total_fat_g'     => round($food->fat_g * $servings, 2),
                    ]
                );
            }

            WaterLog::firstOrCreate(
                ['user_id' => $user->id, 'logged_date' => $date],
                ['glasses_count' => rand(4, 10)]
            );
        }

        $this->command->info('Test user created: test@myextremetrainer.com / password123');
    }
}
