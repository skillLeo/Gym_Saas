<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CoachingAuthorization extends Model
{
    public const PENDING  = 'pending';
    public const APPROVED = 'approved';
    public const REJECTED = 'rejected';
    public const REVOKED  = 'revoked';

    protected $fillable = [
        'member_id', 'physician_name', 'practice_name', 'practice_address', 'practice_phone',
        'representative_name', 'representative_email', 'status', 'reviewed_by', 'reviewed_at',
        'rejection_reason', 'physician_id', 'invite_token_hash', 'invite_expires_at',
        'authorized_at', 'revoked_at',
    ];

    protected $casts = [
        'reviewed_at'       => 'datetime',
        'invite_expires_at' => 'datetime',
        'authorized_at'     => 'datetime',
        'revoked_at'        => 'datetime',
    ];

    /** Never expose the token hash through any API response. */
    protected $hidden = ['invite_token_hash'];

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'member_id');
    }

    public function physician(): BelongsTo
    {
        return $this->belongsTo(Physician::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(PhysicianMessage::class);
    }

    /** The only state from which a physician may read data. */
    public function isActivelyAuthorized(): bool
    {
        return $this->status === self::APPROVED
            && $this->revoked_at === null
            && $this->physician_id !== null;
    }
}
