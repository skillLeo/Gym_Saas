<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FoodLogEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AchievementController extends Controller
{
    /**
     * Compute achievements dynamically from the user's real activity data.
     */
    public function index(Request $request)
    {
        $user   = $request->user();
        $userId = $user->id;

        // gather stats
        $totalFoodLogs  = FoodLogEntry::where('user_id', $userId)->count();
        $totalWorkouts  = DB::table('fitness_logs')->where('user_id', $userId)->count();
        $uniqueWorkoutDays = DB::table('fitness_logs')
            ->where('user_id', $userId)
            ->selectRaw('COUNT(DISTINCT logged_date) as days')
            ->value('days') ?? 0;

        $totalRecipes = DB::table('recipes')->where('user_id', $userId)->count();
        $totalSavedRecipes = DB::table('saved_recipes')->where('user_id', $userId)->count();
        $profileComplete = $user->name && $user->email && $user->avatar;
        $memberDays = $user->created_at ? (int) $user->created_at->diffInDays(now()) : 0;

        $definitions = [
            [
                'key'         => 'first_food_log',
                'title'       => 'First Bite',
                'description' => 'Log your first meal',
                'icon'        => '🍽️',
                'category'    => 'nutrition',
                'earned'      => $totalFoodLogs >= 1,
                'progress'    => min($totalFoodLogs, 1),
                'max'         => 1,
            ],
            [
                'key'         => 'food_logs_7',
                'title'       => 'Consistent Eater',
                'description' => 'Log 7 meals',
                'icon'        => '🥗',
                'category'    => 'nutrition',
                'earned'      => $totalFoodLogs >= 7,
                'progress'    => min($totalFoodLogs, 7),
                'max'         => 7,
            ],
            [
                'key'         => 'food_logs_30',
                'title'       => 'Nutrition Tracker',
                'description' => 'Log 30 meals',
                'icon'        => '📊',
                'category'    => 'nutrition',
                'earned'      => $totalFoodLogs >= 30,
                'progress'    => min($totalFoodLogs, 30),
                'max'         => 30,
            ],
            [
                'key'         => 'food_logs_100',
                'title'       => 'Food Journal Master',
                'description' => 'Log 100 meals',
                'icon'        => '🏆',
                'category'    => 'nutrition',
                'earned'      => $totalFoodLogs >= 100,
                'progress'    => min($totalFoodLogs, 100),
                'max'         => 100,
            ],
            [
                'key'         => 'first_workout',
                'title'       => 'First Sweat',
                'description' => 'Log your first workout',
                'icon'        => '💪',
                'category'    => 'fitness',
                'earned'      => $totalWorkouts >= 1,
                'progress'    => min($totalWorkouts, 1),
                'max'         => 1,
            ],
            [
                'key'         => 'workouts_10',
                'title'       => 'Getting Strong',
                'description' => 'Complete 10 workouts',
                'icon'        => '🏋️',
                'category'    => 'fitness',
                'earned'      => $totalWorkouts >= 10,
                'progress'    => min($totalWorkouts, 10),
                'max'         => 10,
            ],
            [
                'key'         => 'workout_days_7',
                'title'       => 'Week Warrior',
                'description' => 'Work out on 7 different days',
                'icon'        => '📅',
                'category'    => 'fitness',
                'earned'      => $uniqueWorkoutDays >= 7,
                'progress'    => min($uniqueWorkoutDays, 7),
                'max'         => 7,
            ],
            [
                'key'         => 'workout_days_30',
                'title'       => 'Monthly Champion',
                'description' => 'Work out on 30 different days',
                'icon'        => '🥇',
                'category'    => 'fitness',
                'earned'      => $uniqueWorkoutDays >= 30,
                'progress'    => min($uniqueWorkoutDays, 30),
                'max'         => 30,
            ],
            [
                'key'         => 'first_recipe',
                'title'       => 'Chef\'s Debut',
                'description' => 'Save your first recipe',
                'icon'        => '👨‍🍳',
                'category'    => 'recipes',
                'earned'      => $totalSavedRecipes >= 1,
                'progress'    => min($totalSavedRecipes, 1),
                'max'         => 1,
            ],
            [
                'key'         => 'recipes_5',
                'title'       => 'Recipe Collector',
                'description' => 'Save 5 recipes',
                'icon'        => '📚',
                'category'    => 'recipes',
                'earned'      => $totalSavedRecipes >= 5,
                'progress'    => min($totalSavedRecipes, 5),
                'max'         => 5,
            ],
            [
                'key'         => 'profile_complete',
                'title'       => 'Profile Pro',
                'description' => 'Complete your profile',
                'icon'        => '✅',
                'category'    => 'profile',
                'earned'      => (bool) $profileComplete,
                'progress'    => $profileComplete ? 1 : 0,
                'max'         => 1,
            ],
            [
                'key'         => 'member_30',
                'title'       => 'Loyal Member',
                'description' => 'Be a member for 30 days',
                'icon'        => '🌟',
                'category'    => 'profile',
                'earned'      => $memberDays >= 30,
                'progress'    => min($memberDays, 30),
                'max'         => 30,
            ],
        ];

        $earned = collect($definitions)->where('earned', true)->count();
        $total  = count($definitions);

        return response()->json([
            'achievements'  => $definitions,
            'earned_count'  => $earned,
            'total_count'   => $total,
            'stats' => [
                'total_food_logs'     => $totalFoodLogs,
                'total_workouts'      => $totalWorkouts,
                'unique_workout_days' => $uniqueWorkoutDays,
                'total_recipes'       => $totalRecipes,
                'saved_recipes'       => $totalSavedRecipes,
                'member_days'         => $memberDays,
            ],
        ]);
    }
}
