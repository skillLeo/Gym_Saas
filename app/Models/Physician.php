<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Physicians are a completely separate authenticatable from `User` (§6.5.1).
 * They never touch the `users` table and never get a Sanctum token issued by
 * the member `auth:sanctum` guard — see the dedicated `physician` guard in
 * `config/auth.php`, which points here via its own provider.
 */
class Physician extends Authenticatable
{
    use HasApiTokens, HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'password', 'practice_name', 'practice_phone', 'is_active',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'password'      => 'hashed',
        'is_active'     => 'boolean',
        'last_login_at' => 'datetime',
    ];

    public function authorizations(): HasMany
    {
        return $this->hasMany(CoachingAuthorization::class);
    }
}
