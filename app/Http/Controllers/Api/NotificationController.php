<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Support\NotificationCategory;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $notifications = Notification::where('user_id', $user->id)
            // Sort order is deliberately untouched (§5.7). Pinning and the owner
            // accent change how a row LOOKS, never where it sits — a highlight
            // that reordered the feed would quietly bury everyone else.
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $pinnedIds = \App\Models\PinnedMember::where('user_id', $user->id)
            ->pluck('pinned_user_id')
            ->flip();

        $ownerIds = \App\Models\User::where('is_admin', true)->pluck('id')->flip();

        $decorated = $notifications->map(function (Notification $n) use ($pinnedIds, $ownerIds) {
            // Notifications store the actor's name, not id, so resolve through
            // `data.actor_id` when present and fall back to no highlight rather
            // than guessing from a display name that may not be unique.
            $actorId = $n->data['actor_id'] ?? null;

            $row = $n->toArray();
            $row['is_pinned_actor'] = $actorId !== null && $pinnedIds->has($actorId);
            $row['is_owner_actor']  = $actorId !== null && $ownerIds->has($actorId);

            return $row;
        });

        // Grouped as well as flat. The page was one undifferentiated list of
        // every type mixed together, so somebody looking for "did anyone reply
        // to me" had to read past follows, streaks and announcements. The flat
        // list is kept so nothing that already consumes it breaks.
        $muted = $user->muted_notification_categories ?? [];

        $categories = collect(NotificationCategory::all())->map(function (string $key) use ($decorated, $muted) {
            $rows = $decorated->filter(
                fn ($row) => NotificationCategory::forType($row['type'] ?? null) === $key
            )->values();

            return [
                'key'          => $key,
                'label'        => NotificationCategory::LABELS[$key],
                'muted'        => in_array($key, $muted, true),
                'total'        => $rows->count(),
                // The badge a member scans for: how much in here still needs them.
                'unread_count' => $rows->whereNull('read_at')->count(),
                'notifications'=> $rows,
            ];
        })->values();

        return response()->json([
            'notifications' => $decorated,
            'categories'    => $categories,
            // Muted categories are never written in the first place, so an
            // unread total over everything present is already correct.
            'unread_count'  => $notifications->whereNull('read_at')->count(),
        ]);
    }

    /**
     * Which categories this member has silenced.
     */
    public function preferences(Request $request)
    {
        $muted = $request->user()->muted_notification_categories ?? [];

        return response()->json([
            'data' => collect(NotificationCategory::all())->map(fn (string $key) => [
                'key'   => $key,
                'label' => NotificationCategory::LABELS[$key],
                'muted' => in_array($key, $muted, true),
            ])->values(),
        ]);
    }

    /**
     * Mute or unmute one category.
     *
     * One category at a time rather than replacing the whole list, so two
     * screens toggling different switches cannot overwrite each other.
     */
    public function updatePreferences(Request $request)
    {
        $validated = $request->validate([
            'category' => 'required|string',
            'muted'    => 'required|boolean',
        ]);

        if (!NotificationCategory::isValid($validated['category'])) {
            return response()->json(['message' => 'Unknown notification category.'], 422);
        }

        $user  = $request->user();
        $muted = collect($user->muted_notification_categories ?? []);

        $muted = $validated['muted']
            ? $muted->push($validated['category'])->unique()->values()
            : $muted->reject(fn ($c) => $c === $validated['category'])->values();

        // forceFill: this is not fillable, so a stray request body can never
        // silence someone through mass assignment.
        $user->forceFill(['muted_notification_categories' => $muted->all()])->save();

        return response()->json([
            'message' => $validated['muted']
                ? NotificationCategory::LABELS[$validated['category']] . ' muted.'
                : NotificationCategory::LABELS[$validated['category']] . ' unmuted.',
            'muted'   => $muted->all(),
        ]);
    }

    /**
     * Members this person has pinned (§5.7).
     */
    public function pinned(Request $request)
    {
        $pins = \App\Models\PinnedMember::where('user_id', $request->user()->id)
            ->with('pinned:id,name,username,avatar')
            ->get();

        return response()->json([
            'data' => $pins->map(fn ($p) => [
                'id'     => $p->pinned?->id,
                'name'   => $p->pinned?->name,
                'username' => $p->pinned?->username,
                'avatar' => $p->pinned?->avatar_url,
            ])->filter(fn ($p) => $p['id'] !== null)->values(),
        ]);
    }

    /**
     * Pin or unpin another member.
     */
    public function togglePin(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = $request->user();

        if ($validated['user_id'] === $user->id) {
            return response()->json(['message' => 'You cannot pin yourself.'], 422);
        }

        $existing = \App\Models\PinnedMember::where('user_id', $user->id)
            ->where('pinned_user_id', $validated['user_id'])
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json(['pinned' => false, 'message' => 'Unpinned.']);
        }

        \App\Models\PinnedMember::create([
            'user_id'        => $user->id,
            'pinned_user_id' => $validated['user_id'],
        ]);

        return response()->json(['pinned' => true, 'message' => 'Pinned. Their activity will stand out in your notifications.']);
    }

    public function markRead(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $notification->update(['read_at' => now()]);
        return response()->json(['message' => 'Marked as read']);
    }

    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
        return response()->json(['message' => 'All marked as read']);
    }

    public function destroy(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $notification->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function unreadCount(Request $request)
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();
        return response()->json(['count' => $count]);
    }
}
