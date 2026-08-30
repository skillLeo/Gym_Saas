<?php
namespace App\Console\Commands;

use App\Mail\CouponOfferMail;
use App\Mail\TrialExpiredMail;
use App\Mail\TrialExpiringMail;
use App\Models\CouponOffer;
use App\Models\User;
use App\Services\CouponService;
use App\Services\UserAccountState;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Drives the account lifecycle on a schedule (§4.2).
 *
 * Four jobs, in order:
 *   1. Warn trials ending within 3 days.
 *   2. Move lapsed trials into `grace`.
 *   3. Deactivate accounts that have sat in grace past the window.
 *   4. Soft-delete, then hard-delete, accounts whose retention has elapsed.
 *
 * Mail is sent synchronously on purpose: this is already a background command,
 * so queueing would add a dependency on a running worker without taking
 * anything off the request path.
 *
 * Every state change goes through UserAccountState — this command decides
 * *who* to act on, never what state they end up in.
 */
class ProcessTrials extends Command
{
    protected $signature   = 'trials:process {--dry-run : Report what would change without writing}';
    protected $description = 'Process trial expiry, grace, deactivation and scheduled deletion';

    public function __construct(
        private UserAccountState $state,
        private CouponService $coupons,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        // Offers go out before the expiry reminder so a user who is due both on
        // the same run gets the discount alongside the warning, not after it.
        $offers      = $this->sendConversionOffers($dry);
        $reminders   = $this->sendExpiryReminders($dry);
        $lapsed      = $this->lapseEndedTrials($dry);
        $deactivated = $this->deactivateStaleGrace($dry);
        $softDeleted = $this->softDeleteExhausted($dry);
        $hardDeleted = $this->hardDeleteRetained($dry);

        $this->info(sprintf(
            '%sOffers: %d. Reminders: %d. Lapsed to grace: %d. Deactivated: %d. Soft-deleted: %d. Hard-deleted: %d.',
            $dry ? '[dry run] ' : '',
            $offers, $reminders, $lapsed, $deactivated, $softDeleted, $hardDeleted
        ));

        return self::SUCCESS;
    }

    /**
     * Send whichever conversion offer a trialling user is due (§4.3).
     *
     * Only users still on trial are considered — a discount is an argument to
     * subscribe, and it is wasted on someone who already has.
     */
    private function sendConversionOffers(bool $dry): int
    {
        if (!CouponOffer::where('is_active', true)->exists()) {
            return 0;
        }

        $sent = 0;

        User::where('account_state', UserAccountState::TRIAL)
            ->whereNotNull('trial_starts_at')
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '>', now())
            ->chunkById(100, function ($users) use (&$sent, $dry) {
                foreach ($users as $user) {
                    $offer = $this->coupons->dueOfferFor($user);
                    if (!$offer) continue;

                    // No extra guard for offers whose code outlives the trial.
                    // The query above already excludes anyone whose trial has
                    // ended, which is the case that actually matters: if the
                    // trial is shortened below an offer's trigger day, those
                    // users are in `grace` and never selected. A code that
                    // stays valid a few days past the trial is useful — it is
                    // exactly when someone is deciding whether to pay.
                    if ($dry) { $sent++; continue; }

                    $grant = $this->coupons->grant($user, $offer);
                    if (!$grant) continue; // Already had it.

                    try {
                        Mail::to($user->email)->send(new CouponOfferMail($grant));
                        $grant->update(['sent_at' => now()]);
                        $sent++;
                    } catch (\Throwable $e) {
                        // The grant survives with sent_at null so it can be
                        // retried or inspected, rather than being silently lost.
                        Log::error('Conversion offer email failed to send', [
                            'user_id'  => $user->id,
                            'grant_id' => $grant->id,
                            'error'    => $e->getMessage(),
                        ]);
                    }
                }
            });

