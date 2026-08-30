<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Casts\Attribute;

/**
 * Keeps uploaded-media columns free of the app's own origin.
 *
 * `UploadController` hands the browser an absolute URL built with `asset()`,
 * and that string used to be persisted verbatim. The host and port were
 * therefore frozen into the row at upload time, so every image saved before an
 * origin change broke permanently — a chat photo in the seeded conversation was
 * still pointing at `localhost:8000` months after the API moved to `:8001`, and
 * the whole library would have died the day the app moved to its production
 * domain.
 *
 * Media we host is now stored as a disk-relative path (`messages/x.jpg`) and
 * expanded against the *current* APP_URL on the way out. Third-party URLs
 * (Unsplash covers, YouTube embeds, ui-avatars fallbacks) are left exactly as
 * they are — they are not ours to rewrite.
 */
final class MediaUrl
{
    /**
     * Reduce one of our own absolute `/storage/...` URLs to the path underneath
     * it. Anything else — an external URL, or a value that is already a path —
     * is returned untouched.
     */
    public static function normalize(?string $value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;
        if ($value === null || $value === '') {
            return null;
        }

        // Deliberately anchored on `/storage/` directly after the host: that is
        // the shape `asset('storage/...')` produces, and it is specific enough
        // not to catch a third-party URL that merely has "storage" in its path.
        if (preg_match('#^https?://[^/]+/storage/(.+)$#i', $value, $m)) {
            return ltrim(urldecode($m[1]), '/');
        }

        return $value;
    }

    /** Expand a stored value into something a browser can actually load. */
    public static function resolve(?string $value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;
        if ($value === null || $value === '') {
            return null;
        }

        // Someone else's URL, or a data URI — hand it back as-is.
        if (preg_match('#^(https?:)?//#i', $value) || str_starts_with($value, 'data:')) {
            return $value;
        }

        // A root-relative path that is not on the public disk (rare, but a
        // stored "/img/foo.png" should not become "/storage//img/foo.png").
        if (str_starts_with($value, '/')) {
            return url($value);
        }

        return asset('storage/' . $value);
    }

    /**
     * The cast to hang on a media column: normalises on write, resolves on read.
     *
     * Using an attribute rather than fixing each controller means every existing
     * `->image_url` read and every `create([...])` write is covered, including
     * ones written after this change by someone who has not read this file.
     */
    public static function cast(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => self::resolve($value),
            set: fn (?string $value) => self::normalize($value),
        );
    }
}
