<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Services\CouponService;
use App\Services\StripeSubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;
use Stripe\Exception\CardException;
use Stripe\Stripe;

/**
 * Subscription checkout and management.
 *
 * Card details never reach this server. The browser collects them with Stripe
 * Elements and confirms directly against Stripe using a client secret issued
 * here, so this application is never in the card-data path.
 */
class SubscriptionController extends Controller
{
    public function __construct(
        private StripeSubscriptionService $stripe,
        private CouponService $coupons,
    ) {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Public plan list for the pricing page.
     */
    public function plans(): JsonResponse
    {
        $plans = SubscriptionPlan::where('is_active', true)
            ->whereNotNull('stripe_price_id')
            ->orderBy('sort_order')
            ->get();

        $cheapestMonthly = $plans->where('interval', 'month')->min('amount_cents');

        return response()->json([
            'data' => $plans->map(function (SubscriptionPlan $plan) use ($plans) {
                // Savings are computed against the monthly plan an annual buyer
                // would otherwise hold (Premium), not the cheapest one, so the
                // figure reflects the real alternative.
                $reference = $plans->firstWhere('key', SubscriptionPlan::KEY_PREMIUM);
                $savings   = null;

                if ($plan->interval === 'year' && $reference) {
                    $yearAtMonthly = $reference->amount_cents * 12;
                    if ($yearAtMonthly > $plan->amount_cents) {
                        $savedCents = $yearAtMonthly - $plan->amount_cents;
                        $savings    = [
                            'saved_cents'      => $savedCents,
                            'percent'          => (int) round($savedCents / $yearAtMonthly * 100),
                            'months_free'      => round($savedCents / $reference->amount_cents, 1),
                            'compared_to_cents'=> $yearAtMonthly,
                        ];
                    }
                }

                return [
                    'key'                     => $plan->key,
                    'name'                    => $plan->name,
                    'description'             => $plan->description,
                    'amount_cents'            => $plan->amount_cents,
                    'currency'                => $plan->currency,
                    'interval'                => $plan->interval,
                    'monthly_equivalent_cents'=> $plan->monthly_equivalent_cents,
                    'features'                => $plan->features ?? [],
                    'savings'                 => $savings,
                ];
            }),
            // The publishable key is safe to expose; the frontend needs it to
            // initialise Elements.
            'publishable_key' => config('services.stripe.key'),
            // The landing page states an entry price and a trial length in its
            // marketing copy. Both used to be hardcoded English strings, so
            // changing a price or the trial setting silently made the homepage
            // lie. Serve the real values instead.
            'cheapest_monthly_cents' => $cheapestMonthly,
            'trial_days' => app(\App\Services\UserAccountState::class)->trialLengthDays(),
        ]);
    }

    /**
     * The signed-in user's current subscription state.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        // Ask Stripe directly when we are holding a subscription it may already
        // have settled. Entitlement is still granted by the webhook in the normal
        // case; this only closes the window where the money has moved and the
        // confirmation has not arrived — a delayed webhook, a dropped one, or a
        // local machine with no listener running. Without it a member who has
        // genuinely paid sits on "your account is still updating" indefinitely,
        // which is what the client hit while testing.
        $this->reconcilePendingSubscription($user);
        // Payment history is written only by the webhook, so it is empty for the
        // same reason and leaves the revenue figures reading zero.
        $this->backfillPayments($user);

        $subscription = $user->activeSubscription();

        return response()->json([
            'data' => [
                'has_access'          => $user->hasAccess(),
                // `account_state` is authoritative and distinguishes grace from
                // deactivated; `status` is the legacy mirror, kept so existing
                // callers keep working.
                'account_state'       => $user->account_state,
                'status'              => $user->subscription_status,
                'on_trial'            => $user->isOnTrial(),
                'trial_ends_at'       => $user->trial_ends_at,
                'trial_days_remaining'=> $user->trialDaysRemaining(),
                'subscription'        => $subscription ? [
                    'id'                  => $subscription->id,
                    'status'              => $subscription->status,
                    'plan'                => $subscription->plan?->only(['key', 'name', 'amount_cents', 'interval']),
                    'current_period_end'  => $subscription->current_period_end,
                    'cancel_at_period_end'=> $subscription->cancel_at_period_end,
                ] : null,
            ],
        ]);
    }

    /**
     * Start a subscription and return a client secret for Elements to confirm.
     *
     * The subscription is created `default_incomplete`: Stripe holds it in
     * `incomplete` until the browser confirms the payment. Nothing is granted
     * here — entitlement follows the webhook, so a user who abandons the form
     * never ends up with access they did not pay for.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_key'    => 'required|string|in:basic,premium,annual_vip',
            'coupon_code' => 'nullable|string|max:40',
        ]);

        $user = $request->user();

        // Resolve any coupon before creating the subscription, so an invalid
        // code is a clean 422 rather than an orphaned incomplete subscription.
        $grant = null;
        if (filled($validated['coupon_code'] ?? null)) {
            [$grant, $couponError] = $this->coupons->resolveForCheckout($user, $validated['coupon_code']);

            if ($couponError) {
                return response()->json([
                    'message' => $couponError,
                    'field'   => 'coupon_code',
                ], 422);
            }
        }

        // Never trust a price from the client. The plan is looked up server-side
        // and only its stored Stripe price ID is used.
        $plan = SubscriptionPlan::where('key', $validated['plan_key'])
            ->where('is_active', true)
            ->whereNotNull('stripe_price_id')
            ->first();

        if (!$plan) {
            return response()->json(['message' => 'That plan is not available.'], 422);
        }

        if ($existing = $user->activeSubscription()) {
            // Sent people to "billing settings", a screen that does not exist,
            // and left the only route to a different plan being cancel-and-wait.
            // Changing plan is what they were asking for, so do that.
            return response()->json([
                'message'         => 'You already have a subscription. Use "change plan" to move to a different one.',
                'subscription_id' => $existing->id,
                'can_change_plan' => true,
            ], 409);
        }

        try {
            $customerId = $this->stripe->customerFor($user);

            $params = [
                'customer'         => $customerId,
                'items'            => [['price' => $plan->stripe_price_id]],
                'payment_behavior' => 'default_incomplete',
                'payment_settings' => [
                    'save_default_payment_method' => 'on_subscription',
                ],
                'metadata' => [
                    'user_id'  => (string) $user->id,
                    'plan_key' => $plan->key,
                ],
                'expand' => ['latest_invoice.confirmation_secret'],
            ];

            if ($grant) {
                // Stripe applies the discount; we never compute a price
                // ourselves. The grant is marked redeemed by the webhook once
                // payment actually succeeds — an abandoned checkout must not
                // burn the customer's one-time code.
                $params['discounts'] = [['promotion_code' => $grant->stripe_promotion_code_id]];
                $params['metadata']['coupon_grant_id'] = (string) $grant->id;
            }

            $sub = \Stripe\Subscription::create($params);

            // Record the incomplete subscription now so an abandoned checkout is
            // still visible, rather than existing only inside Stripe.
            $this->stripe->sync($sub);

            $clientSecret = $sub->latest_invoice->confirmation_secret->client_secret ?? null;

            if (!$clientSecret) {
                Log::error('Stripe subscription created without a confirmation secret', [
                    'subscription' => $sub->id,
                    'user_id'      => $user->id,
                ]);

                return response()->json([
                    'message' => 'We could not start the payment. Please try again.',
                ], 502);
            }

            return response()->json([
                'data' => [
                    'subscription_id' => $sub->id,
                    'client_secret'   => $clientSecret,
                    'plan'            => ['key' => $plan->key, 'name' => $plan->name, 'amount_cents' => $plan->amount_cents],
                    'discount'        => $grant ? [
                        'code'          => $grant->code,
                        'label'         => $grant->offer->discount_label,
                        // What Stripe will actually take off, so the UI never
                        // has to recompute the discount itself.
                        'amount_cents'  => $grant->offer->discountCentsFor($plan->amount_cents),
                    ] : null,
                ],
            ], 201);
        } catch (CardException $e) {
            // Stripe already phrases these for cardholders.
            return response()->json(['message' => $e->getError()->message ?? 'Your card was declined.'], 402);
        } catch (ApiErrorException $e) {
            Log::error('Stripe subscription creation failed', [
                'user_id' => $user->id,
                'plan'    => $plan->key,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'We could not start your subscription. No charge was made. Please try again.',
            ], 502);
        }
    }

    /**
     * Cancel at period end — the user keeps access until they stop paying for.
     */
    /**
     * Catch up with Stripe when we are holding a subscription it has settled.
     *
     * The webhook remains the normal route and this does not replace it —
     * renewals, cancellations and failures still arrive that way. This closes
     * one specific, expensive gap: the member has paid, Stripe says so, and the
     * confirmation has not reached us, so the app tells someone who has just
     * been charged that they are still on a trial.
     *
     * Deliberately narrow:
     *  - only runs when a local row is stuck in a non-entitling status, so the
     *    common case makes no Stripe call at all;
     *  - grants access only if STRIPE says the subscription is entitling — the
     *    decision is never taken from anything the browser sent;
     *  - reuses the same `sync()` the webhook uses, so the two paths cannot
     *    drift apart;
     *  - never throws: a subscription page that dies because Stripe is slow is
     *    worse than one showing slightly stale state.
     */
    private function reconcilePendingSubscription($user): void
    {
        $pending = Subscription::where('user_id', $user->id)
            ->whereNotNull('stripe_subscription_id')
            ->whereNotIn('status', Subscription::ENTITLED_STATUSES)
            ->latest('id')
            ->first();

        if (!$pending) return;

        try {
            $stripeSub = \Stripe\Subscription::retrieve($pending->stripe_subscription_id);

            if (in_array($stripeSub->status, Subscription::ENTITLED_STATUSES, true)) {
                $this->stripe->sync($stripeSub);
                $user->refresh();

                Log::info('Subscription reconciled from Stripe without a webhook', [
                    'user_id'                => $user->id,
                    'stripe_subscription_id' => $stripeSub->id,
                    'stripe_status'          => $stripeSub->status,
                ]);
            }
        } catch (ApiErrorException $e) {
            report($e);
        }
    }

    /**
     * Record paid invoices that never reached us as webhooks.
     *
     * `payments` is written only by the webhook, so with delivery broken the
     * table stayed **empty while Stripe held five paid invoices** — and the admin
     * revenue screen, which sums that table, reported **$0 of real income**. An
     * owner looking at their own business and being told they have earned nothing
     * is not a cosmetic problem.
     *
     * Idempotent on the Stripe invoice id, the same key the webhook uses, so a
     * webhook arriving later updates the row rather than recording the charge
     * twice.
     */
    private function backfillPayments($user): void
    {
        if (!$user->stripe_customer_id) return;

        try {
            $invoices = \Stripe\Invoice::all([
                'customer' => $user->stripe_customer_id,
                'status'   => 'paid',
                'limit'    => 24,
            ]);
        } catch (ApiErrorException $e) {
            report($e);
            return;
        }

        foreach ($invoices->data as $invoice) {
            if (($invoice->amount_paid ?? 0) <= 0) continue;
            if (\App\Models\Payment::where('stripe_invoice_id', $invoice->id)->exists()) continue;

            $subscriptionId = is_string($invoice->subscription ?? null)
                ? $invoice->subscription
                : ($invoice->subscription->id ?? null);

            \App\Models\Payment::updateOrCreate(
                ['stripe_invoice_id' => $invoice->id],
                [
                    'user_id'         => $user->id,
                    'subscription_id' => $subscriptionId
                        ? Subscription::where('stripe_subscription_id', $subscriptionId)->value('id')
                        : null,
                    'amount_cents'    => $invoice->amount_paid,
                    'currency'        => strtoupper($invoice->currency ?? 'usd'),
                    'status'          => 'succeeded',
                    'paid_at'         => ($invoice->status_transitions->paid_at ?? null)
                        ? \Carbon\Carbon::createFromTimestampUTC($invoice->status_transitions->paid_at)
                        : \Carbon\Carbon::createFromTimestampUTC($invoice->created),
                ]
            );
        }
    }

    /**
     * Move an existing subscription to a different plan.
     *
     * The membership page offered "Choose Premium" to someone already on Basic
     * and then refused the checkout, pointing at billing settings that do not
     * exist — so a tiered product had no working way to move between its tiers.
     *
     * Stripe handles the money: swapping the price on the existing subscription
     * item with `proration_behavior: create_prorations` credits the unused part
     * of the current period and charges the difference. No second subscription
     * is created, so nobody ends up paying for two.
     */
    public function changePlan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_key' => 'required|string|in:basic,premium,annual_vip',
        ]);

        $user         = $request->user();
        $subscription = $user->activeSubscription();

        if (!$subscription) {
            return response()->json(['message' => 'You do not have a subscription to change.'], 404);
        }

        // Never trust a price from the client; look the plan up server-side.
        $plan = SubscriptionPlan::where('key', $validated['plan_key'])
            ->where('is_active', true)
            ->whereNotNull('stripe_price_id')
            ->first();

        if (!$plan) {
            return response()->json(['message' => 'That plan is not available.'], 422);
        }

        if ($subscription->plan_id === $plan->id) {
            return response()->json(['message' => 'You are already on that plan.'], 422);
        }

        $currentCents = $subscription->plan?->amount_cents ?? 0;
        $isUpgrade    = $plan->amount_cents > $currentCents;

        try {
            $stripeSub = \Stripe\Subscription::retrieve($subscription->stripe_subscription_id);
            $itemId    = $stripeSub->items->data[0]->id ?? null;
            $oldPrice  = $stripeSub->items->data[0]->price->id ?? null;

            if (!$itemId) {
                return response()->json(['message' => 'We could not change your plan. Please contact support.'], 502);
            }

            $updated = \Stripe\Subscription::update($subscription->stripe_subscription_id, [
                'items' => [['id' => $itemId, 'price' => $plan->stripe_price_id]],
                // An UPGRADE is billed now. `create_prorations` only records
                // line items to be settled on the NEXT invoice, so a member
                // could move to a dearer plan and use it for the rest of the
                // month having paid for the cheaper one — no charge, no card
                // prompt, nothing taken. `always_invoice` raises the prorated
                // invoice immediately and charges the card on file.
                //
                // A DOWNGRADE keeps `create_prorations`: the member is owed
                // money, and the credit belongs against their next invoice
                // rather than as an immediate refund.
                'proration_behavior' => $isUpgrade ? 'always_invoice' : 'create_prorations',
                // A pending cancellation would otherwise survive the change and
                // quietly end the plan they just moved to.
                'cancel_at_period_end' => false,
            ]);

            // Make sure the money actually moved before telling anyone it did.
            if ($isUpgrade) {
                $charge = $this->settleUpgradeInvoice($subscription->stripe_subscription_id);

                if (!$charge['paid']) {
                    // Put them back. Leaving someone on a plan they have not paid
                    // for is the exact fault this change set out to fix.
                    if ($oldPrice) {
                        $updated = \Stripe\Subscription::update($subscription->stripe_subscription_id, [
                            'items'              => [['id' => $itemId, 'price' => $oldPrice]],
                            'proration_behavior' => 'none',
                        ]);
                        $this->stripe->sync($updated);
                    }

                    return response()->json([
                        'message' => $charge['message'] ?? 'We could not take payment for that plan, so nothing has changed.',
                    ], 402);
                }
            }

            $this->stripe->sync($updated);
        } catch (CardException $e) {
            return response()->json(['message' => $e->getError()->message ?? 'Your card was declined.'], 402);
        } catch (ApiErrorException $e) {
            Log::error('Stripe plan change failed', [
                'user_id'      => $user->id,
                'subscription' => $subscription->stripe_subscription_id,
                'plan'         => $plan->key,
                'error'        => $e->getMessage(),
            ]);

            return response()->json(['message' => 'We could not change your plan. Please try again.'], 502);
        }

        return response()->json([
            'message' => $isUpgrade
                ? "You are now on {$plan->name}. The difference for the rest of this period has been charged to your card."
                : "You are now on {$plan->name}. The difference for the rest of this period is credited against your next invoice.",
        ]);
    }

    /**
     * Take payment for the invoice an upgrade just raised.
     *
     * `always_invoice` normally charges the card on file straight away, but the
     * invoice can come back `open` — a card needing authentication, a failure, or
     * Stripe simply not having finished. Rather than assume, this looks at the
     * invoice and, if it is still unpaid, asks for payment explicitly.
     *
     * @return array{paid: bool, message: ?string}
     */
    private function settleUpgradeInvoice(string $stripeSubscriptionId): array
    {
        $invoice = \Stripe\Invoice::all([
            'subscription' => $stripeSubscriptionId,
            'limit'        => 1,
        ])->data[0] ?? null;

        if (!$invoice) {
            // Nothing to pay — a zero-value proration, for instance.
            return ['paid' => true, 'message' => null];
        }

        if ($invoice->status === 'paid' || $invoice->total <= 0) {
            return ['paid' => true, 'message' => null];
        }

        try {
            $invoice = \Stripe\Invoice::retrieve($invoice->id)->pay();
        } catch (CardException $e) {
            return ['paid' => false, 'message' => $e->getError()->message ?? 'Your card was declined.'];
        } catch (ApiErrorException $e) {
            Log::warning('Upgrade invoice could not be paid', [
                'invoice' => $invoice->id,
                'error'   => $e->getMessage(),
            ]);

            return ['paid' => false, 'message' => 'We could not take payment for that plan, so nothing has changed.'];
        }

        return ['paid' => $invoice->status === 'paid', 'message' => $invoice->status === 'paid'
            ? null
            : 'We could not take payment for that plan, so nothing has changed.'];
    }

    public function cancel(Request $request): JsonResponse
    {
        $user         = $request->user();
        $subscription = $user->activeSubscription();

        if (!$subscription) {
            return response()->json(['message' => 'You do not have an active subscription.'], 404);
        }

        try {
            $sub = \Stripe\Subscription::update($subscription->stripe_subscription_id, [
                'cancel_at_period_end' => true,
            ]);
            $this->stripe->sync($sub);
        } catch (ApiErrorException $e) {
            Log::error('Stripe cancellation failed', [
                'user_id'      => $user->id,
                'subscription' => $subscription->stripe_subscription_id,
                'error'        => $e->getMessage(),
            ]);

            return response()->json(['message' => 'We could not cancel your subscription. Please try again.'], 502);
        }

        return response()->json([
            'message' => 'Your subscription will end on ' . $subscription->fresh()->current_period_end?->format('j F Y') . '.',
        ]);
    }

    /**
     * Undo a pending cancellation.
     */
    public function resume(Request $request): JsonResponse
    {
        $user = $request->user();

        $subscription = $user->subscriptions()
            ->whereIn('status', Subscription::ENTITLED_STATUSES)
            ->where('cancel_at_period_end', true)
            ->latest('id')
            ->first();

        if (!$subscription) {
            return response()->json(['message' => 'You do not have a cancellation to undo.'], 404);
        }

        try {
            $sub = \Stripe\Subscription::update($subscription->stripe_subscription_id, [
                'cancel_at_period_end' => false,
            ]);
            $this->stripe->sync($sub);
        } catch (ApiErrorException $e) {
            Log::error('Stripe resume failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json(['message' => 'We could not resume your subscription. Please try again.'], 502);
        }

        return response()->json(['message' => 'Your subscription will continue.']);
    }
}
