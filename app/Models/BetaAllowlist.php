<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BetaAllowlist extends Model
{
    protected $table = 'beta_allowlist';

    protected $fillable = ['email', 'note', 'invited_by', 'used_at'];

    protected $casts = ['used_at' => 'datetime'];

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /**
     * §E6 — enforced from the registration endpoint itself, never just by
     * hiding the signup form. Case-insensitive: an allowlist entered as
     * "Jane@Example.com" must still match "jane@example.com" at signup.
     */
    public static function permits(string $email): bool
    {
        return static::whereRaw('LOWER(email) = ?', [strtolower($email)])->exists();
    }

    public static function markUsed(string $email): void
    {
        static::whereRaw('LOWER(email) = ?', [strtolower($email)])
            ->whereNull('used_at')
            ->update(['used_at' => now()]);
    }
}
