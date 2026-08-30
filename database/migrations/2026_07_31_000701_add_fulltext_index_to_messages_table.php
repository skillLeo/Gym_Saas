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

    private function indexExists(): bool
    {
        if (!Schema::hasTable('messages')) {
            return false;
        }

        return collect(DB::select('SHOW INDEX FROM `messages`'))
            ->contains(fn ($i) => $i->Key_name === self::INDEX);
    }
};
