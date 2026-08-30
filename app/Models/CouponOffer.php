<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CouponOffer extends Model
{
    protected $fillable = [
        'key', 'name', 'stage', 'trigger_day_offset', 'expires_after_days',
        'discount_type', 'discount_value', 'stripe_coupon_id',
        'email_subject', 'email_body_html', 'is_active',
    ];

    protected $casts = [
        'is_active'          => 'boolean',
        'stage'              => 'integer',
        'trigger_day_offset' => 'integer',
        'expires_after_days' => 'integer',
        'discount_value'     => 'decimal:2',
    ];

    public function grants()
    {
        return $this->hasMany(CouponGrant::class);
    }

    /** Human-readable discount, e.g. "25% off" or "$5.00 off". */
    public function getDiscountLabelAttribute(): string
    {
        return $this->discount_type === 'percent'
            ? rtrim(rtrim(number_format((float) $this->discount_value, 2, '.', ''), '0'), '.') . '% off'
            : '$' . number_format((float) $this->discount_value, 2) . ' off';
    }

    /**
     * What this offer takes off a given price, in cents.
     *
     * Clamped at the price itself so a fixed discount larger than the plan can
     * never produce a negative charge.
     */
    public function discountCentsFor(int $priceCents): int
    {
        $cents = $this->discount_type === 'percent'
            ? (int) round($priceCents * ((float) $this->discount_value / 100))
            : (int) round((float) $this->discount_value * 100);

        return max(0, min($cents, $priceCents));
    }
}
