<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailCampaign extends Model
{
    protected $fillable = [
        'subject', 'body_html', 'audience', 'audience_params',
        'status', 'scheduled_at', 'sent_at', 'recipient_count', 'created_by',
    ];

    protected $casts = [
        'audience_params' => 'array',
        'scheduled_at'     => 'datetime',
        'sent_at'          => 'datetime',
        'recipient_count'  => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(EmailCampaignRecipient::class, 'campaign_id');
    }
}
