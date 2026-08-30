<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'subscription_id', 'stripe_invoice_id', 'stripe_payment_intent_id',
        'amount_cents', 'currency', 'status', 'failure_reason', 'paid_at',
    ];

    protected $casts = [
        'paid_at'      => 'datetime',
        'amount_cents' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function subscription()
    {
        return $this->belongsTo(Subscription::class);
    }

    public function getAmountAttribute(): float
    {
        return $this->amount_cents / 100;
    }
}
