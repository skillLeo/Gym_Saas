<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LiveSession;
use App\Models\VibeCallSchedule;
use App\Services\VibeCallGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin management of recurring Vibe Call schedules (§5.2).
 */
class VibeCallController extends Controller
{
    public function __construct(private VibeCallGenerator $generator) {}

    public function index(): JsonResponse
    {
        $schedules = VibeCallSchedule::withCount('sessions')->orderBy('id')->get();

        return response()->json([
            'data' => $schedules->map(fn (VibeCallSchedule $s) => $this->format($s)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $schedule = VibeCallSchedule::create($this->validated($request));

        // Generate immediately so the calendar reflects a new schedule without
        // waiting for the hourly job.
        $this->generator->generateFor($schedule);

        return response()->json(['data' => $this->format($schedule->fresh()->loadCount('sessions'))], 201);
    }

    public function update(Request $request, VibeCallSchedule $vibeCallSchedule): JsonResponse
    {
        $vibeCallSchedule->update($this->validated($request));

        // Future sessions that no longer match the rule are removed, then
        // regenerated. Only sessions that have not started are touched — a call
        // that already ran is history and must not be rewritten.
        $removed = $this->pruneFutureSessions($vibeCallSchedule);
        $this->generator->generateFor($vibeCallSchedule->fresh());

        return response()->json([
            'data'    => $this->format($vibeCallSchedule->fresh()->loadCount('sessions')),
            'message' => $removed > 0
                ? "Saved. {$removed} upcoming call" . ($removed === 1 ? '' : 's') . ' rescheduled.'
                : 'Saved.',
        ]);
    }

    /**
     * Deactivate and clear upcoming calls; past ones are left alone as history.
     */
    public function destroy(VibeCallSchedule $vibeCallSchedule): JsonResponse
    {
        $removed = $this->pruneFutureSessions($vibeCallSchedule);
        $vibeCallSchedule->update(['is_active' => false]);

        return response()->json([
            'message' => "Schedule stopped. {$removed} upcoming call" . ($removed === 1 ? '' : 's') . ' removed; past calls kept.',
        ]);
    }

    /**
     * Upcoming generated calls, so an admin can see what the rule produced.
     */
    public function upcoming(): JsonResponse
    {
        $sessions = LiveSession::vibeCalls()
            ->where('scheduled_at', '>=', now())
            ->orderBy('scheduled_at')
            ->limit(50)
            ->get(['id', 'title', 'scheduled_at', 'duration_minutes', 'status', 'schedule_id']);

        return response()->json(['data' => $sessions]);
    }

    private function pruneFutureSessions(VibeCallSchedule $schedule): int
    {
        $future = LiveSession::where('schedule_id', $schedule->id)
            ->where('scheduled_at', '>', now())
            ->where('status', 'scheduled')
            ->get();

        foreach ($future as $session) {
            // The calendar event cascades on the FK, so deleting the session is
            // enough — no orphan entry is left behind.
            $session->delete();
        }

        return $future->count();
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title'                  => 'required|string|max:255',
            'description'            => 'nullable|string|max:2000',
            'days_of_week'           => 'required|array|min:1',
            'days_of_week.*'         => 'integer|min:1|max:7',
            'time_of_day'            => 'required|date_format:H:i',
            'duration_minutes'       => 'required|integer|min:5|max:480',
            'timezone'               => 'required|string|max:64|timezone',
            'auto_create_days_ahead' => 'nullable|integer|min:1|max:60',
            'is_active'              => 'nullable|boolean',
        ]);

        $data['days_of_week'] = array_values(array_unique(array_map('intval', $data['days_of_week'])));
        sort($data['days_of_week']);
        $data['time_of_day'] .= ':00';

        return $data;
    }

    private function format(VibeCallSchedule $s): array
    {
        return [
            'id'                     => $s->id,
            'title'                  => $s->title,
            'description'            => $s->description,
            'days_of_week'           => array_map('intval', $s->days_of_week ?? []),
            'day_labels'             => $s->day_labels,
            'time_of_day'            => substr($s->timeString(), 0, 5),
            'duration_minutes'       => $s->duration_minutes,
            'timezone'               => $s->timezone,
            'auto_create_days_ahead' => $s->auto_create_days_ahead,
            'is_active'              => $s->is_active,
            'last_generated_through' => $s->last_generated_through?->toDateString(),
            'sessions_count'         => $s->sessions_count ?? null,
        ];
    }
}
