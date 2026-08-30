<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StripeWebhookEvent extends Model
{
    use HasFactory;

    public const STATUS_PENDING   = 'pending';
    public const STATUS_PROCESSED = 'processed';
    public const STATUS_FAILED    = 'failed';

    protected $fillable = [
        'stripe_event_id', 'type', 'payload', 'status',
        'processed_at', 'attempts', 'last_error',
    ];

    protected $casts = [
        'payload'      => 'array',
        'processed_at' => 'datetime',
        'attempts'     => 'integer',
    ];

    public function markProcessed(): void
    {
        $this->update([
            'status'       => self::STATUS_PROCESSED,
            'processed_at' => now(),
            'last_error'   => null,
        ]);
    }

    public function markFailed(string $error): void
    {
        $this->update([
            'status'     => self::STATUS_FAILED,
            // Truncate: a Stripe stack trace can exceed the TEXT column and
            // throw while recording the original failure, hiding both.
            'last_error' => mb_substr($error, 0, 60000),
        ]);
    }
}
