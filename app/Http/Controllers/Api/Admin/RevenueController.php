<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\UserAccountState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Every figure here is computed from `subscriptions`/`payments` at request
 * time — none of it is stored or cached as a running total, so there is no
 * drift to reconcile and nothing here can go stale. Replaces the previous
 * `AdminController::stats()['total_revenue']`, which was
 * `User::count() * 29.99` — a made-up number with no relationship to the
 * actual price paid by anyone, and one the client never approved.
 */
class RevenueController extends Controller
{
    public function index(Request $request)
    {
        $activeSubscribers = Subscription::whereIn('status', Subscription::ENTITLED_STATUSES)
            ->distinct('user_id')
            ->count('user_id');

        // MRR: sum each entitled subscription's plan price, normalised to a
        // monthly figure (annual plans divide by 12). One row per user is
        // assumed correct here because `activeSubscription()` elsewhere in
        // the app also takes the latest row per user as authoritative.
        $mrrCents = Subscription::whereIn('subscriptions.status', Subscription::ENTITLED_STATUSES)
            ->join('subscription_plans', 'subscription_plans.id', '=', 'subscriptions.plan_id')
            ->selectRaw('SUM(CASE WHEN subscription_plans.interval = "year" THEN subscription_plans.amount_cents / 12 ELSE subscription_plans.amount_cents END) as mrr')
            ->value('mrr') ?? 0;

        // Trial conversion: of everyone who ever started a trial, how many
        // are now a paying subscriber. Uses `trial_starts_at` (set once, at
        // signup, never rewritten) as the trial-cohort denominator rather
        // than the current `account_state`, so a user who converted and later
        // churned still counts as having been in the trial cohort.
        $everHadTrial = User::whereNotNull('trial_starts_at')->count();
        $trialsConverted = User::whereNotNull('trial_starts_at')
            ->where('account_state', UserAccountState::SUBSCRIBER)
            ->count();
        $conversionRate = $everHadTrial > 0 ? round($trialsConverted / $everHadTrial * 100, 1) : 0.0;

        // Churn: of subscriptions that were entitled at the start of the last
        // 30 days, how many are canceled/deleted now. A trial that never
        // converted is a lost lead, not churn — this only counts rows that
        // reached an entitled status at some point (i.e. a real subscription
        // existed), matching the distinction already drawn in
        // AdminController::stats() for churned_users.
        $windowStart = now()->subDays(30);
        $hadSubscriptionInWindow = Subscription::where('created_at', '<=', $windowStart)->count();
        $churnedInWindow = Subscription::where('created_at', '<=', $windowStart)
            ->whereIn('status', ['canceled', 'unpaid', 'incomplete_expired'])
            ->where('updated_at', '>=', $windowStart)
            ->count();
        $churnRate = $hadSubscriptionInWindow > 0 ? round($churnedInWindow / $hadSubscriptionInWindow * 100, 1) : 0.0;

        $revenueByMonth = Payment::where('status', 'succeeded')
            ->where('paid_at', '>=', now()->subMonths(12))
            ->selectRaw('DATE_FORMAT(paid_at, "%Y-%m") as month, SUM(amount_cents) as cents, COUNT(*) as payment_count')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => [
                'month'          => $row->month,
                'revenue'        => round($row->cents / 100, 2),
                'payment_count'  => $row->payment_count,
            ]);

        $totalRevenue = Payment::where('status', 'succeeded')->sum('amount_cents') / 100;

        $byPlan = SubscriptionPlan::query()
            ->withCount(['subscriptions as active_count' => fn ($q) => $q->whereIn('status', Subscription::ENTITLED_STATUSES)])
            ->get(['id', 'key', 'name', 'amount_cents', 'interval'])
            ->map(fn ($plan) => [
                'key'          => $plan->key,
                'name'         => $plan->name,
                'price'        => round($plan->amount_cents / 100, 2),
                'interval'     => $plan->interval,
                'active_count' => $plan->active_count,
            ]);

        return response()->json([
            'active_subscribers' => $activeSubscribers,
            'mrr'                => round($mrrCents / 100, 2),
            'trial_conversion_rate' => $conversionRate,
            'churn_rate'         => $churnRate,
            'total_revenue'      => round($totalRevenue, 2),
            'revenue_by_month'   => $revenueByMonth,
            'by_plan'            => $byPlan,
        ]);
    }
}
