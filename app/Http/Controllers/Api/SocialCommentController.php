<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostComment;
use App\Models\SocialPost;
use Illuminate\Http\Request;

class SocialCommentController extends Controller
{
    public function index(SocialPost $socialPost)
    {
        $comments = PostComment::with(['user', 'replies.user'])
            ->where('post_id', $socialPost->id)
            ->whereNull('parent_id')
            ->orderBy('created_at')
            ->get();

        return response()->json(['success' => true, 'data' => $comments->map(fn($c) => $this->format($c))]);
    }

    public function store(Request $request, SocialPost $socialPost)
    {
        $validated = $request->validate([
            'content'   => 'required|string|max:1000',
            'parent_id' => 'nullable|exists:post_comments,id',
        ]);

        $comment = PostComment::create([
            'post_id'   => $socialPost->id,
            'user_id'   => $request->user()->id,
            'content'   => $validated['content'],
            'parent_id' => $validated['parent_id'] ?? null,
        ]);

        $notifier = app(\App\Services\SocialNotifier::class);

        // The post owner is told about any comment on their post.
        $notifier->commented($request->user(), $socialPost, $validated['content']);

        // ...and, separately, whoever is being REPLIED TO. Without this a reply
        // only ever notified the post owner, so the person whose comment was
        // answered was never told — and when the post owner replied to someone
        // on their own post, nobody was notified at all (the owner is skipped as
        // their own actor). Guarded against double-notifying when the parent
        // comment's author happens to be the post owner.
        if (!empty($validated['parent_id'])) {
            $parent = PostComment::find($validated['parent_id']);

            if ($parent && $parent->user_id !== $socialPost->user_id) {
                $notifier->repliedToComment($request->user(), $parent->user_id, $socialPost, $validated['content']);
            }
        }

        // Flag and notify only (§6.4) — never blocks or alters the comment.
        app(\App\Services\ContentModeration\ContentScanner::class)->scan($comment, $comment->content);

        $comment->load(['user', 'replies.user']);
        return response()->json(['success' => true, 'data' => $this->format($comment)], 201);
    }

    public function destroy(Request $request, PostComment $postComment)
    {
        if ($postComment->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }
        $postComment->delete();
        return response()->json(['success' => true, 'message' => 'Comment deleted.']);
    }

    private function format(PostComment $c): array
    {
        return [
            'id'         => $c->id,
            'content'    => $c->content,
            'parent_id'  => $c->parent_id,
            'created_at' => $c->created_at,
            'user' => [
                'id'         => $c->user->id,
                'name'       => $c->user->name,
                'username'   => $c->user->username,
                'avatar_url' => $c->user->avatar_url,
            ],
            'replies' => $c->replies->map(fn($r) => [
                'id'         => $r->id,
                'content'    => $r->content,
                'created_at' => $r->created_at,
                'user' => [
                    'id'         => $r->user->id,
                    'name'       => $r->user->name,
                    'username'   => $r->user->username,
                    'avatar_url' => $r->user->avatar_url,
                ],
            ])->values(),
        ];
    }
}
