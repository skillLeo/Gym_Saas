<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Strips the app's own origin out of every stored media column.
 *
 * These columns were written with `asset('storage/...')`, so the host and port
 * in force at upload time were frozen into the row. A chat photo uploaded while
 * the API answered on :8000 stayed pointed at :8000 forever, and the whole
 * library would break the moment the app moved to its production domain.
 *
 * From here the models cast these columns through App\Support\MediaUrl: a
 * relative path in the database, expanded against the current APP_URL on read.
 * This migration brings existing rows into that shape.
 *
 * Only values shaped like `scheme://host/storage/<path>` are touched. Anything
 * else — Unsplash covers, YouTube links, ui-avatars fallbacks — is left alone,
 * because those URLs are not ours to rewrite.
 */
return new class extends Migration
{
    /** [table, column] pairs — a list, not a map, because `videos` owns two. */
    private function targets(): array
    {
        return [
            ['messages',         'image_url'],
            ['social_posts',     'image_url'],
            ['food_log_entries', 'image_url'],
            ['recipes',          'image_url'],
            ['videos',           'thumbnail_url'],
            ['videos',           'video_url'],
            ['live_sessions',    'thumbnail_url'],
            ['notifications',    'actor_avatar'],
        ];
    }

    public function up(): void
    {
        foreach ($this->targets() as [$table, $column]) {
            DB::table($table)
                ->whereNotNull($column)
                ->where($column, 'like', 'http%://%/storage/%')
                ->orderBy('id')
                ->chunkById(500, function ($rows) use ($table, $column) {
                    foreach ($rows as $row) {
                        $stripped = preg_replace('#^https?://[^/]+/storage/#i', '', $row->{$column});
                        if ($stripped !== null && $stripped !== $row->{$column}) {
                            DB::table($table)->where('id', $row->id)->update([$column => $stripped]);
                        }
                    }
                });
        }
    }

    /**
     * Deliberately a no-op.
     *
     * Reversing would mean re-baking *this* machine's origin into every row —
     * which is the bug. The stored paths are readable by the new accessors and
     * by the old code path alike (the old code emitted absolute URLs but never
     * required them on the way in), so there is nothing to undo.
     */
    public function down(): void
    {
        //
    }
};
