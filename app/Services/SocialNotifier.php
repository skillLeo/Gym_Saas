<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\SocialPost;
use App\Models\User;

/**
 * Notifications for member-to-member social activity (§5.7).
 *
 * TITLE AND BODY CONVENTION — read before adding a type here.
 *
 * The notifications page renders `actor_name` in bold and then the title, so a
 * title must be the VERB PHRASE that follows the name ("commented on your
 * post"), never a heading ("New comment") and never a sentence containing the
 * name again. Every type in this file once did the latter and every one of them
 * printed the name twice: "Test User New comment — Test User: nice work".
 *
 * The body carries the CONTENT only — the comment text, the message preview —
 * with no name prefix, or null when there is nothing to quote.
 *
 * Platform notifications with no actor (live sessions, streaks, achievements)
 * are the exception: those titles stand alone and read as headings.
 *
 * These did not exist: the only producers were LiveController and the
 * motivational sender, both platform-generated with no actor. That left
 * pinning and the owner accent with nothing to act on, because both key off
 * `data.actor_id`.
 *
 * Every notification created here carries `actor_id`, which is what makes a
 * pinned member's activity identifiable. Matching on `actor_name` instead would
 * mis-highlight anyone sharing a display name.
 */
class SocialNotifier
{
    /**
     * Someone reacted to a post.
     */
    public function reacted(User $actor, SocialPost $post, string $reaction): void
    {
        $this->send($actor, $post->user_id, 'post_reaction',
            "reacted {$reaction} to your post",
            null,
            ['post_id' => $post->id, 'reaction' => $reaction],
            '/social',
        );
    }

    /**
     * Someone commented on a post.
     */
    public function commented(User $actor, SocialPost $post, string $excerpt): void
    {
        $this->send($actor, $post->user_id, 'post_comment',
            'commented on your post',
            \Illuminate\Support\Str::limit($excerpt, 80),
            ['post_id' => $post->id],
            '/social',
        );
    }

    /**
     * Someone replied to this member's comment.
     *
     * Distinct from `commented()`, which tells the POST owner. A reply concerns
     * the person being answered, who is usually not the post owner — before
     * this existed they were never notified that anyone had responded to them.
     */
    public function repliedToComment(User $actor, int $parentAuthorId, SocialPost $post, string $excerpt): void
    {
        $this->send($actor, $parentAuthorId, 'post_reply',
            'replied to your comment',
            \Illuminate\Support\Str::limit($excerpt, 70),
            ['post_id' => $post->id],
            '/social',
        );
    }

    /**
     * Someone started following a member.
     */
    public function followed(User $actor, int $followedUserId): void
    {
        $this->send($actor, $followedUserId, 'follow',
            'started following you',
            null,
            [],
            $actor->username ? "/social/{$actor->username}" : '/social',
        );
    }

    /**
     * Create the row, unless the actor is the recipient.
     *
     * Nobody should be notified about their own activity — reacting to your own
     * post is common and a self-notification reads as a bug.
     */
    private function send(
        User $actor,
        ?int $recipientId,
        string $type,
        string $title,
        ?string $body,
        array $data,
        string $link,
    ): void {
        if (!$recipientId || $recipientId === $actor->id) {
            return;
        }

        Notification::create([
            'user_id'      => $recipientId,
            'type'         => $type,
            'title'        => $title,
            'body'         => $body,
            // actor_id is what pinning and the owner accent resolve against.
            'data'         => ['actor_id' => $actor->id] + $data,
            'actor_name'   => $actor->name,
            'actor_avatar' => $actor->avatar_url,
            'link'         => $link,
        ]);
    }
}
