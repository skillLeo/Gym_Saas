<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\LiveSession;
use App\Models\VibeCallSchedule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Materialises upcoming Vibe Calls from recurring schedules (§5.2).
 *
 * Creates real `live_sessions` rows so members join through the existing
 * Phase 7 live infrastructure — viewing, commenting and replay all already
 * work there. Nothing about the live experience is rebuilt here.
 *
 * Each session also gets a platform-wide `calendar_events` row (`user_id` NULL)
 * so it appears on everyone's calendar without writing one row per member.
 */
class VibeCallGenerator
{
    /** Colour used for Vibe Call events on the calendar. */
    private const CALENDAR_COLOR = '#7C3AED';

    /**
     * Generate for every active schedule.
     *
     * @return array{sessions:int, events:int, schedules:int}
     */
    public function run(bool $dryRun = false): array
    {
        $sessions = 0; $events = 0; $schedules = 0;

        foreach (VibeCallSchedule::active()->get() as $schedule) {
            $result = $this->generateFor($schedule, $dryRun);

            if ($result['sessions'] > 0 || $result['events'] > 0) {
                $schedules++;
            }

            $sessions += $result['sessions'];
            $events   += $result['events'];
        }

        return ['sessions' => $sessions, 'events' => $events, 'schedules' => $schedules];
    }

    /**
     * Generate sessions for one schedule, up to its lookahead window.
     *
     * Idempotent: an occurrence that already has a session for this schedule at
     * that exact time is skipped, so running twice creates nothing extra. The
     * check is on (schedule_id, scheduled_at) rather than a `last_generated_through`
     * cursor alone — a cursor by itself would silently skip occurrences if the
     * window or the rule changed.
     *
     * @return array{sessions:int, events:int}
     */
    public function generateFor(VibeCallSchedule $schedule, bool $dryRun = false): array
    {
        $from = now();
        $to   = now()->addDays(max(1, $schedule->auto_create_days_ahead));

        $created = 0; $eventsMade = 0;

        foreach ($schedule->occurrencesBetween($from, $to) as $at) {
            $exists = LiveSession::where('schedule_id', $schedule->id)
                ->where('scheduled_at', $at)
                ->exists();

            if ($exists) {
                continue;
            }

            if ($dryRun) {
                $created++;
                $eventsMade++;
                continue;
            }

            DB::transaction(function () use ($schedule, $at, &$created, &$eventsMade) {
                $session = LiveSession::create([
                    'title'            => $schedule->title,
                    'description'      => $schedule->description,
                    'instructor_name'  => 'Team Extreme',
                    'status'           => 'scheduled',
                    'scheduled_at'     => $at,
                    'duration_minutes' => $schedule->duration_minutes,
                    'category'         => 'Vibe Call',
                    'is_vibe_call'     => true,
                    'schedule_id'      => $schedule->id,
                ]);
                $created++;

                // Platform-wide: user_id NULL means everyone sees it, and one
                // row covers every member however many there are.
                $local = $at->copy()->setTimezone($schedule->timezone ?: 'UTC');

                CalendarEvent::create([
                    'user_id'         => null,
                    'live_session_id' => $session->id,
                    'title'           => $schedule->title,
                    'type'            => 'live',
                    'color'           => self::CALENDAR_COLOR,
                    'date'            => $local->toDateString(),
                    'time'            => $local->format('H:i'),
                    'end_time'        => $local->copy()->addMinutes($schedule->duration_minutes)->format('H:i'),
                    'notes'           => $schedule->description,
                ]);
                $eventsMade++;
            });
        }

        if (!$dryRun && $created > 0) {
            $schedule->forceFill(['last_generated_through' => $to->toDateString()])->save();

            Log::info('Vibe Calls generated', [
                'schedule_id' => $schedule->id,
                'sessions'    => $created,
                'through'     => $to->toDateString(),
            ]);
        }

        return ['sessions' => $created, 'events' => $eventsMade];
    }
}
