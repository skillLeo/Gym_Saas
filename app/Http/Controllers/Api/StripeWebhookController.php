<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CouponGrant;
use App\Models\Payment;
use App\Models\StripeWebhookEvent;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CouponService;
use App\Services\StripeSubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Stripe;
use Stripe\Webhook;

/**
 * Receives Stripe webhooks.
 *
 * Runs outside `auth:sanctum` and `verified.email` — Stripe is not a logged-in
 * user. Authentication is the signature check below, which is the only thing
 * standing between this endpoint and anyone who knows the URL. Without it,
 * a forged `invoice.payment_succeeded` would hand out free subscriptions.
 */
class StripeWebhookController extends Controller
{
    /** Events acted upon. Anything else is recorded and acknowledged. */
    private const HANDLED = [
        'checkout.session.completed',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ];

    public function __construct(private StripeSubscriptionService $stripe)
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    public function handle(Request $request): JsonResponse
    {
        $secret = config('services.stripe.webhook_secret');

        if (blank($secret)) {
            // Failing closed: without a secret every payload is unverifiable,
            // and accepting them would let anyone grant themselves a plan.
            Log::critical('STRIPE_WEBHOOK_SECRET is not configured; webhook rejected.');

            return response()->json(['message' => 'Webhook not configured.'], 500);
        }

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                $request->header('Stripe-Signature') ?? '',
                $secret
            );
        } catch (SignatureVerificationException $e) {
            Log::warning('Rejected Stripe webhook with an invalid signature', [
                'error' => $e->getMessage(),
                'ip'    => $request->ip(),
            ]);

            return response()->json(['message' => 'Invalid signature.'], 400);
        } catch (\UnexpectedValueException $e) {
            return response()->json(['message' => 'Invalid payload.'], 400);
        }

        // Idempotency step 1: claim the event. The UNIQUE index on
        // stripe_event_id is what actually prevents duplicates — a
        // SELECT-then-INSERT check would leave a race window exactly when
        // concurrent retries arrive.
        try {
            StripeWebhookEvent::create([
                'stripe_event_id' => $event->id,
                'type'            => $event->type,
                'payload'         => $event->toArray(),
                'status'          => StripeWebhookEvent::STATUS_PENDING,
            ]);
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            // Already seen. Fall through — the locked check below decides
            // whether this is a redelivery of something already done or a
            // retry of something that failed.
        }

        $alreadyProcessed = false;

        try {
            DB::transaction(function () use ($event, &$alreadyProcessed) {
                // Idempotency step 2: serialise concurrent deliveries of the
                // same event. The second one blocks here until the first
                // commits, then sees `processed` and does nothing.
                $record = StripeWebhookEvent::where('stripe_event_id', $event->id)
                    ->lockForUpdate()
                    ->first();

                if (!$record || $record->status === StripeWebhookEvent::STATUS_PROCESSED) {
                    $alreadyProcessed = true;

                    return;
                }

                $record->increment('attempts');

                if (in_array($event->type, self::HANDLED, true)) {
                    $this->dispatchEvent($event);
                }

                // Marking processed inside the same transaction as the effects
                // means a crash mid-handler rolls both back together, so a
                // retry re-runs cleanly instead of half-applying.
                $record->markProcessed();
            });
        } catch (\Throwable $e) {
            Log::error('Stripe webhook processing failed', [
                'event_id' => $event->id,
                'type'     => $event->type,
                'error'    => $e->getMessage(),
            ]);

            StripeWebhookEvent::where('stripe_event_id', $event->id)
                ->first()?->markFailed($e->getMessage());

            // 500 asks Stripe to retry. The ledger row is left unprocessed so
            // the retry is allowed through.
            return response()->json(['message' => 'Processing failed.'], 500);
        }

        return response()->json([
            'received'  => true,
            'duplicate' => $alreadyProcessed,
        ]);
    }

    private function dispatchEvent(\Stripe\Event $event): void
    {
        $object = $event->data->object;

        match ($event->type) {
            'invoice.payment_succeeded'     => $this->onInvoicePaid($object, 'succeeded'),
            'invoice.payment_failed'        => $this->onInvoicePaid($object, 'failed'),
            'customer.subscription.updated',
            'customer.subscription.deleted' => $this->onSubscriptionChanged($object),
            'checkout.session.completed'    => $this->onCheckoutCompleted($object),
            default                         => null,
        };
    }

    /**
     * Record an invoice outcome and refresh the subscription it belongs to.
     */
    private function onInvoicePaid(\Stripe\Invoice $invoice, string $status): void
    {
        $subscriptionId = $this->subscriptionIdFromInvoice($invoice);
        $localSub       = $subscriptionId
            ? Subscription::where('stripe_subscription_id', $subscriptionId)->first()
            : null;

        $user = $this->resolveUserFromInvoice($invoice, $localSub);

        if (!$user) {
            Log::warning('Stripe invoice could not be matched to a user', [
                'invoice'      => $invoice->id,
                'subscription' => $subscriptionId,
            ]);

            return;
        }

        // updateOrCreate on the UNIQUE invoice ID: a replayed event updates the
        // existing row rather than recording the same charge twice.
        $payment = Payment::updateOrCreate(
            ['stripe_invoice_id' => $invoice->id],
            [
                'user_id'                  => $user->id,
                'subscription_id'          => $localSub?->id,
                'stripe_payment_intent_id' => $this->paymentIntentFromInvoice($invoice),
                'amount_cents'             => $status === 'succeeded'
                    ? ($invoice->amount_paid ?? $invoice->amount_due ?? 0)
                    : ($invoice->amount_due ?? 0),
                'currency'                 => strtoupper($invoice->currency ?? 'usd'),
                'status'                   => $status,
                'failure_reason'           => $status === 'failed'
                    ? ($invoice->last_finalization_error->message ?? 'The payment was declined.')
                    : null,
                'paid_at'                  => $status === 'succeeded'
                    ? ($invoice->status_transitions->paid_at ?? null
                        ? Carbon::createFromTimestampUTC($invoice->status_transitions->paid_at)
                        : now())
                    : null,
            ]
        );

        // Pull the subscription fresh from Stripe rather than trusting the
        // invoice's embedded copy, which can lag behind the current status.
        $stripeSub = null;
        if ($subscriptionId) {
            $stripeSub = \Stripe\Subscription::retrieve(['id' => $subscriptionId, 'expand' => ['items']]);
            $this->stripe->sync($stripeSub);
        } else {
            $this->stripe->syncUserStatus($user);
        }

        // A coupon is only spent when money actually moves. Doing this at
        // checkout instead would burn a one-time code on an abandoned form.
        if ($status === 'succeeded' && $stripeSub) {
            $this->redeemCouponFor($stripeSub, $payment);
        }
    }

    private function onSubscriptionChanged(\Stripe\Subscription $sub): void
    {
        $this->stripe->sync($sub);
    }

    /**
     * Mark a coupon grant redeemed after a successful payment.
     *
     * The grant ID travels in subscription metadata, set at checkout, so this
     * does not have to reverse-engineer which code was used from the invoice.
     * Safe to re-run: markRedeemed() ignores an already-redeemed grant, so a
     * replayed invoice event cannot rewrite the redemption timestamp.
     */
    private function redeemCouponFor(\Stripe\Subscription $sub, ?Payment $payment): void
    {
        $grantId = $sub->metadata['coupon_grant_id'] ?? null;
        if (!$grantId) {
            return;
        }

        $grant = CouponGrant::find((int) $grantId);
        if (!$grant) {
            Log::warning('Subscription referenced a coupon grant that no longer exists', [
                'subscription' => $sub->id,
                'grant_id'     => $grantId,
            ]);

            return;
        }

        app(CouponService::class)->markRedeemed($grant, $payment?->id);
    }

    private function onCheckoutCompleted(\Stripe\Checkout\Session $session): void
    {
        if (!$session->subscription) {
            return;
        }

        $id = is_string($session->subscription) ? $session->subscription : $session->subscription->id;

        $this->stripe->sync(\Stripe\Subscription::retrieve(['id' => $id, 'expand' => ['items']]));
    }

    /**
     * Find the subscription ID on an invoice.
     *
     * Stripe moved this from `invoice.subscription` to
     * `invoice.parent.subscription_details.subscription` in the 2025-03-31 API.
     * Both are checked so this keeps working across a version bump either way.
     */
    private function subscriptionIdFromInvoice(\Stripe\Invoice $invoice): ?string
    {
        $candidates = [
            $invoice->subscription ?? null,
            $invoice->parent->subscription_details->subscription ?? null,
            $invoice->lines->data[0]->parent->subscription_item_details->subscription ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && $candidate !== '') {
                return $candidate;
            }
            if (is_object($candidate) && isset($candidate->id)) {
                return $candidate->id;
            }
        }

        return null;
    }

    private function paymentIntentFromInvoice(\Stripe\Invoice $invoice): ?string
    {
        $candidates = [
            $invoice->payment_intent ?? null,
            $invoice->payments->data[0]->payment->payment_intent ?? null,
            $invoice->confirmation_secret->payment_intent ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && $candidate !== '') {
                return $candidate;
            }
            if (is_object($candidate) && isset($candidate->id)) {
                return $candidate->id;
            }
        }

        return null;
    }

    private function resolveUserFromInvoice(\Stripe\Invoice $invoice, ?Subscription $localSub): ?User
    {
        if ($localSub) {
            return $localSub->user;
        }

        $customerId = is_string($invoice->customer) ? $invoice->customer : ($invoice->customer->id ?? null);

        return $customerId ? User::where('stripe_customer_id', $customerId)->first() : null;
    }
}
