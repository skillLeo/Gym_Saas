<?php

namespace App\Services;

use App\Models\AccountDeletionAudit;
use App\Models\Subscription;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * The one place account lifecycle state is decided and written (§4.2).
 *
 * Nothing else may assign `account_state`. Scattering transitions across
 * controllers, webhooks and commands is how an account ends up `subscriber`
 * with no subscription, or `grace` while actively paying — every writer sees
 * only its own trigger, never the whole picture.
 *
 * State is *derived* from facts (subscription rows, trial dates, deactivation
 * timestamps) rather than patched per event, so events arriving late or out of
 * order converge on the same answer instead of drifting.
 */
class UserAccountState
{
    public const TRIAL       = 'trial';
    public const SUBSCRIBER  = 'subscriber';
    public const GRACE       = 'grace';
    public const DEACTIVATED = 'deactivated';

    /** Days in `grace` before the account is deactivated and queued for deletion. */
    public const GRACE_DAYS = 90;

    /** Days between soft-delete and irreversible hard-delete. */
    public const RETENTION_DAYS = 30;

    private const SETTING_GROUP = 'trial';
    private const SETTING_KEY   = 'trial_length_days';

    /**
     * Trial length for **new** signups, in days.
     *
     * Admin-configurable rather than hardcoded. Changing it must never
     * retroactively move an existing trial — callers use this only when
     * creating an account, and `trial_ends_at` is fixed at that moment.
     */
    public function trialLengthDays(): int
    {
        // ->first()?->value (not ->value('value')) so the encrypted cast on
        // SystemSetting::value actually runs — the query-builder scalar helper
        // bypasses Eloquent casts entirely and would return raw ciphertext.
        $value = SystemSetting::where('group', self::SETTING_GROUP)
            ->where('key', self::SETTING_KEY)
            ->first()?->value;

        $days = is_numeric($value) ? (int) $value : 0;

        // Clamp: a zero or negative trial would lock out every new signup the
        // moment they registered, and an absurd value is almost certainly a
        // typo in the admin form.
        return $days >= 1 && $days <= 365 ? $days : 30;
    }

    /**
     * What state should this user be in, given the facts?
     *
     * Pure: reads, never writes. `apply()` is what persists it.
     */
    public function derive(User $user): string
    {
        // A live subscription outranks everything, including a lapsed trial —
        // someone who pays after their trial ended is a subscriber, not in grace.
        if ($this->hasEntitlingSubscription($user)) {
            return self::SUBSCRIBER;
        }

        if ($user->trial_ends_at && $user->trial_ends_at->isFuture()) {
            return self::TRIAL;
        }

        // Past grace with no payment: deactivated.
        if ($user->deactivated_at && $user->deactivated_at->addDays(self::GRACE_DAYS)->isPast()) {
            return self::DEACTIVATED;
        }

        return self::GRACE;
    }

    /**
     * Recompute and persist. Returns the state the user ended up in.
     */
    public function apply(User $user): string
    {
        $next    = $this->derive($user);
        $current = $user->account_state;

        if ($next === $current) {
            // Still keep the derived mirror honest if it has drifted.
            $this->writeMirror($user, $next);

            return $next;
        }

        $attributes = ['account_state' => $next];

        // Entering grace starts the clock that later drives deactivation.
        if ($next === self::GRACE && !$user->deactivated_at) {
            $attributes['deactivated_at'] = now();
        }

        // Recovering clears both the clock and any pending deletion — paying
        // again must undo the countdown, not merely pause it.
        if (in_array($next, [self::TRIAL, self::SUBSCRIBER], true)) {
            $attributes['deactivated_at']        = null;
            $attributes['scheduled_deletion_at'] = null;
        }

        // Deactivation schedules deletion, it does not perform it.
        if ($next === self::DEACTIVATED && !$user->scheduled_deletion_at) {
            $attributes['scheduled_deletion_at'] = now()->addDays(self::RETENTION_DAYS);
        }

        // account_state and subscription_status are both guarded against mass
        // assignment, so this must be forceFill.
        $user->forceFill($attributes + [
            'subscription_status' => $this->mirrorFor($next),
        ])->save();

        Log::info('Account state changed', [
            'user_id' => $user->id,
            'from'    => $current,
            'to'      => $next,
        ]);

        return $next;
    }

    /**
     * Start a trial on a newly created account.
     */
    public function startTrial(User $user): void
    {
        $user->forceFill([
            'trial_starts_at'     => now(),
            'trial_ends_at'       => now()->addDays($this->trialLengthDays()),
            'account_state'       => self::TRIAL,
            'subscription_status' => $this->mirrorFor(self::TRIAL),
        ])->save();
    }

    /**
     * Soft-delete a deactivated account whose retention window has elapsed.
     *
     * Reversible by design, and always audited.
     */
    public function softDelete(User $user, string $reason, ?int $performedBy = null): void
    {
        DB::transaction(function () use ($user, $reason, $performedBy) {
            $this->audit($user, 'soft_deleted', $reason, $performedBy);
            $user->delete();
        });
    }

    /**
     * Irreversibly remove an account.
     *
     * The audit row is written first and inside the same transaction, so there
     * is no window where the data is gone and no record explains why.
     */
    public function hardDelete(User $user, string $reason, ?int $performedBy = null): void
    {
        DB::transaction(function () use ($user, $reason, $performedBy) {
            $this->audit($user, 'hard_deleted', $reason, $performedBy);
            $user->forceDelete();
        });
    }

    public function restore(User $user, string $reason, ?int $performedBy = null): void
    {
        DB::transaction(function () use ($user, $reason, $performedBy) {
            $user->restore();
            $user->forceFill(['scheduled_deletion_at' => null])->save();
            $this->audit($user, 'restored', $reason, $performedBy);
            $this->apply($user->refresh());
        });
    }

    /**
     * Has this user ever paid anything successfully?
     *
     * Guards deletion: an account that has given us money is never swept away
     * by an automated job, whatever its state.
     */
    public function hasEverPaid(User $user): bool
    {
        return $user->payments()->where('status', 'succeeded')->exists();
    }

    private function hasEntitlingSubscription(User $user): bool
    {
        return $user->subscriptions()
            ->whereIn('status', Subscription::ENTITLED_STATUSES)
            ->exists();
    }

    private function audit(User $user, string $action, string $reason, ?int $performedBy): void
    {
        AccountDeletionAudit::create([
            'user_id'                 => $user->id,
            'email'                   => $user->email,
            'name'                    => $user->name,
            'action'                  => $action,
            'reason'                  => $reason,
            'account_state_at_action' => $user->account_state,
            'trial_ends_at'           => $user->trial_ends_at,
            'deactivated_at'          => $user->deactivated_at,
            'had_any_payment'         => $this->hasEverPaid($user),
            'performed_by_user_id'    => $performedBy,
        ]);
    }

    /**
     * Legacy `subscription_status` value for a given account state.
     *
     * That column predates `account_state` and is still read by the admin
     * dashboard. It is a projection, not a second source of truth: only this
     * class writes it, and only from the state derived above.
     */
    private function mirrorFor(string $state): string
    {
        return match ($state) {
            self::SUBSCRIBER  => 'active',
            self::TRIAL       => 'trial',
            default           => 'expired',
        };
    }

    private function writeMirror(User $user, string $state): void
    {
        $expected = $this->mirrorFor($state);

        if ($user->subscription_status !== $expected) {
            $user->forceFill(['subscription_status' => $expected])->save();
        }
    }
}