        return $sent;
    }

    /**
     * Warn users whose trial ends within 3 days.
     */
    private function sendExpiryReminders(bool $dry): int
    {
        $sent = 0;

        // chunkById, not chunk: the loop writes `trial_reminder_sent`, which is
        // in this query's WHERE clause. chunk() pages with OFFSET, so rows that
        // stop matching shift everything left and the next page skips users.
        User::where('account_state', UserAccountState::TRIAL)
            ->where('trial_reminder_sent', false)
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', now()->addDays(3))
            ->where('trial_ends_at', '>', now())
            ->chunkById(100, function ($users) use (&$sent, $dry) {
                foreach ($users as $user) {
                    if ($dry) { $sent++; continue; }

                    try {
                        Mail::to($user->email)->send(new TrialExpiringMail($user));
                    } catch (\Throwable $e) {
                        // Leave the flag false so the next run retries. Marking
                        // it sent after a failure loses the reminder for good.
                        Log::error('Trial expiry reminder failed to send', [
                            'user_id' => $user->id,
                            'error'   => $e->getMessage(),
                        ]);
                        continue;
                    }

                    $user->forceFill(['trial_reminder_sent' => true])->save();
                    $sent++;
                }
            });

        return $sent;
    }

    /**
     * Trials past `trial_ends_at` with no active subscription → grace.
     */
    private function lapseEndedTrials(bool $dry): int
    {
        $count = 0;

        User::where('account_state', UserAccountState::TRIAL)
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', now())
            ->chunkById(100, function ($users) use (&$count, $dry) {
                foreach ($users as $user) {
                    if ($dry) {
                        // derive() is pure, so a dry run can report the outcome
                        // without touching anything.
                        if ($this->state->derive($user) !== UserAccountState::TRIAL) $count++;
                        continue;
                    }

                    $before = $user->account_state;
                    $after  = $this->state->apply($user);
                    if ($after === $before) continue;

                    $count++;

                    if ($after === UserAccountState::GRACE) {
                        try {
                            Mail::to($user->email)->send(new TrialExpiredMail($user));
                        } catch (\Throwable $e) {
                            Log::error('Trial expired notice failed to send', [
                                'user_id' => $user->id,
                                'error'   => $e->getMessage(),
                            ]);
                        }
                    }
                }
            });

        return $count;
    }

    /**
     * Grace older than the window → deactivated, deletion scheduled.
     */
    private function deactivateStaleGrace(bool $dry): int
    {
        $count = 0;

        User::where('account_state', UserAccountState::GRACE)
            ->whereNotNull('deactivated_at')
            ->where('deactivated_at', '<=', now()->subDays(UserAccountState::GRACE_DAYS))
            ->chunkById(100, function ($users) use (&$count, $dry) {
                foreach ($users as $user) {
                    if ($dry) { $count++; continue; }
                    if ($this->state->apply($user) === UserAccountState::DEACTIVATED) $count++;
                }
            });

        return $count;
    }

    /**
     * Soft-delete deactivated accounts once their deletion date arrives.
     *
     * Anyone who has ever paid is skipped: an account that has given us money
     * is never swept away by an automated job. Removing it is a decision for a
     * human, and there are legal and support reasons to keep the record.
     */
    private function softDeleteExhausted(bool $dry): int
    {
        $count = 0;

        User::where('account_state', UserAccountState::DEACTIVATED)
            ->whereNotNull('scheduled_deletion_at')
            ->where('scheduled_deletion_at', '<=', now())
            ->whereNull('deleted_at')
            ->chunkById(100, function ($users) use (&$count, $dry) {
                foreach ($users as $user) {
                    if ($this->state->hasEverPaid($user)) {
                        Log::info('Skipped deletion: account has payment history', ['user_id' => $user->id]);
                        continue;
                    }

                    if ($dry) { $count++; continue; }

                    $this->state->softDelete(
                        $user,
                        sprintf('Inactive for %d days after trial ended, no payment on file.', UserAccountState::GRACE_DAYS)
                    );
                    $count++;
                }
            });

        return $count;
    }

    /**
     * Hard-delete soft-deleted accounts after the retention window.
     *
     * The last reversible moment has passed by the time this runs, so the audit
     * row written by the service is the only remaining record.
     */
    private function hardDeleteRetained(bool $dry): int
    {
        $count = 0;

        User::onlyTrashed()
            ->where('deleted_at', '<=', now()->subDays(UserAccountState::RETENTION_DAYS))
            ->chunkById(100, function ($users) use (&$count, $dry) {
                foreach ($users as $user) {
                    if ($this->state->hasEverPaid($user)) continue;
                    if ($dry) { $count++; continue; }

                    $this->state->hardDelete(
                        $user,
                        sprintf('Retention window of %d days elapsed after soft delete.', UserAccountState::RETENTION_DAYS)
                    );
                    $count++;
                }
            });

        return $count;
    }
}
