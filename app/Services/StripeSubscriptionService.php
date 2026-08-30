<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\UserAccountState;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;
use Stripe\Subscription as StripeSubscription;

/**
 * Maps Stripe subscription objects onto local rows.
 *
 * Both the checkout controller and the webhook handler need this mapping. It
 * lives here once so the two cannot drift apart — a webhook that wrote slightly
 * different fields than checkout would produce state that depends on which
 * arrived first.
 */
class StripeSubscriptionService
{
    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Billing period bounds for a Stripe subscription.
     *
     * As of API version 2026-07-29, `current_period_start` / `current_period_end`
     * no longer exist on the subscription object — they live on each
     * subscription *item*. Reading them off the subscription (as most older
     * examples do) silently yields NULL for every renewal date.
     *
     * The top-level fields are still checked first so an older pinned API
     * version keeps working.
     *
     * @return array{0: ?Carbon, 1: ?Carbon}
     */
    public function periodBounds(StripeSubscription $sub): array
    {
        $start = $sub->current_period_start ?? null;
        $end   = $sub->current_period_end ?? null;

        if ($start === null || $end === null) {
            $item  = $sub->items->data[0] ?? null;
            $start ??= $item->current_period_start ?? null;
            $end   ??= $item->current_period_end ?? null;
        }

        return [
            $start ? Carbon::createFromTimestampUTC($start) : null,
            $end ? Carbon::createFromTimestampUTC($end) : null,
        ];
    }

    /**
     * Resolve the local plan for a Stripe subscription via its price ID.
     */
    public function resolvePlan(StripeSubscription $sub): ?SubscriptionPlan
    {
        $priceId = $sub->items->data[0]->price->id ?? null;

        return $priceId ? SubscriptionPlan::where('stripe_price_id', $priceId)->first() : null;
    }

    /**
     * Resolve the local user for a Stripe subscription.
     *
     * Prefers the `user_id` we set in metadata at creation; falls back to the
     * customer ID so a subscription created directly in the Stripe dashboard
     * still lands on the right account.
     */
    public function resolveUser(StripeSubscription $sub): ?User
    {
        $userId = $sub->metadata['user_id'] ?? null;
        if ($userId && $user = User::find($userId)) {
            return $user;
        }

        $customerId = is_string($sub->customer) ? $sub->customer : ($sub->customer->id ?? null);

        return $customerId ? User::where('stripe_customer_id', $customerId)->first() : null;
    }

    /**
     * Write Stripe's view of a subscription into the local table.
     *
     * Keyed on `stripe_subscription_id`, so replaying the same event is a
     * no-op update rather than a duplicate row.
     */
    public function sync(StripeSubscription $sub): ?Subscription
    {
        $user = $this->resolveUser($sub);
        $plan = $this->resolvePlan($sub);

        if (!$user || !$plan) {
            Log::warning('Stripe subscription could not be matched locally', [
                'stripe_subscription_id' => $sub->id,
                'user_found'             => (bool) $user,
                'plan_found'             => (bool) $plan,
            ]);

            return null;
        }

        [$periodStart, $periodEnd] = $this->periodBounds($sub);

        $customerId = is_string($sub->customer) ? $sub->customer : ($sub->customer->id ?? null);

        $subscription = Subscription::updateOrCreate(
            ['stripe_subscription_id' => $sub->id],
            [
                'user_id'              => $user->id,
                'plan_id'              => $plan->id,
                'stripe_customer_id'   => $customerId,
                'status'               => $sub->status,
                'current_period_start' => $periodStart,
                'current_period_end'   => $periodEnd,
                'cancel_at_period_end' => (bool) $sub->cancel_at_period_end,
                'canceled_at'          => $sub->canceled_at ? Carbon::createFromTimestampUTC($sub->canceled_at) : null,
                'ended_at'             => $sub->ended_at ? Carbon::createFromTimestampUTC($sub->ended_at) : null,
            ]
        );

        $this->syncUserStatus($user);

        return $subscription;
    }

    /**
     * Recompute the user's lifecycle state after a subscription change.
     *
     * Delegates to UserAccountState so billing events and the trial scheduler
     * cannot reach different conclusions about the same account. This used to
     * write `subscription_status` itself, which made it a second writer.
     */
    public function syncUserStatus(User $user): void
    {
        app(UserAccountState::class)->apply($user->refresh());
    }

    /**
     * Get or create the Stripe customer for a user.
     */
    public function customerFor(User $user): string
    {
        if ($user->stripe_customer_id) {
            return $user->stripe_customer_id;
        }

        $customer = \Stripe\Customer::create([
            'email'    => $user->email,
            'name'     => $user->name,
            'metadata' => ['user_id' => (string) $user->id],
        ]);

        $user->forceFill(['stripe_customer_id' => $customer->id])->save();

        return $customer->id;
    }
}
