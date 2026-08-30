<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VibeThreadMute extends Model
{
    protected $fillable = ['user_id', 'muted_until'];

    protected $casts = ['muted_until' => 'datetime'];

    public function user() { return $this->belongsTo(User::class); }

    /**
     * Is this mute in force right now?
     *
     * A null `muted_until` is indefinite; a past timestamp has lapsed and the
     * row is treated as inactive without needing to be deleted.
     */
    public function isActive(): bool
    {
        return $this->muted_until === null || $this->muted_until->isFuture();
    }
}
