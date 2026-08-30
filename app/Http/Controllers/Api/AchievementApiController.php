<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityStreak;
use App\Models\Badge;
use App\Models\FeedFeature;
use App\Models\User;
use App\Models\UserBadge;
use App\Services\StreakService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Streaks, badges and feed features for members (§4.5).
 */
class AchievementApiController extends Controller
{
    /** Featured cards shown per feed load, so they never dominate it. */
    private const FEED_FEATURE_LIMIT = 3;

    public function __construct(private StreakService $streaks) {}

    /**
     * The signed-in member's achievements, for their profile.
     */
    public function mine(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->forUser($request->user(), true)]);
    }

    /**
     * Another member's public achievements.
     */
    public function forMember(Request $request, User $user): JsonResponse
    {
        return response()->json(['data' => $this->forUser($user, false)]);
    }

    /**
     * Members currently featured for a streak.
     *
     * Capped, and ordered so month celebrations outrank weekly ones. The cap is
     * the difference between a feed that celebrates people and a feed made of
     * celebration cards.
     */
    public function feedFeatures(Request $request): JsonResponse
    {
        $features = FeedFeature::live()
            ->with('user:id,name,username,avatar')
            ->orderByRaw("FIELD(feature_type, 'month_streak', 'week_streak')")
            ->orderByDesc('period_end')
            ->limit(self::FEED_FEATURE_LIMIT)
            ->get();

        return response()->json([
            'data' => $features->map(function (FeedFeature $f) {
                $days = $f->period_start->diffInDays($f->period_end) + 1;

                return [
                    'id'           => $f->id,
                    'feature_type' => $f->feature_type,
                    'days'         => (int) $days,
                    'period_start' => $f->period_start->toDateString(),
                    'period_end'   => $f->period_end->toDateString(),
                    'user'         => [
                        'id'       => $f->user?->id,
                        'name'     => $f->user?->name,
                        'username' => $f->user?->username,
                        'avatar'   => $f->user?->avatar_url,
                    ],
                ];
            }),
        ]);
    }

    /**
     * Dismiss a feature from the feed.
     *
     * Only the featured member may dismiss their own — otherwise anyone could
     * remove someone else's moment.
     */
    public function dismissFeature(Request $request, FeedFeature $feedFeature): JsonResponse
    {
        if ($feedFeature->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $feedFeature->update(['dismissed_at' => now()]);

        return response()->json(['message' => 'Hidden from the feed.']);
    }

    /**
     * @param bool $includeLocked whether to list badges not yet earned
     */
    private function forUser(User $user, bool $includeLocked): array
    {
        $streaks = ActivityStreak::where('user_id', $user->id)->get()->keyBy('streak_type');

        $earned = UserBadge::where('user_id', $user->id)
            ->with('badge')
            ->orderByDesc('awarded_at')
            ->get();

        $overall = $streaks->get('overall');

        // The celebration is driven by the live streak, not by holding the
        // badge: someone who earned it last month and stopped is not currently
        // on a month-long run, and saying otherwise would be a lie the member
        // can see through.
        $celebration = null;
        if ($overall && $overall->isLive() && $overall->current_count >= StreakService::MONTH_STREAK_DAYS) {
            $celebration = [
                'type'   => 'month_streak',
                'days'   => $overall->current_count,
                'weeks'  => intdiv($overall->current_count, 7),
                'since'  => $overall->started_on?->toDateString(),
            ];
        }

        $payload = [
            'streaks' => collect(ActivityStreak::TYPES)->mapWithKeys(function (string $type) use ($streaks) {
                $s = $streaks->get($type);

                return [$type => [
                    'current' => $s && $s->isLive() ? $s->current_count : 0,
                    'longest' => $s?->longest_count ?? 0,
                    'live'    => (bool) $s?->isLive(),
                    'since'   => $s?->started_on?->toDateString(),
                ]];
            })->all(),
            'badges' => $earned->map(fn (UserBadge $ub) => [
                'key'          => $ub->badge?->key,
                'name'         => $ub->badge?->name,
                'description'  => $ub->badge?->description,
                'icon_name'    => $ub->badge?->icon_name,
                'tier'         => $ub->badge?->tier,
                'awarded_at'   => $ub->awarded_at?->toDateString(),
                'period_start' => $ub->period_start?->toDateString(),
                'period_end'   => $ub->period_end?->toDateString(),
                'meta'         => $ub->meta,
            ])->values(),
            'badge_count' => $earned->count(),
            'celebration' => $celebration,
        ];

        if ($includeLocked) {
            $earnedIds = $earned->pluck('badge_id')->unique();

            // Shown so progress is visible rather than a mystery. Never
            // fabricated: only real badge definitions appear here.
            $payload['locked'] = Badge::active()
                ->whereNotIn('id', $earnedIds)
                ->orderBy('sort_order')
                ->get()
                ->map(fn (Badge $b) => [
                    'key'         => $b->key,
                    'name'        => $b->name,
                    'description' => $b->description,
                    'icon_name'   => $b->icon_name,
                    'tier'        => $b->tier,
                    'target_days' => $b->criteria['days'] ?? null,
                    'activity'    => $b->criteria['activity'] ?? null,
                ])->values();
        }

        return $payload;
    }
}
