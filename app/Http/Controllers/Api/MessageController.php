<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    public function conversations(Request $request)
    {
        $userId = $request->user()->id;

        $conversationIds = DB::table('conversation_participants')
            ->where('user_id', $userId)
            ->pluck('conversation_id');

        $conversations = Conversation::whereIn('id', $conversationIds)
            ->with(['participants', 'latestMessage.sender'])
            ->get()
            ->sortByDesc(fn($c) => optional($c->latestMessage)->created_at)
            ->values();

        $formatted = $conversations->map(fn($c) => $this->formatConversation($c, $userId));

        $totalUnread = $formatted->sum('unread_count');

        return response()->json([
            'conversations' => $formatted,
            'total_unread'  => $totalUnread,
        ]);
    }

    public function show(Request $request, Conversation $conversation)
    {
        $userId = $request->user()->id;
        $this->assertParticipant($conversation, $userId);

        // mark read
        DB::table('conversation_participants')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->update(['last_read_at' => now()]);

        $messages = $conversation->messages()
            ->with('sender:id,name,avatar,email')
            ->get()
            ->map(fn($m) => $this->formatMessage($m, $userId));

        return response()->json([
            'conversation' => $this->formatConversation($conversation->load(['participants', 'latestMessage']), $userId),
            'messages'     => $messages,
        ]);
    }

    public function messages(Request $request, Conversation $conversation)
    {
        $userId = $request->user()->id;
        $this->assertParticipant($conversation, $userId);

        $since    = $request->input('since');
        $query    = $conversation->messages()->with('sender:id,name,avatar,email');
        if ($since) {
            $query->where('id', '>', $since);
        }

        DB::table('conversation_participants')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->update(['last_read_at' => now()]);

        return response()->json([
            'messages' => $query->get()->map(fn($m) => $this->formatMessage($m, $userId)),
        ]);
    }

    public function send(Request $request, Conversation $conversation)
    {
        $userId = $request->user()->id;
        $this->assertParticipant($conversation, $userId);

        $data = $request->validate([
            'content'   => 'nullable|string|max:5000',
            'image_url' => 'nullable|string|max:2048',
        ]);
        if (empty($data['content']) && empty($data['image_url'])) {
            return response()->json(['message' => 'Message cannot be empty.'], 422);
        }

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id'       => $userId,
            'content'         => $data['content'] ?? '',
            'image_url'       => $data['image_url'] ?? null,
        ]);

        $this->notifyRecipient($conversation, $request->user(), $message);

        return response()->json(['message' => $this->formatMessage($message->load('sender'), $userId)], 201);
    }

    /**
     * Tell the other participant a message arrived.
     *
     * Direct messages produced no notification at all — the only signal was the
     * unread badge on the Messages tab, which a member sees only once they are
     * already looking at it. That also left the "Messages" section of the
     * notifications page with nothing that could ever appear in it.
     *
     * Deliberately at most one unread notification per conversation: a ten
     * message burst should say "you have messages waiting", not bury every other
     * notification the member has. The Notification model drops this entirely if
     * they have muted the Messages category.
     */
    private function notifyRecipient(Conversation $conversation, User $sender, Message $message): void
    {
        $recipientId = DB::table('conversation_participants')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $sender->id)
            ->value('user_id');

        if (!$recipientId) return;

        $existing = \App\Models\Notification::where('user_id', $recipientId)
            ->where('type', 'direct_message')
            ->whereNull('read_at')
            ->whereJsonContains('data->conversation_id', $conversation->id)
            ->first();

        $body = trim($message->content) !== ''
            ? \Illuminate\Support\Str::limit($message->content, 80)
            : 'Sent you a photo';

        if ($existing) {
            $existing->update(['body' => $body, 'created_at' => now()]);
            return;
        }

        \App\Models\Notification::create([
            'user_id'      => $recipientId,
            'type'         => 'direct_message',
            // A verb phrase, not a heading: the card prints the sender's name
            // immediately before this, so "New message from Alex" rendered as
            // "Alex New message from Alex".
            'title'        => 'sent you a message',
            'body'         => $body,
            'data'         => ['actor_id' => $sender->id, 'conversation_id' => $conversation->id],
            'actor_name'   => $sender->name,
            'actor_avatar' => $sender->avatar_url,
            'link'         => "/messages/{$conversation->id}",
        ]);
    }

    public function startConversation(Request $request)
    {
        $data = $request->validate(['user_id' => 'required|exists:users,id']);
        $userId     = $request->user()->id;
        $otherUserId = $data['user_id'];

        if ($userId === $otherUserId) {
            return response()->json(['message' => 'Cannot message yourself'], 422);
        }

        // find existing conversation between these two
        $existing = DB::table('conversation_participants as a')
            ->join('conversation_participants as b', 'a.conversation_id', '=', 'b.conversation_id')
            ->where('a.user_id', $userId)
            ->where('b.user_id', $otherUserId)
            ->value('a.conversation_id');

        if ($existing) {
            $conversation = Conversation::find($existing);
        } else {
            $conversation = Conversation::create();
            DB::table('conversation_participants')->insert([
                ['conversation_id' => $conversation->id, 'user_id' => $userId,      'created_at' => now(), 'updated_at' => now()],
                ['conversation_id' => $conversation->id, 'user_id' => $otherUserId, 'created_at' => now(), 'updated_at' => now()],
            ]);
        }

        return response()->json([
            'conversation' => $this->formatConversation($conversation->load(['participants', 'latestMessage']), $userId),
        ], 201);
    }

    private function assertParticipant(Conversation $conversation, int $userId): void
    {
        $isMember = DB::table('conversation_participants')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->exists();
        // A bare abort(403) returned an empty body, so the client had nothing to
        // show and rendered a blank conversation screen — correct, but it looks
        // like the app broke rather than like a door being closed.
        if (!$isMember) {
            abort(403, 'You are not part of this conversation.');
        }
    }

    private function formatConversation(Conversation $c, int $userId): array
    {
        $other = $c->participants->firstWhere('id', '!=', $userId) ?? $c->participants->first();

        $myPivot   = DB::table('conversation_participants')
            ->where('conversation_id', $c->id)->where('user_id', $userId)->first();
        $lastRead  = $myPivot?->last_read_at;

        $unread = Message::where('conversation_id', $c->id)
            ->where('sender_id', '!=', $userId)
            ->when($lastRead, fn($q) => $q->where('created_at', '>', $lastRead))
            ->count();

        return [
            'id'              => $c->id,
            'other_user'      => $other ? ['id' => $other->id, 'name' => $other->name, 'avatar' => $other->avatar_url] : null,
            'latest_message'  => $c->latestMessage ? $this->formatMessage($c->latestMessage, $userId) : null,
            'unread_count'    => $unread,
            'updated_at'      => $c->updated_at,
        ];
    }

    private function formatMessage(Message $m, int $userId): array
    {
        return [
            'id'         => $m->id,
            'content'    => $m->content,
            'image_url'  => $m->image_url,
            'is_mine'    => $m->sender_id === $userId,
            'sender'     => $m->sender ? ['id' => $m->sender->id, 'name' => $m->sender->name, 'avatar' => $m->sender->avatar_url] : null,
            'created_at' => $m->created_at,
        ];
    }
}
