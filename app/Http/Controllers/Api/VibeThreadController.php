<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\VibeThreadMessage;
use App\Models\VibeThreadMute;
use App\Support\NotificationCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The Vibe Thread — one platform-wide channel (§5.1).
 *
 * Reads follow the existing private-messaging pattern: a `since` cursor for
 * incremental polling and backwards pagination for history, so the frontend
 * dedup logic already in use works here unchanged.
 */
class VibeThreadController extends Controller
{
    private const PAGE_SIZE = 40;

    /**
     * Newest messages, or everything after `since` when polling.
     *
     * Ordered oldest-first in the response so the client can append without
     * reversing, while the underlying query still takes the newest slice.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'since'  => 'nullable|integer|min:0',
            'before' => 'nullable|integer|min:1',
        ]);

        $query = VibeThreadMessage::with(['user:id,name,username,avatar', 'replyTo:id,user_id,body'])
            ->with('replyTo.user:id,name');

        if (!empty($validated['since'])) {
            // Polling: everything newer than what the client already holds.
            $messages = $query->where('id', '>', $validated['since'])
                ->orderBy('id')
                ->limit(200)
                ->get();
        } else {
            // History: a page ending before the oldest message the client has.
            if (!empty($validated['before'])) {
                $query->where('id', '<', $validated['before']);
            }

            $messages = $query->orderByDesc('id')
                ->limit(self::PAGE_SIZE)
                ->get()
                ->reverse()
                ->values();
        }

        return response()->json([
            'data' => $messages->map(fn (VibeThreadMessage $m) => $this->format($m)),
            'meta' => [
                // Lets the client know whether to offer "load earlier".
                'has_more' => $messages->isNotEmpty()
                    && VibeThreadMessage::where('id', '<', $messages->first()->id)->exists(),
                'muted'    => $this->activeMuteFor($request)?->isActive() ?? false,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'body'        => 'required|string|max:2000',
            'reply_to_id' => 'nullable|integer|exists:vibe_thread_messages,id',
        ]);

        $user = $request->user();

        $message = VibeThreadMessage::create([
            'user_id'       => $user->id,
            'body'          => trim($validated['body']),
            // Captured at write time — see the migration note. A member who
            // later becomes an admin must not have their old messages
            // retroactively restyled as announcements.
            'is_admin_post' => (bool) $user->is_admin,
            'reply_to_id'   => $validated['reply_to_id'] ?? null,
        ]);

        $message->load(['user:id,name,username,avatar', 'replyTo:id,user_id,body', 'replyTo.user:id,name']);

        $this->notifyThread($message, $user);

        return response()->json(['data' => $this->format($message)], 201);
    }

    /**
     * Tell everyone else a message landed in the thread.
     *
     * Posting notified nobody at all, which made the mute below a control over
     * something that never happened: a member could "mute the Vibe Thread" and
     * see no change, because there was nothing to silence. The thread is the one
     * platform-wide channel, so a post goes to every other member.
     *
     * Two separate mutes have to be honoured here, and Notification::insert()
     * bypasses model events, so neither is applied for us:
     *   - the thread's own mute (VibeThreadMute), and
     *   - the Announcements category mute on the user record.
     */
    private function notifyThread(VibeThreadMessage $message, User $sender): void
    {
        $now = now();

        // A null `muted_until` is an indefinite mute, not an absent one — see
        // VibeThreadMute::isActive(). Comparing only on '>' would silently ping
        // exactly the members who asked never to be pinged.
        $threadMuted = VibeThreadMute::where(fn ($q) => $q
            ->whereNull('muted_until')
            ->orWhere('muted_until', '>', $now))
            ->pluck('user_id')
            ->all();

        $recipients = User::where('id', '!=', $sender->id)
            ->whereNotIn('id', $threadMuted)
            ->get(['id', 'muted_notification_categories'])
            ->reject(fn (User $u) => $u->hasMutedCategory(NotificationCategory::PLATFORM))
            ->pluck('id');

        if ($recipients->isEmpty()) {
            return;
        }

        $rows = $recipients->map(fn ($userId) => [
            'user_id'      => $userId,
            'type'         => 'vibe_thread',
            // The notification card already prints the actor's name in front of
            // the title, so putting the name here too read as "Alex Rivera Alex
            // Rivera posted in the Vibe Thread". Lower case because it is a
            // continuation of that name, not a heading.
            'title'        => 'posted in the Vibe Thread',
            'body'         => Str::limit($message->body, 80),
            'data'         => json_encode(['message_id' => $message->id]),
            'actor_name'   => $sender->name,
            'actor_avatar' => $sender->avatar,
            'link'         => '/vibe-thread',
            'created_at'   => $now,
            'updated_at'   => $now,
        ])->toArray();

        foreach (array_chunk($rows, 500) as $chunk) {
            Notification::insert($chunk);
        }
    }

