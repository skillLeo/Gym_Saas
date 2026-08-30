<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Append-only record of account deletions.
 *
 * No `belongsTo(User::class)` relation is defined on purpose — the row it
 * describes is usually gone, and a relation would invite call sites to assume
 * otherwise. `user_id` is kept as a plain identifier for correlation.
 */
class AccountDeletionAudit extends Model
{
    protected $fillable = [
        'user_id', 'email', 'name', 'action', 'reason',
        'account_state_at_action', 'trial_ends_at', 'deactivated_at',
        'had_any_payment', 'performed_by_user_id',
    ];

    protected $casts = [
        'trial_ends_at'   => 'datetime',
        'deactivated_at'  => 'datetime',
        'had_any_payment' => 'boolean',
    ];
}
