<?php

namespace App\Services;

use App\Models\MotivationalMessage;
use App\Models\Notification;
use App\Models\NotificationSchedule;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Picks and delivers motivational messages (§4.4).
 *
 * Delivery is in-app only, through the existing `Notification` model. Web push
 * is deliberately not wired — see BUILD_PROGRESS for the reasoning.
 */
class MotivationalNotifier
{
    public const TYPE = 'motivational';

    /**
     * The least-recently-sent active message.
     *
     * Explicitly not random. With a pool of ten, random selection repeats the
     * previous message about one run in ten, and members read a repeat as the
     * app malfunctioning. Rotating strictly by `last_sent_at` means the whole
     * pool is exhausted before anything is seen twice.
     *
     * Never-sent messages sort first: `last_sent_at IS NULL` is ordered ahead of
     * any timestamp, so a newly added message goes out next rather than waiting
     * for the rotation to come round.
     */
    public function nextMessage(): ?MotivationalMessage
    {
        return MotivationalMessage::active()
            ->orderByRaw('last_sent_at IS NULL DESC')
            ->orderBy('last_sent_at')
            // Stable tiebreak, so several never-sent messages rotate in a
            // predictable order instead of depending on the engine.
            ->orderBy('id')
            ->first();
    }

    /**
     * Members who should receive motivational notifications.
     *
     * Anyone with live access — on trial or subscribed. Sending encouragement
     * to a lapsed account would be marketing dressed as a feature, and those
     * users get the conversion funnel instead (§4.3).
     */
    public function recipientsQuery()
    {
        return User::query()
            ->whereNull('deleted_at')
            ->where(function ($q) {
                $q->where('trial_ends_at', '>', now())
                  ->orWhereHas('subscriptions', fn ($s) => $s->whereIn('status', Subscription::ENTITLED_STATUSES));
            });
    }

    /**
     * Send one message to every eligible member.
     *
     * Returns the number of notifications created. The message's counters are
     * updated once, after delivery, so a failure partway through does not mark
     * it as sent and push it to the back of the rotation unfairly.
     */
    public function send(MotivationalMessage $message, bool $dryRun = false): int
    {
        $created = 0;
        $now     = now();

        $this->recipientsQuery()->select('id')->chunkById(500, function ($users) use ($message, $now, &$created, $dryRun) {
            if ($dryRun) {
                $created += $users->count();

                return;
            }

            // Bulk insert: one statement per chunk rather than one per member.
            // Timestamps are set explicitly because insert() bypasses Eloquent.
            $rows = $users->map(fn ($u) => [
                'user_id'    => $u->id,
                'type'       => self::TYPE,
                'title'      => $message->title,
                'body'       => $message->body,
                'data'       => json_encode(['message_id' => $message->id]),
                'link'       => '/dashboard',
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            Notification::insert($rows);
            $created += count($rows);
        });

        if (!$dryRun && $created > 0) {
            $message->forceFill([
                'last_sent_at' => $now,
                'send_count'   => $message->send_count + 1,
            ])->save();
        }

        return $created;
    }

    /**
     * Run every schedule that is currently due.
     *
     * @return array{sent: int, schedules: int, skipped: int}
     */
    public function runDueSchedules(bool $dryRun = false): array
    {
        $sent = 0; $ran = 0; $skipped = 0;

        foreach (NotificationSchedule::active()->get() as $schedule) {
            if (!$schedule->isDue()) {
                $skipped++;
                continue;
            }

            $message = $this->nextMessage();

            if (!$message) {
                Log::warning('Notification schedule due but the message pool is empty', [
                    'schedule_id' => $schedule->id,
                ]);
                $skipped++;
                continue;
            }

            $count = $this->send($message, $dryRun);
            $sent += $count;
            $ran++;

            if (!$dryRun) {
                // Stamped inside the same pass so a second invocation in the
                // same local day sees the schedule as already run.
                $schedule->forceFill(['last_run_at' => now()])->save();

                Log::info('Motivational notification sent', [
                    'schedule_id' => $schedule->id,
                    'message_id'  => $message->id,
                    'recipients'  => $count,
                ]);
            }
        }

        return ['sent' => $sent, 'schedules' => $ran, 'skipped' => $skipped];
    }

    /**
     * Send one message immediately, outside any schedule.
     *
     * Used by the admin "send now" action. Does not touch `last_run_at`, since
     * a manual send is not a scheduled run and must not suppress one.
     */
    public function sendNow(MotivationalMessage $message): int
    {
        return DB::transaction(fn () => $this->send($message));
    }
}
