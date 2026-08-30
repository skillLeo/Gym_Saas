<?php

namespace App\Http\Controllers\Coaching;

use App\Http\Controllers\Controller;
use App\Models\BodyStat;
use App\Models\CoachingAuthorization;
use App\Models\FitnessLog;
use App\Models\FoodLogEntry;
use App\Models\User;
use App\Services\PhysicianCanAccessMember;
use Illuminate\Http\Request;

/**
 * Read-only coaching data (§6.5.3). Every method independently calls
 * `PhysicianCanAccessMember::authorize()` — the route parameter is a
 * `CoachingAuthorization` id, never a raw member/user id, and that id is
 * re-verified against the *authenticated* physician's own authorizations on
 * every single request. No method trusts a previous method having checked.
 *
 * Strictly coaching data, not clinical records: workout history, nutrition
 * adherence, body-stat trends. No medical notes, no diagnoses — those do not
 * exist anywhere in this schema to leak.
 */
class PatientDataController extends Controller
{
    public function __construct(private PhysicianCanAccessMember $access) {}

    public function workouts(Request $request, CoachingAuthorization $authorization)
    {
        $auth = $this->access->authorize($request->user('physician'), $authorization, $request);

        $workouts = FitnessLog::where('user_id', $auth->member_id)
            ->orderByDesc('logged_date')
            ->paginate(20, ['id', 'exercise_name', 'category', 'duration_minutes', 'calories_burned', 'logged_date']);

        return response()->json($workouts);
    }

    public function nutrition(Request $request, CoachingAuthorization $authorization)
    {
        $auth = $this->access->authorize($request->user('physician'), $authorization, $request);
        $member = User::findOrFail($auth->member_id);

        // Adherence, not raw diary content: daily totals against the member's
        // own goal for the last 30 logged days. Read-only, aggregate — not a
        // meal-by-meal export.
        $daily = FoodLogEntry::where('user_id', $auth->member_id)
            ->where('logged_date', '>=', now()->subDays(30))
            ->selectRaw('logged_date, SUM(total_calories) as calories, SUM(total_protein_g) as protein, SUM(total_carbs_g) as carbs, SUM(total_fat_g) as fat')
            ->groupBy('logged_date')
            ->orderByDesc('logged_date')
            ->get();

        return response()->json([
            'goal' => [
                'calories' => $member->daily_calorie_goal,
                'protein'  => $member->daily_protein_goal_g,
                'carbs'    => $member->daily_carbs_goal_g,
                'fat'      => $member->daily_fat_goal_g,
            ],
            'daily' => $daily,
        ]);
    }

    public function bodyStats(Request $request, CoachingAuthorization $authorization)
    {
        $auth = $this->access->authorize($request->user('physician'), $authorization, $request);

        $stats = BodyStat::where('user_id', $auth->member_id)
            ->orderByDesc('logged_date')
            ->paginate(30);

        return response()->json($stats);
    }
}
