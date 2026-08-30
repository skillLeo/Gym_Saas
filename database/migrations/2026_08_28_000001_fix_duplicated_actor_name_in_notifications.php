<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rewrite notifications whose title or body repeated the actor's name.
 *
 * The page prints `actor_name` and then the title, but every member-to-member
 * type also carried the name inside the text, so members read "Test User New
 * comment — Test User: nice work". The producing code is fixed; this repairs the
 * rows already sitting in the table, which are the ones a member actually sees.
 *
 * Data-only and idempotent: it rewrites `title` to the verb phrase and strips a
 * leading "<name>: " / "<name> " from `body`, leaving rows already in the new
 * shape untouched.
 */
return new class extends Migration
{
    /** type => the verb phrase that now follows the actor's name. */
    private const TITLES = [
        'post_reaction'  => null,   // rebuilt from data.reaction below
        'post_comment'   => 'commented on your post',
        'post_reply'     => 'replied to your comment',
        'follow'         => 'started following you',
        'direct_message' => 'sent you a message',
        'vibe_thread'    => 'posted in the Vibe Thread',
    ];

    public function up(): void
    {
        DB::table('notifications')
            ->whereIn('type', array_keys(self::TITLES))
            ->whereNotNull('actor_name')
            ->orderBy('id')
            ->chunkById(500, function ($rows) {
                foreach ($rows as $row) {
                    $name = trim((string) $row->actor_name);
                    if ($name === '') {
                        continue;
                    }

                    $title = self::TITLES[$row->type];

                    if ($row->type === 'post_reaction') {
                        $reaction = json_decode((string) $row->data, true)['reaction'] ?? null;
                        $title = $reaction
                            ? "reacted {$reaction} to your post"
                            : 'reacted to your post';
                    }

                    $body = $this->stripName($row->body, $name);

                    // A reaction's old body was the whole sentence and there is
                    // nothing else to quote, so it becomes empty rather than a
                    // fragment like "reacted to your post".
                    if ($row->type === 'post_reaction' || $row->type === 'follow') {
                        $body = null;
                    }

                    if ($row->title === $title && $row->body === $body) {
                        continue;
                    }

                    DB::table('notifications')
                        ->where('id', $row->id)
                        ->update(['title' => $title, 'body' => $body]);
                }
            });
    }

    /** Remove a leading "Name: ", "Name " or "Name replied: " from the body. */
    private function stripName(?string $body, string $name): ?string
    {
        if ($body === null || $body === '') {
            return $body;
        }

        $quoted = preg_quote($name, '/');
        $out = preg_replace(
            '/^' . $quoted . '\s*(?::|replied\s*:)?\s*/iu',
            '',
            $body,
            1,
        );

        return $out === '' ? null : $out;
    }

    /**
     * Not reversible: the original strings were redundant by construction and
     * putting the name back would recreate the defect.
     */
    public function down(): void
    {
    }
};
