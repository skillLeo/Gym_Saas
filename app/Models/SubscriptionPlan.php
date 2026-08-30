<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    use HasFactory;

    public const KEY_BASIC      = 'basic';
    public const KEY_PREMIUM    = 'premium';
    public const KEY_ANNUAL_VIP = 'annual_vip';

    protected $fillable = [
        'key', 'name', 'description', 'stripe_price_id', 'amount_cents',
        'currency', 'interval', 'features', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'features'     => 'array',
        'is_active'    => 'boolean',
        'amount_cents' => 'integer',
        'sort_order'   => 'integer',
    ];

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class, 'plan_id');
    }

    /** Price in whole currency units, for display only. */
    public function getAmountAttribute(): float
    {
        return $this->amount_cents / 100;
    }

    /**
     * What this plan costs per month, in cents.
     *
     * Lets the pricing page compare an annual plan against monthly ones on the
     * same axis without hardcoding "divide by 12" in the UI.
     */
    public function getMonthlyEquivalentCentsAttribute(): int
    {
        return $this->interval === 'year'
            ? (int) round($this->amount_cents / 12)
            : $this->amount_cents;
    }
}
