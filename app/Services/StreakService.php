<?php

namespace App\Services;

use App\Models\ActivityStreak;
use App\Models\Badge;
use App\Models\FeedFeature;
use App\Models\User;
use App\Models\UserBadge;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Streaks, badges and feed featuring (§4.5).
 *
 * Everything here is **recomputed from the activity tables**, never incremented.
 * An incrementing counter drifts the moment a run is missed, a log is
 * backfilled, or a job runs twice — and it drifts silently, which is worse than
 * being wrong loudly. Rebuilding means the answer is always whatever the
 * activity data actually says.
 *
 * Idempotency is enforced by database constraints rather than by checking first
 * and then writing: `user_badges` is unique on (user_id, badge_id,
 * period_start) and `feed_features` on (user_id, feature_type, period_start).
 * A check-then-insert leaves a race window, and these jobs are expected to
 * overlap.
 */
class StreakService
{
    /** Consecutive active days that surface a member in the feed. */
    public const WEEK_STREAK_DAYS = 7;

    /** Consecutive active days for the month celebration. */
    public const MONTH_STREAK_DAYS = 28;

    /** How long a feature stays in the feed once earned. */
    public const WEEK_FEATURE_DAYS  = 7;
    public const MONTH_FEATURE_DAYS = 14;

    /** How far back to look. Two months covers the longest badge comfortably. */
    private const LOOKBACK_DAYS = 70;

    /**
     * Dates on which a member did each kind of activity.
     *
     * One query per activity, returning distinct Y-m-d strings. Reads the real
     * logs — there is no separate "activity" table to fall out of sync with.
     *
     * @return array<string, array<string, true>> activity => set of dates
     */
    public function activityDates(User $user, ?Carbon $since = null): array
    {
        $since = ($since ?? today()->subDays(self::LOOKBACK_DAYS))->toDateString();

        $dates = fn (string $table, string $column, bool $isTimestamp = false) =>
            array_fill_keys(
                DB::table($table)
                    ->where('user_id', $user->id)
                    ->when($isTimestamp,
                        fn ($q) => $q->whereDate($column, '>=', $since),
                        fn ($q) => $q->where($column, '>=', $since))
                    ->selectRaw($isTimestamp ? "DATE({$column}) as d" : "{$column} as d")
                    ->distinct()
                    ->pluck('d')
                    ->map(fn ($d) => Carbon::parse($d)->toDateString())
                    ->all(),
                true,
            );

        $workout  = $dates('fitness_logs', 'logged_date');
        $mealLog  = $dates('food_log_entries', 'logged_date');

        // Engagement is any outward community action, not just posting —
        // someone who comments and reacts daily is engaged.
        $engagement = $dates('social_posts', 'created_at', true)
            + $dates('post_comments', 'created_at', true)
            + $dates('post_reactions', 'created_at', true);

        return [
            'workout'    => $workout,
            'meal_log'   => $mealLog,
            'engagement' => $engagement,
            // "Did anything at all" — drives feed featuring.
            'overall'    => $workout + $mealLog + $engagement,
        ];
    }

    /**
     * Longest run of consecutive dates ending on or just before today.
     *
     * Counts back from today; if there is nothing today, it counts back from
     * yesterday instead, so a streak is not reported broken merely because the
     * job ran before the member trained.
     *
     * @param array<string, true> $dateSet
     * @return array{current:int, last:?string, started:?string}
     */
    public function currentRun(array $dateSet): array
    {
        if ($dateSet === []) {
            return ['current' => 0, 'last' => null, 'started' => null];
        }

        $cursor = today();
        if (!isset($dateSet[$cursor->toDateString()])) {
            $cursor = $cursor->subDay();
            if (!isset($dateSet[$cursor->toDateString()])) {
                return ['current' => 0, 'last' => null, 'started' => null];
            }
        }

        $last  = $cursor->toDateString();
        $count = 0;

        while (isset($dateSet[$cursor->toDateString()])) {
            $count++;
            $cursor = $cursor->subDay();
        }

        return [
            'current' => $count,
            'last'    => $last,
            'started' => $cursor->addDay()->toDateString(),
        ];
    }

    /**
     * Longest run anywhere in the window, used for the personal best.
     *
     * @param array<string, true> $dateSet
     */
    public function longestRun(array $dateSet): int
    {
        if ($dateSet === []) {
            return 0;
        }

        $days = array_keys($dateSet);
        sort($days);

        $best = 1;
        $run  = 1;

        for ($i = 1; $i < count($days); $i++) {
            $prev = Carbon::parse($days[$i - 1]);
            $curr = Carbon::parse($days[$i]);

            $run = $prev->addDay()->isSameDay($curr) ? $run + 1 : 1;
            $best = max($best, $run);
        }

        return $best;
    }

