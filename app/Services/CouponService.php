<?php

namespace App\Services;

use App\Models\CouponGrant;
use App\Models\CouponOffer;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Stripe\Stripe;

/**
 * Trial conversion coupons (§4.3).
 *
 * Stripe models discounts in two layers and this mirrors them:
 *   - a **Coupon** holds the discount itself, created once per offer
 *   - a **Promotion Code** is a redeemable string pointing at that coupon,
 *     created per user so redemption is attributable to one person
 *
 * A single shared code would tell us an offer converted but never who, and
 * would leak: one customer posting it publicly discounts everyone.
 */
class CouponService
{
    /**
     * Characters used in generated codes.
     *
     * No 0/O/1/I/L — these are read aloud, retyped from an email, and
     * occasionally dictated over the phone.
     */
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Largest fixed discount that is safe to offer, in whole currency units.
     *
     * Bounded by the cheapest active plan: a $15 discount on a $9.99 plan is
     * not a discount, it is a negative invoice.
     */
    public function maxFixedDiscount(): float
    {
        $cheapest = SubscriptionPlan::where('is_active', true)->min('amount_cents');

        return $cheapest ? $cheapest / 100 : 0.0;
    }

    /**
     * Validate a discount before it can be saved.
     *
     * The brief is explicit that an admin must not be able to create a 200%
     * coupon. Returns an error string, or null when acceptable.
     */
    public function validateDiscount(string $type, float $value): ?string
    {
        if ($value <= 0) {
            return 'The discount must be greater than zero.';
        }

        if ($type === 'percent') {
            return $value > 100
                ? 'A percentage discount cannot be more than 100%.'
                : null;
        }

        $max = $this->maxFixedDiscount();

        if ($max <= 0) {
            return 'No active plan exists to validate a fixed discount against.';
        }

        return $value > $max
            ? sprintf('A fixed discount cannot exceed the cheapest plan price ($%s).', number_format($max, 2))
            : null;
    }

    /**
     * Ensure the offer has a Stripe Coupon backing it, creating one if needed.
     *
     * Stripe coupons are immutable, so changing the discount creates a new one
     * and repoints the offer. Codes already issued keep working at the rate
     * they were promised — withdrawing a discount someone was emailed would be
     * a broken promise, not a correction.
     */
    public function ensureStripeCoupon(CouponOffer $offer): string
    {
        if ($offer->stripe_coupon_id && $this->stripeCouponMatches($offer)) {
            return $offer->stripe_coupon_id;
        }

        $payload = [
            'name'     => $offer->name,
            'duration' => 'once',
            'metadata' => ['offer_key' => $offer->key, 'stage' => (string) $offer->stage],
        ];

        if ($offer->discount_type === 'percent') {
            $payload['percent_off'] = (float) $offer->discount_value;
        } else {
            $payload['amount_off'] = (int) round((float) $offer->discount_value * 100);
            $payload['currency']   = 'usd';
        }

        $coupon = \Stripe\Coupon::create($payload);
        $offer->update(['stripe_coupon_id' => $coupon->id]);

        return $coupon->id;
    }

    /**
     * Issue an offer to a user.
     *
     * Idempotent by database constraint: the UNIQUE on
     * (user_id, coupon_offer_id) is what actually prevents a second grant, so
     * two overlapping scheduler runs cannot both send the same offer.
     *
     * Returns null when the user already has this offer.
     */
    public function grant(User $user, CouponOffer $offer): ?CouponGrant
    {
        try {
            $grant = DB::transaction(function () use ($user, $offer) {
                return CouponGrant::create([
                    'user_id'         => $user->id,
                    'coupon_offer_id' => $offer->id,
                    'code'            => $this->generateCode(),
                    'expires_at'      => now()->addDays($offer->expires_after_days),
                ]);
            });
        } catch (UniqueConstraintViolationException $e) {
            return null; // Already granted.
        }

        // Stripe is contacted after the row exists, so a failure here leaves a
        // recoverable grant rather than an untracked promotion code.
        try {
            $couponId  = $this->ensureStripeCoupon($offer);
            $promotion = \Stripe\PromotionCode::create([
                // As of API 2026-07-29 the coupon is nested under `promotion`
                // with an explicit type; a top-level `coupon` key is rejected
                // with "Received unknown parameter: coupon". The `list`
                // endpoint still accepts it as a filter, which makes the old
                // shape look valid.
                'promotion'       => ['type' => 'coupon', 'coupon' => $couponId],
                'code'            => $grant->code,
                'max_redemptions' => 1,
                'expires_at'      => $grant->expires_at->timestamp,
                'metadata'        => [
                    'user_id'  => (string) $user->id,
                    'grant_id' => (string) $grant->id,
                ],
            ]);

            $grant->update(['stripe_promotion_code_id' => $promotion->id]);
        } catch (\Throwable $e) {
            Log::error('Stripe promotion code creation failed', [
                'grant_id' => $grant->id,
                'user_id'  => $user->id,
                'error'    => $e->getMessage(),
            ]);
            // The grant stays without a Stripe code. resolveForCheckout()
            // refuses to apply it, so the user is never shown a code that
            // would fail at the till.
        }

        return $grant->fresh();
    }

