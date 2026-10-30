<?php

namespace App\Services\Ai;

use App\Models\AiUsageLog;
use App\Models\User;
use App\Services\Ai\Exceptions\AiLimitReached;
use Illuminate\Support\Carbon;

/**
 * The single place that decides whether an AI call is allowed to happen.
 *
 * Both the route middleware and AiClient consult this. That looks redundant
 * and is on purpose: the middleware exists to fail fast with a clean 403 the
 * frontend can switch on, and the AiClient check exists so that a future
 * controller which forgets the middleware still cannot spend money. There is
 * one implementation of the rules, called from two places, rather than two
 * implementations that drift.
 *
 * Two kinds of "no" live here and they are not the same thing:
 *
 *   access   — the feature is off, not enabled for this member, or they have
 *              not consented. A 403. Nothing to retry; nothing was charged.
 *   limits   — the cap, the daily allowance or the throttle. A 429 carrying
 *              AiLimitReached. Nothing was sent upstream and nothing was
 *              charged; the member should be pointed at manual logging.
 */
class AiGate
{
    public function __construct(private readonly AiSettings $settings)
    {
    }

    /**
     * Why this member may not use AI features, or null if they may.
     *
     * Returns a problem description rather than throwing, because every caller
     * wants to turn it into a response and none of them want a stack trace for
     * what is a completely ordinary state — most members will never have the
     * flag switched on.
     *
     * @return array{code:string,message:string,status:int}|null
     */
    public function accessProblem(?User $user): ?array
    {
        if (! $user) {
            return [
                'code'    => 'unauthenticated',
                'message' => 'Please sign in.',
                'status'  => 401,
            ];
        }

        /*
         * Admins are excluded for the same reason they are excluded from food
         * and fitness logging generally (see DenyAdminMemberFeature): staff
         * accounts hold no personal journal, so there is nothing for an AI food
         * log to attach to. The route middleware already covers this; it is
         * repeated because this method is also called from AiClient, which has
         * no route context.
         */
        if ($user->is_admin) {
            return [
                'code'    => 'member_only',
                'message' => 'This is a member feature. Administrator accounts do not have personal food records.',
                'status'  => 403,
            ];
        }

        if (! $this->settings->enabled()) {
            return [
                'code'    => 'ai_disabled',
                'message' => 'Photo, voice and text logging is switched off at the moment. You can still log food manually.',
                'status'  => 403,
            ];
        }

        /*
         * The key being absent is a configuration fault, not a member fault,
         * and it must be caught here rather than discovered as a 401 from
         * OpenAI after the member has taken a photo and waited.
         */
        if (blank(config('ai.api_key'))) {
            return [
                'code'    => 'ai_not_configured',
                'message' => 'Photo, voice and text logging is not set up yet. You can still log food manually.',
                'status'  => 403,
            ];
        }

        if ($this->settings->betaMode() && ! $user->ai_features_enabled) {
            return [
                'code'    => 'ai_not_enabled_for_user',
                'message' => 'Photo, voice and text logging is in testing and is not switched on for your account yet.',
                'status'  => 403,
            ];
        }

        if (! $this->hasCurrentConsent($user)) {
            return [
                'code'    => 'ai_consent_required',
                'message' => 'Please review how photo, voice and text logging works before using it.',
                'status'  => 403,
            ];
        }

        return null;
    }

    public function allows(?User $user): bool
    {
        return $this->accessProblem($user) === null;
    }

    /**
     * Has this member agreed to the notice as it is currently worded?
     *
     * Both halves are required. A timestamp with no version, or a version that
     * no longer matches, counts as no consent — reworded terms are new terms,
     * and treating an old agreement as covering them would be us deciding on
     * the member's behalf what they agreed to.
     */
    public function hasCurrentConsent(User $user): bool
    {
        return $user->ai_consent_at !== null
            && (string) $user->ai_consent_version === (string) config('ai.consent_version');
    }

    /**
     * @throws AiLimitReached
     */
    public function assertWithinLimits(User $user): void
    {
        $cap   = $this->settings->monthlyCapUsd();
        $spent = $this->monthToDateSpendUsd();

        if ($cap > 0 && $spent >= $cap) {
            throw new AiLimitReached(
                sprintf('Monthly AI spend cap reached: %.4f of %.2f USD.', $spent, $cap),
                'cap_reached',
                'Photo, voice and text logging has reached its monthly budget and will switch back on next month. Manual logging is unaffected — you can add this meal by hand.',
            );
        }

        $perMinute = $this->settings->perMinutePerUser();
        if ($perMinute > 0 && $this->callsInLastMinute($user) >= $perMinute) {
            throw new AiLimitReached(
                sprintf('Per-minute AI throttle hit for user %d.', $user->id),
                'rate_limit',
                'That was a lot of requests at once. Please wait a moment and try again.',
            );
        }

        $daily = $this->settings->dailyLimitPerUser();
        if ($daily > 0 && $this->successfulCallsToday($user) >= $daily) {
            throw new AiLimitReached(
                sprintf('Daily AI limit hit for user %d.', $user->id),
                'daily_limit',
                'You have used all of today\'s photo, voice and text logs. They reset tomorrow. You can still log as much as you like manually.',
            );
        }
    }

    /**
     * Estimated spend since the first of the month.
     *
     * Every row counts, successful or not. A call that failed after the model
     * had already produced output still cost money, and excluding failures
     * would let a run of bad responses spend past the cap unseen. Calls we
     * blocked ourselves carry a cost of 0, so they make no difference.
     */
    public function monthToDateSpendUsd(): float
    {
        return (float) AiUsageLog::where('created_at', '>=', Carbon::now()->startOfMonth())
            ->sum('estimated_cost_usd');
    }

    public function remainingBudgetUsd(): float
    {
        return max(0.0, $this->settings->monthlyCapUsd() - $this->monthToDateSpendUsd());
    }

    /**
     * Successful AI logs this member has made today.
     *
     * Only `ok` rows count. The daily allowance is "20 AI logs a day", and a
     * member whose photo failed because OpenAI was down has not had a log —
     * charging them for our outage would be the wrong way round. Abuse is held
     * back by the per-minute throttle below, which counts every attempt.
     */
    public function successfulCallsToday(User $user): int
    {
        return AiUsageLog::where('user_id', $user->id)
            ->where('status', 'ok')
            ->where('created_at', '>=', Carbon::now()->startOfDay())
            ->count();
    }

    /** Every attempt in the last 60 seconds, successful or not. */
    public function callsInLastMinute(User $user): int
    {
        return AiUsageLog::where('user_id', $user->id)
            ->where('created_at', '>=', Carbon::now()->subMinute())
            ->count();
    }
}
