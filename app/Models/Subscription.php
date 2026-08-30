<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    use HasFactory;

    /**
     * Statuses that entitle a user to paid features.
     *
     * `past_due` is deliberately included: Stripe retries a failed renewal for
     * days, and locking someone out on the first failed retry — when their card
     * may simply have expired — loses customers who would have paid. They keep
     * access until Stripe gives up and moves them to `unpaid`/`canceled`.
     */
    public const ENTITLED_STATUSES = ['trialing', 'active', 'past_due'];

    protected $fillable = [
        'user_id', 'plan_id', 'stripe_subscription_id', 'stripe_customer_id',
        'status', 'current_period_start', 'current_period_end',
        'cancel_at_period_end', 'canceled_at', 'ended_at',
    ];

    protected $casts = [
        'current_period_start' => 'datetime',
        'current_period_end'   => 'datetime',
        'canceled_at'          => 'datetime',
        'ended_at'             => 'datetime',
        'cancel_at_period_end' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function scopeEntitled($query)
    {
        return $query->whereIn('status', self::ENTITLED_STATUSES);
    }

    public function isEntitled(): bool
    {
        return in_array($this->status, self::ENTITLED_STATUSES, true);
    }
}
