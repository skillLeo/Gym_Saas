<?php

namespace App\Support;

/**
 * Groups notification types into the sections a member actually thinks in.
 *
 * The page was one flat list of every type mixed together, so a member hunting
 * for "did anyone reply to me" had to read past follows, streaks and platform
 * announcements. Types are an implementation detail; categories are what people
 * mean when they say "stop telling me about likes".
 *
 * A type that is not mapped falls into PLATFORM rather than vanishing — a new
 * notification type must never become invisible because nobody updated a map.
 */
final class NotificationCategory
{
    public const MESSAGES  = 'messages';
    public const COMMENTS  = 'comments';
    public const REACTIONS = 'reactions';
    public const FOLLOWS   = 'follows';
    public const PLATFORM  = 'platform';

    /**
     * Category → the notification types that belong to it.
     *
     * NOT included: "Tags and mentions". There is no mention feature anywhere in
     * the app — nothing writes such a notification — so a section for it would
     * sit permanently empty and read as broken. It goes in the moment mentions
     * exist.
     */
    public const MAP = [
        self::MESSAGES  => ['direct_message'],
        self::COMMENTS  => ['post_comment', 'post_reply'],
        self::REACTIONS => ['post_reaction', 'like'],
        self::FOLLOWS   => ['follow'],
        self::PLATFORM  => [
            // The Vibe Thread is the one platform-wide channel, so it belongs
            // here rather than under Messages (which means private messages to
            // a member). It also has its own dedicated mute — see
            // VibeThreadController::mute() — for members who want to silence
            // just the thread without silencing announcements.
            'vibe_thread',
            'live_session', 'group_approved', 'group_rejected',
            'recipe_approved', 'recipe_rejected',
            'week_streak', 'month_streak', 'achievement',
            'motivational', 'coupon', 'system', 'admin', 'physician',
        ],
    ];

    /** Display order and labels, kept server-side so both ends agree. */
    public const LABELS = [
        self::MESSAGES  => 'Messages',
        self::COMMENTS  => 'Comments and replies',
        self::REACTIONS => 'Likes and reactions',
        self::FOLLOWS   => 'New followers',
        self::PLATFORM  => 'Announcements',
    ];

    /** @return string[] */
    public static function all(): array
    {
        return array_keys(self::LABELS);
    }

    /** Which section a given notification type belongs to. */
    public static function forType(?string $type): string
    {
        foreach (self::MAP as $category => $types) {
            if (in_array($type, $types, true)) {
                return $category;
            }
        }

        return self::PLATFORM;
    }

    /** Every type inside a category, for querying. */
    public static function typesIn(string $category): array
    {
        return self::MAP[$category] ?? [];
    }

    public static function isValid(string $category): bool
    {
        return array_key_exists($category, self::LABELS);
    }
}
