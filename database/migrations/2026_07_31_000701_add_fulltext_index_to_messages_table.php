<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FULLTEXT index for message search (§5.5).
 *
 * The brief names the column `messages.body`; it is actually `messages.content`
 * on this schema. Indexing the real column rather than renaming it, since the
 * name is referenced across the existing messaging controllers and frontend.
 *
 * Raw SQL because Laravel's `fullText()` helper is MySQL/PostgreSQL specific and
 * this needs the guard below regardless — a FULLTEXT index cannot be added to a
 * non-InnoDB/MyISAM table, and re-running must not fail.
 */
return new class extends Migration
{
    private const INDEX = 'messages_content_fulltext';

    public function up(): void
    {
        if ($this->indexExists()) {
            return;
        }

        DB::statement('ALTER TABLE `messages` ADD FULLTEXT INDEX `' . self::INDEX . '` (`content`)');
    }

    public function down(): void
    {
        if (!$this->indexExists()) {
            return;
        }

        DB::statement('ALTER TABLE `messages` DROP INDEX `' . self::INDEX . '`');
    }

    /**
     * FULLTEXT and SHOW INDEX are both MySQL-only. SQLite has neither, so the
     * statement below is not merely unsupported there — `SHOW INDEX` is a
     * syntax error that aborts the entire migration run, which is what stopped
     * the test suite (sqlite :memory:) from booting at all.
     *
     * Reporting "already exists" off MySQL skips the index cleanly. Message
     * search is a MySQL feature of this application; the tests do not exercise
     * it, and silently having no FULLTEXT index on sqlite is correct rather
     * than a gap, because nothing on sqlite can use one.
     */
    private function indexExists(): bool
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return true;
        }

        if (!Schema::hasTable('messages')) {
            return false;
        }

        return collect(DB::select('SHOW INDEX FROM `messages`'))
            ->contains(fn ($i) => $i->Key_name === self::INDEX);
    }
};
