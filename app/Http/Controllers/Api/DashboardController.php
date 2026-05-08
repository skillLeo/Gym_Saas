<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\FoodLogEntry;
use App\Models\WaterLog;
use App\Models\FitnessLog;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $today = now()->toDateString();

        $entries = FoodLogEntry::with('foodItem')
            ->where('user_id', $user->id)
            ->where('logged_date', $today)
            ->get();

        $waterLog = WaterLog::where('user_id', $user->id)
            ->whereDate('logged_date', $today)
            ->first();
        if (!$waterLog) {
            try {
                $waterLog = WaterLog::create(['user_id' => $user->id, 'logged_date' => $today, 'glasses_count' => 0]);
            } catch (\Exception $e) {
                $waterLog = WaterLog::where('user_id', $user->id)->whereDate('logged_date', $today)->firstOrNew();
                $waterLog->glasses_count ??= 0;
            }
        }

        $fitnessToday = FitnessLog::where('user_id', $user->id)
            ->where('logged_date', $today)
            ->get();

        $recent = $entries->take(5)->map(fn($e) => [
            'id'         => $e->id,
            'name'       => $e->foodItem->name,
            'meal_type'  => $e->meal_type,
            'calories'   => $e->total_calories,
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'today_date' => $today,
                'trial' => [
                    'status'        => $user->subscription_status,
                    'is_on_trial'   => $user->isOnTrial(),
                    'days_remaining'=> $user->trialDaysRemaining(),
                    'ends_at'       => $user->trial_ends_at?->toIso8601String(),
                ],
                'nutrition' => [
                    'calories_consumed' => (float) $entries->sum('total_calories'),
                    'calorie_goal'      => $user->daily_calorie_goal ?? 2000,
                    'protein_g'         => (float) $entries->sum('total_protein_g'),
                    'carbs_g'           => (float) $entries->sum('total_carbs_g'),
                    'fat_g'             => (float) $entries->sum('total_fat_g'),
                    'goal_protein'      => $user->daily_protein_goal_g ?? 150,
                    'goal_carbs'        => $user->daily_carbs_goal_g ?? 200,
                    'goal_fat'          => $user->daily_fat_goal_g ?? 65,
                ],
                'water' => [
                    'glasses_today' => $waterLog->glasses_count,
                    'goal'          => $user->daily_water_goal_glasses,
                ],
                'recent_food_entries' => $recent,
                'fitness_today' => [
                    'workouts_logged' => $fitnessToday->count(),
                    'calories_burned' => (int) $fitnessToday->sum('calories_burned'),
                ],
            ],
        ]);
    }
}
