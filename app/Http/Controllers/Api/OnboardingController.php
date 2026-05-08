<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'primary_goal'      => 'required|in:lose_weight,maintain_weight,gain_muscle,improve_fitness,eat_healthier',
            'date_of_birth'     => 'required|date|before:today',
            'gender'            => 'required|in:male,female,other',
            'height_cm'         => 'required|numeric|min:50|max:300',
            'current_weight_kg' => 'required|numeric|min:10|max:500',
            'goal_weight_kg'    => 'nullable|numeric|min:10|max:500',
            'activity_level'    => 'required|in:sedentary,lightly_active,moderately_active,very_active,extra_active',
            'daily_calorie_goal'=> 'nullable|integer|min:1000|max:10000',
        ]);

        $user = $request->user();
        $user->fill($validated);

        $calories = $validated['daily_calorie_goal'] ?? $user->calculateDailyCalories();
        $user->daily_calorie_goal   = $calories;
        $user->daily_protein_goal_g = round($calories * 0.30 / 4);
        $user->daily_carbs_goal_g   = round($calories * 0.40 / 4);
        $user->daily_fat_goal_g     = round($calories * 0.30 / 9);
        $user->onboarding_completed = true;
        $user->save();

        return response()->json([
            'success' => true,
            'data'    => [
                'daily_calorie_goal'   => $user->daily_calorie_goal,
                'daily_protein_goal_g' => $user->daily_protein_goal_g,
                'daily_carbs_goal_g'   => $user->daily_carbs_goal_g,
                'daily_fat_goal_g'     => $user->daily_fat_goal_g,
                'onboarding_completed' => true,
            ],
            'message' => 'Onboarding complete!',
        ]);
    }
}
