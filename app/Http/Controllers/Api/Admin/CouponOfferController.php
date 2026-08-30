<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CouponGrant;
use App\Models\CouponOffer;
use App\Services\CouponService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Admin CRUD for conversion offers (§4.3).
 *
 * Copy, discount and timing are all editable here so the client can run the
 * funnel without a developer.
 */
class CouponOfferController extends Controller
{
    public function __construct(private CouponService $coupons) {}

    public function index(): JsonResponse
    {
        $offers = CouponOffer::withCount([
            'grants',
            'grants as redeemed_count' => fn ($q) => $q->whereNotNull('redeemed_at'),
        ])->orderBy('stage')->get();

        return response()->json([
            'data' => $offers->map(fn (CouponOffer $o) => $this->format($o)),
            'meta' => [
                // Surfaced so the admin form can show the bound rather than
                // only rejecting a value after the fact.
                'max_fixed_discount' => $this->coupons->maxFixedDiscount(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request);

        if ($error = $this->coupons->validateDiscount($data['discount_type'], (float) $data['discount_value'])) {
            return response()->json(['message' => $error, 'field' => 'discount_value'], 422);
        }

        $offer = CouponOffer::create($data);

        return response()->json(['data' => $this->format($offer)], 201);
    }

    public function update(Request $request, CouponOffer $couponOffer): JsonResponse
    {
        $data = $this->validatePayload($request, $couponOffer->id);

        if ($error = $this->coupons->validateDiscount($data['discount_type'], (float) $data['discount_value'])) {
            return response()->json(['message' => $error, 'field' => 'discount_value'], 422);
        }

        $discountChanged = $data['discount_type'] !== $couponOffer->discount_type
            || (float) $data['discount_value'] !== (float) $couponOffer->discount_value;

        $couponOffer->update($data);

        // Stripe coupons are immutable. Clearing the link makes the next grant
        // create a fresh one; codes already issued keep the rate they were
        // promised, because withdrawing an emailed discount is a broken promise
        // rather than a correction.
        if ($discountChanged) {
            $couponOffer->update(['stripe_coupon_id' => null]);
        }

        return response()->json([
            'data'    => $this->format($couponOffer->fresh()),
            'message' => $discountChanged
                ? 'Saved. Codes already sent keep their original discount.'
                : 'Saved.',
        ]);
    }

    /**
     * Deactivate rather than delete when codes are already in the wild.
     *
     * Hard-deleting would cascade to `coupon_grants` and destroy the record of
     * offers people were sent — including ones they redeemed and paid against.
     */
    public function destroy(CouponOffer $couponOffer): JsonResponse
    {
        if ($couponOffer->grants()->exists()) {
            $couponOffer->update(['is_active' => false]);

            return response()->json([
                'message' => 'This offer has already been sent to members, so it was deactivated rather than deleted. Its history is preserved.',
                'data'    => $this->format($couponOffer->fresh()),
            ]);
        }

        $couponOffer->delete();

        return response()->json(['message' => 'Offer deleted.']);
    }

    /**
     * Redemption performance per offer.
     */
    public function stats(): JsonResponse
    {
        $offers = CouponOffer::orderBy('stage')->get();

        return response()->json([
            'data' => $offers->map(function (CouponOffer $offer) {
                $sent     = $offer->grants()->whereNotNull('sent_at')->count();
                $redeemed = $offer->grants()->whereNotNull('redeemed_at')->count();
                $expired  = $offer->grants()->whereNull('redeemed_at')
                    ->whereNotNull('expires_at')->where('expires_at', '<', now())->count();

                return [
                    'key'             => $offer->key,
                    'name'            => $offer->name,
                    'stage'           => $offer->stage,
                    'discount'        => $offer->discount_label,
                    'sent'            => $sent,
                    'redeemed'        => $redeemed,
                    'expired_unused'  => $expired,
                    // Null rather than 0 when nothing has been sent — a 0%
                    // conversion rate on zero sends is not a fact, and reads
                    // as failure when it means "no data".
                    'conversion_rate' => $sent > 0 ? round($redeemed / $sent * 100, 1) : null,
                ];
            }),
        ]);
    }

    /**
     * Send a test of this offer's email to the requesting admin.
     */
    public function preview(Request $request, CouponOffer $couponOffer): JsonResponse
    {
        $admin = $request->user();

        // A throwaway unsaved grant: previewing must not consume a real code or
        // count against the recipient's one-offer-per-stage limit.
        $grant = new CouponGrant([
            'user_id'         => $admin->id,
            'coupon_offer_id' => $couponOffer->id,
            'code'            => 'MXT-PREVIEW',
            'expires_at'      => now()->addDays($couponOffer->expires_after_days),
        ]);
        $grant->setRelation('offer', $couponOffer);
        $grant->setRelation('user', $admin);

        try {
            \Illuminate\Support\Facades\Mail::to($admin->email)->send(new \App\Mail\CouponOfferMail($grant));
        } catch (\Throwable $e) {
            Log::error('Coupon preview send failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not send the preview. Check the mail settings.'], 502);
        }

        return response()->json(['message' => "Preview sent to {$admin->email}."]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'key'                => 'required|string|max:60|alpha_dash|unique:coupon_offers,key' . ($ignoreId ? ',' . $ignoreId : ''),
            'name'               => 'required|string|max:255',
            'stage'              => 'required|integer|min:1|max:10',
            'trigger_day_offset' => 'required|integer|min:0|max:365',
            'expires_after_days' => 'required|integer|min:1|max:90',
            'discount_type'      => 'required|in:percent,fixed',
            // Bounds here are a first line only — validateDiscount() applies the
            // real rule, since the fixed cap depends on live plan prices.
            'discount_value'     => 'required|numeric|min:0.01|max:100000',
            'email_subject'      => 'required|string|max:255',
            'email_body_html'    => 'required|string|max:65000',
            'is_active'          => 'nullable|boolean',
        ]);
    }

    private function format(CouponOffer $offer): array
    {
        return [
            'id'                 => $offer->id,
            'key'                => $offer->key,
            'name'               => $offer->name,
            'stage'              => $offer->stage,
            'trigger_day_offset' => $offer->trigger_day_offset,
            'expires_after_days' => $offer->expires_after_days,
            'discount_type'      => $offer->discount_type,
            'discount_value'     => (float) $offer->discount_value,
            'discount_label'     => $offer->discount_label,
            'stripe_coupon_id'   => $offer->stripe_coupon_id,
            'email_subject'      => $offer->email_subject,
            'email_body_html'    => $offer->email_body_html,
            'is_active'          => $offer->is_active,
            'grants_count'       => $offer->grants_count ?? null,
            'redeemed_count'     => $offer->redeemed_count ?? null,
        ];
    }
}
