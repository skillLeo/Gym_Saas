<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ContentFlag extends Model
{
    protected $fillable = [
        'flaggable_type', 'flaggable_id', 'reason', 'matched_terms',
        'reported_by', 'severity', 'status', 'reviewed_by', 'reviewed_at', 'notes',
    ];

    protected $casts = [
        'matched_terms' => 'array',
        'reviewed_at'   => 'datetime',
    ];

    public function flaggable(): MorphTo
    {
        return $this->morphTo();
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
