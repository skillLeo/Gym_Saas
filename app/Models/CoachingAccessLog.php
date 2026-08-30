<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Append-only audit trail (§6.5.3). Written on every single coaching-portal
 * data access — never read back to make an authorization decision, only to
 * answer "who looked at what, when" after the fact.
 */
class CoachingAccessLog extends Model
{
    const UPDATED_AT = null;

    protected $table = 'coaching_access_log';

    protected $fillable = ['physician_id', 'coaching_authorization_id', 'member_id', 'endpoint', 'ip'];
}
