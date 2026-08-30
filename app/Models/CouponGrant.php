<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CouponGrant extends Model
{
    protected $fillable = [
        'user_id', 'coupon_offer_id', 'code', 'stripe_promotion_code_id',
        'sent_at', 'expires_at', 'redeemed_at', 'redeemed_payment_id',
    ];

    protected $casts = [
        'sent_at'     => 'datetime',
        'expires_at'  => 'datetime',
        'redeemed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function offer()
    {
        return $this->belongsTo(CouponOffer::class, 'coupon_offer_id');
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class, 'redeemed_payment_id');
    }

    public function isRedeemed(): bool
    {
        return $this->redeemed_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /** Usable right now? Redeemed codes and lapsed codes are both dead. */
    public function isRedeemable(): bool
    {
        return !$this->isRedeemed() && !$this->isExpired();
    }

    public function scopeRedeemable($query)
    {
        return $query->whereNull('redeemed_at')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            });
    }
}
