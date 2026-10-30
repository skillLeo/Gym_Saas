<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One AI call. See the migration for what is deliberately not stored here.
 */
class AiUsageLog extends Model
{
    /** Rows are immutable once written, so there is no updated_at. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'feature', 'model', 'input_tokens', 'output_tokens',
        'estimated_cost_usd', 'status', 'latency_ms',
    ];

    protected $casts = [
        'input_tokens'       => 'integer',
        'output_tokens'      => 'integer',
        'estimated_cost_usd' => 'float',
        'latency_ms'         => 'integer',
        'created_at'         => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
