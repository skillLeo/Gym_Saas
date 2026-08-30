<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PhysicianMessage extends Model
{
    protected $fillable = ['coaching_authorization_id', 'sender_type', 'sender_id', 'body', 'read_at'];

    protected $casts = ['read_at' => 'datetime'];

    public function authorization(): BelongsTo
    {
        return $this->belongsTo(CoachingAuthorization::class, 'coaching_authorization_id');
    }
}