    /**
     * Look up a code a user is trying to use at checkout.
     *
     * Returns [grant, error]. The error is user-facing and deliberately
     * distinguishes "not yours", "already used" and "expired" — a single
     * "invalid code" message turns a fixable situation into a support ticket.
     *
     * @return array{0: ?CouponGrant, 1: ?string}
     */
    public function resolveForCheckout(User $user, string $code): array
    {
        $grant = CouponGrant::with('offer')
            ->whereRaw('UPPER(code) = ?', [strtoupper(trim($code))])
            ->first();

        if (!$grant) {
            return [null, 'That code was not recognised.'];
        }

        // Never confirm that someone else's code exists.
        if ($grant->user_id !== $user->id) {
            return [null, 'That code was not recognised.'];
        }

        if ($grant->isRedeemed()) {
            return [null, 'That code has already been used.'];
        }

        if ($grant->isExpired()) {
            return [null, 'That code has expired.'];
        }

        if (!$grant->stripe_promotion_code_id) {
            Log::warning('Coupon grant has no Stripe promotion code', ['grant_id' => $grant->id]);

            return [null, 'That code cannot be applied right now. Please contact support.'];
        }

        if (!$grant->offer || !$grant->offer->is_active) {
            return [null, 'That offer is no longer available.'];
        }

        return [$grant, null];
    }

    /**
     * Mark a grant as redeemed once a payment has actually succeeded.
     *
     * Called from the webhook, not from checkout: a code is only spent when
     * money moves, so an abandoned checkout does not burn the customer's offer.
     */
    public function markRedeemed(CouponGrant $grant, ?int $paymentId = null): void
    {
        if ($grant->isRedeemed()) {
            return;
        }

        $grant->update([
            'redeemed_at'         => now(),
            'redeemed_payment_id' => $paymentId,
        ]);

        Log::info('Coupon redeemed', [
            'grant_id' => $grant->id,
            'user_id'  => $grant->user_id,
            'offer'    => $grant->offer?->key,
        ]);
    }

    /**
     * Which offer, if any, is this user due right now?
     *
     * Timing is measured from the trial start, and the offer must still land
     * inside the trial — an offer that arrives after the trial has ended is a
     * discount on a decision the user has already made.
     */
    public function dueOfferFor(User $user): ?CouponOffer
    {
        if (!$user->trial_starts_at || !$user->trial_ends_at) {
            return null;
        }

        $dayOfTrial = (int) floor($user->trial_starts_at->diffInDays(now(), false));

        // The funnel only ever moves forward. Excluding just the offers already
        // granted is not enough: someone who received stage 2 at day 18 would
        // still match stage 1 on the next run, because stage 1's trigger day
        // has also passed. They would be sent the *stronger* earlier discount
        // after ignoring the weaker one — rewarding delay and inverting the
        // funnel the stages exist to express.
        $highestGranted = (int) CouponGrant::where('user_id', $user->id)
            ->join('coupon_offers', 'coupon_offers.id', '=', 'coupon_grants.coupon_offer_id')
            ->max('coupon_offers.stage');

        return CouponOffer::where('is_active', true)
            ->where('trigger_day_offset', '<=', $dayOfTrial)
            ->where('stage', '>', $highestGranted)
            // Later stages first: if several became due at once (a scheduler
            // that was down for a while), send the one that fits where the user
            // actually is rather than working through a backlog of stale offers.
            ->orderByDesc('stage')
            ->first();
    }

    /**
     * A readable, unambiguous code. Collisions are resolved by retrying.
     */
    private function generateCode(): string
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $body = '';
            for ($i = 0; $i < 8; $i++) {
                $body .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
            $code = 'MXT-' . $body;

            if (!CouponGrant::where('code', $code)->exists()) {
                return $code;
            }
        }

        // Astronomically unlikely; fall back to something guaranteed unique
        // rather than looping forever.
        return 'MXT-' . strtoupper(Str::random(12));
    }

    private function stripeCouponMatches(CouponOffer $offer): bool
    {
        try {
            $coupon = \Stripe\Coupon::retrieve($offer->stripe_coupon_id);
        } catch (\Throwable $e) {
            return false;
        }

        if (!$coupon->valid) {
            return false;
        }

        return $offer->discount_type === 'percent'
            ? (float) $coupon->percent_off === (float) $offer->discount_value
            : (int) $coupon->amount_off === (int) round((float) $offer->discount_value * 100);
    }
}
