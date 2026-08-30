<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailCampaignRecipient extends Model
{
    public $timestamps = false;

    protected $fillable = ['campaign_id', 'user_id', 'sent_at', 'error'];

    protected $casts = ['sent_at' => 'datetime'];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(EmailCampaign::class, 'campaign_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
