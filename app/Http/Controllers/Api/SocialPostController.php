<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Follow;
use App\Models\PostReaction;
use App\Models\SocialPost;
use Illuminate\Http\Request;

class SocialPostController extends Controller
{
    /**
     * @param array<int,bool>|null $savedIds Pre-fetched set of post ids this
     *        member has bookmarked, keyed by id. Passed in by list endpoints so
     *        rendering a feed of 15 posts costs one query, not fifteen. When
     *        null (single-post responses) it is looked up for just that post.
     */
    private function formatPost(SocialPost $post, int $authId, ?array $savedIds = null): array
    {
        $isSaved = $savedIds !== null
            ? isset($savedIds[$post->id])
            : \DB::table('saved_posts')->where('user_id', $authId)->where('post_id', $post->id)->exists();

        $reactions = $post->reactions->groupBy('reaction')->map->count()->toArray();
        $myReaction = $post->reactions->firstWhere('user_id', $authId)?->reaction;
        $totalReactions = $post->reactions->count();
        // Prefer the eager-loaded total. Two COUNT(*) queries per post is an
        // N+1: a 20-post page paid 40 extra round trips for a number the list
        // query can produce in one. The fallback covers single-post responses,
        // which do not go through the list query.
        $commentCount = $post->all_comments_count
            ?? ($post->comments()->count()
                + \App\Models\PostComment::where('post_id', $post->id)->whereNotNull('parent_id')->count());

        return [
            'id'             => $post->id,
            'content'        => $post->content,
            'image_url'      => $post->image_url,
            'post_type'      => $post->post_type,
            'created_at'     => $post->created_at,
            'reactions'      => $reactions,
            'total_reactions'=> $totalReactions,
            'my_reaction'    => $myReaction,
            'comment_count'  => $commentCount,
            'is_saved'       => $isSaved,
            'user' => [
                'id'         => $post->user->id,
                'name'       => $post->user->name,
                'username'   => $post->user->username,
                'avatar_url' => $post->user->avatar_url,
            ],
        ];
    }

    public function index(Request $request)
    {
        $user   = $request->user();
        $tab    = $request->input('tab', 'foryou');
        $perPage = min((int) ($request->per_page ?? 15), 50);

        $query = SocialPost::with(['user', 'reactions'])->withCount('allComments')->orderByDesc('created_at');

        if ($tab === 'following') {
            $followingIds = Follow::where('follower_id', $user->id)->pluck('following_id');
            $query->whereIn('user_id', $followingIds);
        }

        $posts = $query->paginate($perPage);

        // One query for the whole page rather than one per post.
        $savedIds = \DB::table('saved_posts')
            ->where('user_id', $user->id)
            ->whereIn('post_id', $posts->getCollection()->pluck('id'))
            ->pluck('post_id')->flip()->all();

        $formatted = $posts->getCollection()->map(fn($p) => $this->formatPost($p, $user->id, $savedIds));

        return response()->json(['success' => true, 'data' => [
            'data'         => $formatted,
            'current_page' => $posts->currentPage(),
            'last_page'    => $posts->lastPage(),
        ]]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'content'   => 'required|string|max:2000',
            'image_url' => 'nullable|url|max:2048',
            'post_type' => 'nullable|in:text,photo,achievement',
        ]);

        $post = SocialPost::create(array_merge($validated, [
            'user_id'   => $request->user()->id,
            // Pre-existing crash, found while testing the content-flag wiring:
            // when `image_url` is omitted from the request entirely (not sent
            // as null, just absent), it never enters $validated at all, so a
            // bare $validated['image_url'] threw "Undefined array key" —
            // surfaced as a real 500 to any post created without a photo.
            'post_type' => $validated['post_type'] ?? (($validated['image_url'] ?? null) ? 'photo' : 'text'),
        ]));

        // Flag and notify only (§6.4) — never blocks or alters the post itself.
        app(\App\Services\ContentModeration\ContentScanner::class)->scan($post, $post->content);

