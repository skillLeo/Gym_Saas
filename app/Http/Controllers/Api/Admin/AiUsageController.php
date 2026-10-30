<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiUsageLog;
use App\Models\User;
use App\Services\Ai\AiGate;
use App\Services\Ai\AiSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The AI Usage admin screen: what has been spent, on what, by whom, and the
 * controls to cap or stop it.
 *
 * Admin-only via the `admin` middleware on the route, not an internal
 * assertAdmin() call — see the note in EnsureAdmin.
 *
 * Every figure here is an ESTIMATE from the pricing table in config/ai.php and
 * the screen says so. OpenAI's invoice is the authority; this exists to stop
 * spending before a surprise, and presenting an estimate as a bill would be
 * exactly the kind of confident-looking invented number this project has had
 * to strip out before.
 */
class AiUsageController extends Controller
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly AiGate $gate,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $monthStart = Carbon::now()->startOfMonth();
        $cap        = $this->settings->monthlyCapUsd();
        $spent      = $this->gate->monthToDateSpendUsd();

        return response()->json([
            'success' => true,
            'data'    => [
                'month' => [
                    'starts_on'    => $monthStart->toDateString(),
                    'spent_usd'    => round($spent, 4),
                    'cap_usd'      => round($cap, 2),
                    'remaining_usd'=> round(max(0, $cap - $spent), 4),
                    // Clamped at 100 so a cap that was lowered mid-month cannot
                    // render a progress bar wider than its track.
                    'percent_used' => $cap > 0 ? min(100, round(($spent / $cap) * 100, 1)) : null,
                    'cap_reached'  => $cap > 0 && $spent >= $cap,
                ],

                'by_feature' => AiUsageLog::query()
                    ->where('created_at', '>=', $monthStart)
                    ->groupBy('feature')
                    ->select([
                        'feature',
                        DB::raw('COUNT(*) as calls'),
                        DB::raw('SUM(estimated_cost_usd) as cost_usd'),
                        DB::raw('AVG(latency_ms) as avg_latency_ms'),
                        DB::raw("SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) as ok_calls"),
                    ])
                    ->orderByDesc('cost_usd')
                    ->get()
                    ->map(fn ($r) => [
                        'feature'        => $r->feature,
                        'calls'          => (int) $r->calls,
                        'ok_calls'       => (int) $r->ok_calls,
                        'cost_usd'       => round((float) $r->cost_usd, 4),
                        'avg_latency_ms' => $r->avg_latency_ms !== null ? (int) round($r->avg_latency_ms) : null,
                        // The number an admin actually wants when deciding
                        // whether a feature is worth its cost.
                        'cost_per_call_usd' => (int) $r->calls > 0
                            ? round((float) $r->cost_usd / (int) $r->calls, 6)
                            : 0.0,
                    ]),

                'by_status' => AiUsageLog::query()
                    ->where('created_at', '>=', $monthStart)
                    ->groupBy('status')
                    ->select(['status', DB::raw('COUNT(*) as calls')])
                    ->orderByDesc('calls')
                    ->get()
                    ->map(fn ($r) => ['status' => $r->status, 'calls' => (int) $r->calls]),

                /*
                 * Top spenders, by cost rather than by call count: one member
                 * sending photos costs far more than another typing meals, and
                 * a call count would hide that.
                 */
                'top_users' => AiUsageLog::query()
                    ->where('created_at', '>=', $monthStart)
                    ->whereNotNull('user_id')
                    ->groupBy('user_id')
                    ->select([
                        'user_id',
                        DB::raw('COUNT(*) as calls'),
                        DB::raw('SUM(estimated_cost_usd) as cost_usd'),
                    ])
                    ->orderByDesc('cost_usd')
                    ->limit(10)
                    ->get()
                    ->map(function ($r) {
                        $user = User::find($r->user_id);

                        return [
                            'user_id'  => (int) $r->user_id,
                            // Falls back rather than showing a blank row: usage
                            // rows outlive the accounts that made them on purpose.
                            'name'     => $user?->name ?? 'Deleted member',
                            'email'    => $user?->email,
                            'calls'    => (int) $r->calls,
                            'cost_usd' => round((float) $r->cost_usd, 4),
                        ];
                    }),

                /*
                 * Recent failures, so an admin can see a provider outage as an
                 * outage instead of fielding "the camera thing is broken"
                 * messages. No content, only status and timing.
                 */
                'recent_failures' => AiUsageLog::query()
                    ->where('status', '!=', 'ok')
                    ->latest('created_at')
                    ->limit(20)
                    ->get(['id', 'feature', 'model', 'status', 'latency_ms', 'created_at', 'user_id'])
                    ->map(fn ($r) => [
                        'id'         => $r->id,
                        'feature'    => $r->feature,
                        'model'      => $r->model,
                        'status'     => $r->status,
                        'latency_ms' => $r->latency_ms,
                        'user_id'    => $r->user_id,
                        'created_at' => $r->created_at?->toIso8601String(),
                    ]),

                'settings' => $this->settings->all(),

                'models' => [
                    'vision'     => config('ai.models.vision'),
                    'text'       => config('ai.models.text'),
                    'transcribe' => config('ai.models.transcribe'),
                ],

                /*
                 * Whether a key is present — never the key. A boolean is all an
                 * admin needs to tell "not configured" from "configured and
                 * failing", and it is the only safe thing to send.
                 */
                'api_key_present' => filled(config('ai.api_key')),

                'members_enabled' => User::where('ai_features_enabled', true)->count(),
            ],
        ]);
    }

    /**
     * The kill switch, the cap and the per-member limits.
     *
     * Nullable throughout: the screen saves one control at a time, and a
     * `required` rule would force the UI to send back every value it last read
     * — which is how a stale tab silently reverts a limit somebody else just
     * changed.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ai_enabled'              => 'nullable|boolean',
            'ai_beta_mode'            => 'nullable|boolean',
            // Capped at 500 so a mistyped cap cannot authorise unbounded spend.
            'ai_monthly_cap_usd'      => 'nullable|numeric|min:0|max:500',
            'ai_daily_limit_per_user' => 'nullable|integer|min:0|max:500',
            'ai_per_minute_per_user'  => 'nullable|integer|min:0|max:60',
        ]);

        foreach ($validated as $key => $value) {
            if ($value === null) {
                continue;
            }

            $this->settings->set($key, $value);
        }

        return response()->json([
            'success'  => true,
            'message'  => 'AI settings saved.',
            'data'     => $this->settings->all(),
        ]);
    }

    /**
     * Switch the AI features on or off for one member.
     *
     * Admins are refused rather than silently accepted: an admin account has no
     * food journal for an AI log to go into, so flagging one would create a
     * row that promises access the member-only routes will still refuse.
     */
    public function setUserAccess(Request $request, User $user): JsonResponse
    {
        $enabled = $request->validate([
            'enabled' => 'required|boolean',
        ])['enabled'];

        if ($user->is_admin) {
            return response()->json([
                'success' => false,
                'error'   => 'Administrator accounts have no personal food journal, so AI food logging cannot be enabled for them.',
                'code'    => 'member_only',
            ], 422);
        }

        $user->forceFill(['ai_features_enabled' => (bool) $enabled])->save();

        return response()->json([
            'success' => true,
            'message' => $enabled
                ? "Photo, voice and text logging switched on for {$user->name}."
                : "Photo, voice and text logging switched off for {$user->name}.",
            'data'    => [
                'user_id'             => $user->id,
                'ai_features_enabled' => (bool) $user->ai_features_enabled,
            ],
        ]);
    }
}
