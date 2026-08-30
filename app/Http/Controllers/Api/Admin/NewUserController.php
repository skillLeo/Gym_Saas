<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\FoodLogEntry;
use App\Models\User;
use App\Services\UserActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * New user monitoring (§E2) — separate from the general moderation/user-list
 * screens so the owner can watch onboarding behavior specifically: who signed
 * up recently, whether they've actually done anything yet, and how long ago
 * they last showed up.
 */
class NewUserController extends Controller
{
    public function __construct(private UserActivity $activity) {}

    public function index(Request $request)
    {
        $days = min((int) $request->query('days', 14), 90);

        $users = User::where('created_at', '>=', now()->subDays($days))
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'email', 'avatar', 'created_at', 'onboarding_completed', 'account_state']);

        $activityMap = $this->activity->lastActiveMap();
        $userIds = $users->pluck('id');

        $firstFoodLog = FoodLogEntry::whereIn('user_id', $userIds)
            ->selectRaw('user_id, MIN(created_at) as first_at')->groupBy('user_id')->pluck('first_at', 'user_id');
        $firstWorkout = DB::table('fitness_logs')->whereIn('user_id', $userIds)
            ->selectRaw('user_id, MIN(created_at) as first_at')->groupBy('user_id')->pluck('first_at', 'user_id');

        $result = $users->map(fn (User $u) => [
            'id'                   => $u->id,
            'name'                 => $u->name,
            'email'                => $u->email,
            'avatar'               => $u->avatar_url,
            'signed_up_at'         => $u->created_at,
            'onboarding_completed' => (bool) $u->onboarding_completed,
            'account_state'        => $u->account_state,
            'last_active_at'       => $activityMap[$u->id] ?? null,
            'first_food_log_at'    => $firstFoodLog[$u->id] ?? null,
            'first_workout_at'     => $firstWorkout[$u->id] ?? null,
        ]);

        return response()->json(['users' => $result, 'window_days' => $days]);
    }
}