        $post->load(['user', 'reactions']);
        return response()->json(['success' => true, 'data' => $this->formatPost($post, $request->user()->id)], 201);
    }

    public function destroy(Request $request, SocialPost $socialPost)
    {
        if ($socialPost->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }
        $socialPost->delete();
        return response()->json(['success' => true, 'message' => 'Post deleted.']);
    }

    public function react(Request $request, SocialPost $socialPost)
    {
        // Widened from max:10. Members can now pick any emoji rather than six
        // fixed ones, and joined sequences (families, skin tones, flags) run to
        // several code points — 👨‍👩‍👧‍👦 alone is 7 characters.
        //
        // The length cap alone was not enough: it accepted any short string, so
        // a caller could POST reaction="SCAM" and have that word render as a
        // chip on someone else's post. The reaction chip is drawn verbatim in
        // other members' feeds, so this field is other people's screen space.
        // Rejecting anything with letters or digits keeps every real emoji
        // (including joined and skin-toned sequences) and blocks text.
        $request->validate([
            'reaction' => ['required', 'string', 'max:24', 'not_regex:/[\p{L}\p{N}]/u'],
        ], [
            'reaction.not_regex' => 'A reaction must be an emoji.',
        ]);
        $userId = $request->user()->id;

        $existing = PostReaction::where('post_id', $socialPost->id)->where('user_id', $userId)->first();
        if ($existing) {
            if ($existing->reaction === $request->reaction) {
                $existing->delete();
                $action = 'removed';
            } else {
                $existing->update(['reaction' => $request->reaction]);
                $action = 'changed';
            }
        } else {
            PostReaction::create(['post_id' => $socialPost->id, 'user_id' => $userId, 'reaction' => $request->reaction]);
            $action = 'added';
            // Notify on a new reaction only — not on removing or swapping one,
            // which would spam the author for a single change of mind.
            app(\App\Services\SocialNotifier::class)->reacted($request->user(), $socialPost, $request->reaction);
        }

        $socialPost->load('reactions');
        $reactions = $socialPost->reactions->groupBy('reaction')->map->count()->toArray();
        $myReaction = $socialPost->reactions->firstWhere('user_id', $userId)?->reaction;

        return response()->json(['success' => true, 'data' => [
            'action'         => $action,
            'reactions'      => $reactions,
            'total_reactions'=> $socialPost->reactions->count(),
            'my_reaction'    => $myReaction,
        ]]);
    }

    /**
     * Bookmark or un-bookmark a post.
     *
     * The feed's Save button previously had no handler whatsoever. Toggling is
     * keyed on the UNIQUE (user_id, post_id) index rather than a read-then-write,
     * so a double-click cannot create two rows.
     */
    public function toggleSave(Request $request, SocialPost $socialPost)
    {
        $userId = $request->user()->id;

        $existing = \DB::table('saved_posts')
            ->where('user_id', $userId)->where('post_id', $socialPost->id)->first();

        if ($existing) {
            \DB::table('saved_posts')->where('id', $existing->id)->delete();

            return response()->json(['success' => true, 'action' => 'unsaved', 'is_saved' => false]);
        }

        \DB::table('saved_posts')->insertOrIgnore([
            'user_id'    => $userId,
            'post_id'    => $socialPost->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'action' => 'saved', 'is_saved' => true]);
    }

    /**
     * The posts this member has bookmarked, newest save first.
     */
    public function saved(Request $request)
    {
        $userId = $request->user()->id;

        $ids = \DB::table('saved_posts')
            ->where('user_id', $userId)->orderByDesc('id')->pluck('post_id');

        $posts = SocialPost::with(['user', 'reactions'])->withCount('allComments')
            ->whereIn('id', $ids)
            ->get()
            // Preserve save order rather than post order.
            ->sortBy(fn ($p) => $ids->search($p->id))
            ->values();

        return response()->json(['success' => true, 'data' => [
            'data'         => $posts->map(fn ($p) => $this->formatPost($p, $userId)),
            'current_page' => 1,
            'last_page'    => 1,
        ]]);
    }

    public function userPosts(Request $request, string $username)
    {
        $user = \App\Models\User::where('username', $username)->firstOrFail();
        $authId = $request->user()->id;

        $posts = SocialPost::with(['user', 'reactions'])->withCount('allComments')
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate(12);

        $formatted = $posts->getCollection()->map(fn($p) => $this->formatPost($p, $authId));
        return response()->json(['success' => true, 'data' => $formatted]);
    }
}
