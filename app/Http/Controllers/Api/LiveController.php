<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LiveSession;
use App\Models\LiveSessionComment;
use App\Models\Notification;
use App\Models\User;
use App\Support\NotificationCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LiveController extends Controller
{
    public function current(Request $request)
    {
        $session = LiveSession::where('status', 'live')->latest()->first();
        if (!$session) {
            $session = LiveSession::where('status', 'scheduled')
                ->where('scheduled_at', '>', now())
                ->orderBy('scheduled_at')
                ->first();
        }

        // Count this member as having joined. `viewers_count` was shown on both
        // the member and admin screens as an audience figure and nothing ever
        // incremented it, so it read 0 while people were watching.
        if ($session && $session->status === 'live' && $request->user()) {
            $this->recordView($session, $request->user()->id);
            $session->refresh();
        }

        return response()->json(['session' => $session ? $this->format($session) : null]);
    }

    /**
     * One row per member per session, so the figure is distinct people who
     * opened it — not a total that climbs every time the page polls.
     */
    private function recordView(LiveSession $session, int $userId): void
    {
        $inserted = DB::table('live_session_views')->insertOrIgnore([
            'live_session_id' => $session->id,
            'user_id'         => $userId,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        if ($inserted) {
            $session->increment('viewers_count');
        }
    }

    public function replays(Request $request)
    {
        $sessions = LiveSession::where('status', 'ended')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();
        return response()->json(['replays' => $sessions->map(fn($s) => $this->format($s))]);
    }

    public function show(LiveSession $session)
    {
        return response()->json(['session' => $this->format($session)]);
    }

    public function comments(LiveSession $session)
    {
        $comments = $session->comments()
            ->with('user:id,name,avatar,email')
            ->orderBy('created_at')
            ->get()
            ->map(fn($c) => [
                'id'         => $c->id,
                'content'    => $c->content,
                'user'       => ['id' => $c->user->id, 'name' => $c->user->name, 'avatar' => $c->user->avatar_url],
                'created_at' => $c->created_at,
            ]);
        return response()->json(['comments' => $comments]);
    }

    public function addComment(Request $request, LiveSession $session)
    {
        $data = $request->validate(['content' => 'required|string|max:500']);
        $comment = LiveSessionComment::create([
            'live_session_id' => $session->id,
            'user_id'         => $request->user()->id,
            'content'         => $data['content'],
        ]);
        $comment->load('user');
        return response()->json([
            'comment' => [
                'id'         => $comment->id,
                'content'    => $comment->content,
                'user'       => ['id' => $comment->user->id, 'name' => $comment->user->name, 'avatar' => $comment->user->avatar_url],
                'created_at' => $comment->created_at,
            ],
        ], 201);
    }

    public function like(LiveSession $session)
    {
        $session->increment('likes_count');
        return response()->json(['likes_count' => $session->fresh()->likes_count]);
    }

    // Admin
    public function adminIndex(Request $request)
    {
        if (!$request->user()?->is_admin) abort(403);
        $sessions = LiveSession::orderByDesc('created_at')->get();
        return response()->json(['sessions' => $sessions->map(fn($s) => $this->format($s))]);
    }

    public function store(Request $request)
    {
        if (!$request->user()?->is_admin) abort(403);
        $data = $request->validate([
            'title'           => 'required|string|max:255',
            'description'     => 'nullable|string',
            'instructor_name' => 'nullable|string',
            'category'        => 'nullable|string',
            'difficulty'      => 'nullable|string',
            'scheduled_at'    => 'nullable|date',
            'thumbnail_url'   => 'nullable|url',
            'stream_url'      => 'nullable|string',
            'status'          => 'nullable|in:scheduled,live,ended',
        ]);
        $session = LiveSession::create($data);

        // Going live is a one-step action in the Live Manager: it POSTs here with
        // status already 'live' rather than creating a scheduled session and then
        // updating it. Only update() notified, so nobody was ever told a stream
        // had started — while the same screen promised "Members will be notified
        // instantly" and showed them a preview of the notification.
        if (($data['status'] ?? null) === 'live') {
            $this->notifyMembersLive($session, $request->user()->id);
        }

        return response()->json(['session' => $this->format($session)], 201);
    }

    public function update(Request $request, LiveSession $session)
    {
        if (!$request->user()?->is_admin) abort(403);
        $data = $request->validate([
            'status'          => 'sometimes|in:scheduled,live,ended',
            'viewers_count'   => 'sometimes|integer',
            'duration_minutes'=> 'sometimes|integer',
        ]);

        $wasLive = $session->status === 'live';
        $session->update($data);

        if (($data['status'] ?? null) === 'live' && !$wasLive) {
            $this->notifyMembersLive($session, $request->user()->id);
        }

        return response()->json(['session' => $this->format($session->fresh())]);
    }

    private function notifyMembersLive(LiveSession $session, int $exceptUserId): void
    {
        $now = now();
        // Notification::insert() below bypasses model events, so the mute the
        // Notification model normally enforces has to be applied here. Live
        // sessions are Announcements; a member who silenced that category must
        // not be pulled out of their evening by one.
        $muted = User::where('id', '!=', $exceptUserId)
            ->get(['id', 'muted_notification_categories'])
            ->filter(fn ($u) => $u->hasMutedCategory(NotificationCategory::PLATFORM))
            ->pluck('id')
            ->all();

        $rows = User::where('id', '!=', $exceptUserId)
            ->whereNotIn('id', $muted)
            ->pluck('id')
            ->map(fn($userId) => [
                'user_id'      => $userId,
                'type'         => 'live_session',
                'title'        => "Live now: {$session->title}",
                'body'         => $session->instructor_name ? "with {$session->instructor_name}" : 'Join now!',
                'data'         => json_encode(['session_id' => $session->id]),
                'link'         => '/live',
                'created_at'   => $now,
                'updated_at'   => $now,
            ])->toArray();

        foreach (array_chunk($rows, 500) as $chunk) {
            Notification::insert($chunk);
        }
    }

    private function format(LiveSession $s): array
    {
        return [
            'id'               => $s->id,
            'title'            => $s->title,
            'description'      => $s->description,
            'instructor_name'  => $s->instructor_name,
            'thumbnail_url'    => $s->thumbnail_url,
            'stream_url'       => $s->stream_url,
            'status'           => $s->status,
            'scheduled_at'     => $s->scheduled_at,
            'viewers_count'    => $s->viewers_count,
            'likes_count'      => $s->likes_count,
            'duration_minutes' => $s->duration_minutes,
            'category'         => $s->category,
            'difficulty'       => $s->difficulty,
            'created_at'       => $s->created_at,
        ];
    }
}