    /**
     * Edit own message. Admins may not edit other people's words.
     */
    public function update(Request $request, VibeThreadMessage $vibeThreadMessage): JsonResponse
    {
        if ($vibeThreadMessage->user_id !== $request->user()->id) {
            return response()->json(['message' => 'You can only edit your own messages.'], 403);
        }

        $validated = $request->validate(['body' => 'required|string|max:2000']);

        $vibeThreadMessage->update([
            'body'      => trim($validated['body']),
            'edited_at' => now(),
        ]);

        $vibeThreadMessage->load(['user:id,name,username,avatar']);

        return response()->json(['data' => $this->format($vibeThreadMessage)]);
    }

    /**
     * Delete own message; admins may remove any, for moderation.
     *
     * Soft delete, so a removed message stays reviewable rather than vanishing.
     */
    public function destroy(Request $request, VibeThreadMessage $vibeThreadMessage): JsonResponse
    {
        $user = $request->user();

        if ($vibeThreadMessage->user_id !== $user->id && !$user->is_admin) {
            return response()->json(['message' => 'You can only delete your own messages.'], 403);
        }

        $vibeThreadMessage->delete();

        return response()->json(['message' => 'Message removed.']);
    }

    /**
     * Mute or unmute notifications.
     *
     * Deliberately only affects pings. There is no way to hide the thread,
     * because the brief requires it stay readable.
     */
    public function mute(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'muted'  => 'required|boolean',
            // Null = indefinitely. A value lapses on its own.
            'hours'  => 'nullable|integer|min:1|max:8760',
        ]);

        $user = $request->user();

        if (!$validated['muted']) {
            VibeThreadMute::where('user_id', $user->id)->delete();

            return response()->json(['muted' => false, 'message' => 'Notifications back on.']);
        }

        $until = isset($validated['hours']) ? now()->addHours($validated['hours']) : null;

        VibeThreadMute::updateOrCreate(['user_id' => $user->id], ['muted_until' => $until]);

        return response()->json([
            'muted'   => true,
            'until'   => $until,
            'message' => $until
                ? 'Muted until ' . $until->format('j M, H:i') . '. You can still read the thread.'
                : 'Muted. You can still read the thread.',
        ]);
    }

    private function activeMuteFor(Request $request): ?VibeThreadMute
    {
        $mute = VibeThreadMute::where('user_id', $request->user()->id)->first();

        return $mute && $mute->isActive() ? $mute : null;
    }

    private function format(VibeThreadMessage $m): array
    {
        return [
            'id'         => $m->id,
            'body'       => $m->body,
            'is_admin'   => $m->is_admin_post,
            'edited_at'  => $m->edited_at,
            'created_at' => $m->created_at,
            'user'       => [
                'id'       => $m->user?->id,
                'name'     => $m->user?->name,
                'username' => $m->user?->username,
                'avatar'   => $m->user?->avatar_url,
            ],
            'reply_to'   => $m->replyTo ? [
                'id'   => $m->replyTo->id,
                'body' => \Illuminate\Support\Str::limit($m->replyTo->body, 90),
                'name' => $m->replyTo->user?->name,
            ] : null,
        ];
    }
}