    /**
     * Rebuild all four streak rows for one member.
     *
     * @return array<string, ActivityStreak>
     */
    public function recomputeStreaks(User $user): array
    {
        $activity = $this->activityDates($user);
        $result   = [];

        foreach (ActivityStreak::TYPES as $type) {
            $set = $activity[$type] ?? [];
            $run = $this->currentRun($set);

            $streak = ActivityStreak::updateOrCreate(
                ['user_id' => $user->id, 'streak_type' => $type],
                [
                    'current_count'      => $run['current'],
                    // Never let a rebuild lower someone's personal best: the
                    // lookback window is finite, so an older record may sit
                    // outside it and must not be erased.
                    'longest_count'      => max($this->longestRun($set), $run['current']),
                    'last_activity_date' => $run['last'],
                    'started_on'         => $run['started'],
                ],
            );

            // updateOrCreate would overwrite longest_count with a smaller value
            // when history falls out of the window; restore the true maximum.
            if ($streak->wasChanged('longest_count')) {
                $previous = $streak->getOriginal('longest_count') ?? 0;
                if ($previous > $streak->longest_count) {
                    $streak->forceFill(['longest_count' => $previous])->save();
                }
            }

            $result[$type] = $streak;
        }

        return $result;
    }

    /**
     * Award any badges the member now qualifies for.
     *
     * @return int number of new awards
     */
    public function awardBadges(User $user): int
    {
        $activity = $this->activityDates($user);
        $awarded  = 0;

        foreach (Badge::active()->orderBy('sort_order')->get() as $badge) {
            $outcome = $this->evaluate($badge, $activity);

            if (!$outcome) {
                continue;
            }

            [$periodStart, $periodEnd, $meta] = $outcome;

            try {
                UserBadge::create([
                    'user_id'      => $user->id,
                    'badge_id'     => $badge->id,
                    'awarded_at'   => now(),
                    'period_start' => $periodStart,
                    'period_end'   => $periodEnd,
                    'meta'         => $meta,
                ]);
                $awarded++;
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                // Already earned for this period. This is the idempotency
                // guarantee doing its job, not an error.
            }
        }

        return $awarded;
    }

    /**
     * Does this badge's rule pass right now?
     *
     * Dispatching on `criteria_type` is what keeps badges data-driven: a new
     * badge using an existing rule is a row, and only a genuinely new rule
     * shape needs a branch here.
     *
     * @return array{0:?string,1:?string,2:array}|null [period_start, period_end, meta]
     */
    private function evaluate(Badge $badge, array $activity): ?array
    {
        $criteria = $badge->criteria ?? [];
        $set      = $activity[$criteria['activity'] ?? 'overall'] ?? [];

        return match ($badge->criteria_type) {
            'consecutive_days'     => $this->evaluateConsecutive($set, (int) ($criteria['days'] ?? 7)),
            'active_days_in_month' => $this->evaluateMonthlyCount($set, (int) ($criteria['days'] ?? 20)),
            default => (function () use ($badge) {
                Log::warning('Unknown badge criteria_type; badge skipped', [
                    'badge' => $badge->key, 'criteria_type' => $badge->criteria_type,
                ]);

                return null;
            })(),
        };
    }

    private function evaluateConsecutive(array $set, int $required): ?array
    {
        $run = $this->currentRun($set);

        if ($run['current'] < $required) {
            return null;
        }

        // The period is the qualifying window ending today, so a member can
        // earn the same badge again after a break — but only once per window.
        $end   = Carbon::parse($run['last']);
        $start = $end->copy()->subDays($required - 1);

        return [$start->toDateString(), $end->toDateString(), ['streak' => $run['current']]];
    }

    private function evaluateMonthlyCount(array $set, int $required): ?array
    {
        $start = today()->startOfMonth();
        $end   = today()->endOfMonth();

        $count = count(array_filter(
            array_keys($set),
            fn ($d) => $d >= $start->toDateString() && $d <= $end->toDateString(),
        ));

        if ($count < $required) {
            return null;
        }

        return [$start->toDateString(), $end->toDateString(), ['active_days' => $count]];
    }

    /**
     * Surface a member in the feed for a sustained overall streak.
     *
     * @return int number of new features
     */
    public function updateFeedFeatures(User $user): int
    {
        $overall = $this->activityDates($user)['overall'] ?? [];
        $run     = $this->currentRun($overall);
        $created = 0;

        $tiers = [
            ['days' => self::MONTH_STREAK_DAYS, 'type' => 'month_streak', 'expires' => self::MONTH_FEATURE_DAYS],
            ['days' => self::WEEK_STREAK_DAYS,  'type' => 'week_streak',  'expires' => self::WEEK_FEATURE_DAYS],
        ];

        foreach ($tiers as $tier) {
            if ($run['current'] < $tier['days']) {
                continue;
            }

            $end   = Carbon::parse($run['last']);
            $start = $end->copy()->subDays($tier['days'] - 1);

            try {
                FeedFeature::create([
                    'user_id'      => $user->id,
                    'feature_type' => $tier['type'],
                    'period_start' => $start->toDateString(),
                    'period_end'   => $end->toDateString(),
                    'expires_at'   => now()->addDays($tier['expires']),
                ]);
                $created++;
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                // Already featured for this period.
            }

            // Only the highest tier a member qualifies for. Showing both the
            // week and month card for the same person clutters the feed and
            // makes the month milestone look ordinary.
            break;
        }

        return $created;
    }

    /**
     * Full recompute for one member.
     *
     * @return array{badges:int, features:int}
     */
    public function processUser(User $user): array
    {
        $this->recomputeStreaks($user);

        return [
            'badges'   => $this->awardBadges($user),
            'features' => $this->updateFeedFeatures($user),
        ];
    }
}
