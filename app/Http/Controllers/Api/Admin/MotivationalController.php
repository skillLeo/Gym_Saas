<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MotivationalMessage;
use App\Models\NotificationSchedule;
use App\Services\MotivationalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin CRUD for the motivational message pool and its schedules (§4.4).
 */
class MotivationalController extends Controller
{
    public function __construct(private MotivationalNotifier $notifier) {}

    public function index(): JsonResponse
    {
        $messages = MotivationalMessage::orderByRaw('last_sent_at IS NULL DESC')
            ->orderBy('last_sent_at')
            ->orderBy('id')
            ->get();

        $next = $this->notifier->nextMessage();

        return response()->json([
            'data' => $messages->map(fn (MotivationalMessage $m) => $this->formatMessage($m, $next?->id)),
            'schedules' => NotificationSchedule::orderBy('id')->get()
                ->map(fn (NotificationSchedule $s) => $this->formatSchedule($s)),
            'meta' => [
                'active_count'    => $messages->where('is_active', true)->count(),
                'recipient_count' => $this->notifier->recipientsQuery()->count(),
                // Stated plainly so nobody assumes browser push is happening.
                'delivery'        => 'in_app',
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'     => 'nullable|string|max:255',
            'body'      => 'required|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        $message = MotivationalMessage::create($data + ['created_by' => $request->user()->id]);

        // refresh(): send_count and last_sent_at come from database defaults and
        // are not populated on the instance returned by create(), so formatting
        // it directly reports send_count as null rather than 0.
        return response()->json(['data' => $this->formatMessage($message->refresh(), null)], 201);
    }

    public function update(Request $request, MotivationalMessage $motivationalMessage): JsonResponse
    {
        $data = $request->validate([
            'title'     => 'nullable|string|max:255',
            'body'      => 'required|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        $motivationalMessage->update($data);

        return response()->json(['data' => $this->formatMessage($motivationalMessage->fresh(), null)]);
    }

    /**
     * Delete a message.
     *
     * Refuses to remove the last active one: an empty pool means every schedule
     * fires and silently sends nothing, which looks identical to the feature
     * being broken.
     */
    public function destroy(MotivationalMessage $motivationalMessage): JsonResponse
    {
        $remaining = MotivationalMessage::active()
            ->where('id', '!=', $motivationalMessage->id)
            ->count();

        if ($motivationalMessage->is_active && $remaining === 0) {
            return response()->json([
                'message' => 'This is the only active message. Add another before removing it, or the scheduled notification would have nothing to send.',
            ], 422);
        }

        $motivationalMessage->delete();

        return response()->json(['message' => 'Message deleted.']);
    }

    /**
     * Send one message to every eligible member right now.
     */
    public function sendNow(MotivationalMessage $motivationalMessage): JsonResponse
    {
        if (!$motivationalMessage->is_active) {
            return response()->json(['message' => 'Activate this message before sending it.'], 422);
        }

        $count = $this->notifier->sendNow($motivationalMessage);

        return response()->json([
            'message' => $count === 1
                ? 'Sent to 1 member.'
                : "Sent to {$count} members.",
            'data'    => $this->formatMessage($motivationalMessage->fresh(), null),
        ]);
    }

    public function storeSchedule(Request $request): JsonResponse
    {
        $data = $this->validateSchedule($request);
        $schedule = NotificationSchedule::create($data);

        return response()->json(['data' => $this->formatSchedule($schedule)], 201);
    }

    public function updateSchedule(Request $request, NotificationSchedule $notificationSchedule): JsonResponse
    {
        $notificationSchedule->update($this->validateSchedule($request));

        return response()->json(['data' => $this->formatSchedule($notificationSchedule->fresh())]);
    }

    public function destroySchedule(NotificationSchedule $notificationSchedule): JsonResponse
    {
        $notificationSchedule->delete();

        return response()->json(['message' => 'Schedule deleted.']);
    }

    private function validateSchedule(Request $request): array
    {
        $data = $request->validate([
            'name'           => 'required|string|max:255',
            'days_of_week'   => 'required|array|min:1',
            // ISO day numbers, 1 = Monday.
            'days_of_week.*' => 'integer|min:1|max:7',
            'send_time'      => 'required|date_format:H:i',
            'timezone'       => 'required|string|max:64|timezone',
            'is_active'      => 'nullable|boolean',
        ]);

        // Normalise: unique, sorted, and seconds appended so comparisons against
        // a stored TIME column are string-safe.
        $data['days_of_week'] = array_values(array_unique(array_map('intval', $data['days_of_week'])));
        sort($data['days_of_week']);
        $data['send_time'] .= ':00';

        return $data;
    }

    private function formatMessage(MotivationalMessage $m, ?int $nextId): array
    {
        return [
            'id'           => $m->id,
            'title'        => $m->title,
            'body'         => $m->body,
            'is_active'    => $m->is_active,
            'last_sent_at' => $m->last_sent_at,
            'send_count'   => $m->send_count,
            // Lets the admin see the rotation rather than having to trust it.
            'is_next'      => $nextId !== null && $m->id === $nextId,
        ];
    }

    private function formatSchedule(NotificationSchedule $s): array
    {
        return [
            'id'           => $s->id,
            'name'         => $s->name,
            'days_of_week' => array_map('intval', $s->days_of_week ?? []),
            'day_labels'   => $s->day_labels,
            'send_time'    => substr($s->sendTimeString(), 0, 5),
            'timezone'     => $s->timezone,
            'is_active'    => $s->is_active,
            'last_run_at'  => $s->last_run_at,
        ];
    }
}
