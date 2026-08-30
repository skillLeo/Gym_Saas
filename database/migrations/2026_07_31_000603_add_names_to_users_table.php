<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nickname and alternate names on the member record (§5.6).
 *
 * `alternate_names` is the editable source of truth a member manages. It is
 * JSON because the shape is a free list, but it is never searched directly —
 * `user_name_aliases` is the indexed projection used for lookups, kept in sync
 * by model events. Searching JSON would mean a full scan on every keystroke.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nickname', 60)->nullable()->after('username');
            $table->json('alternate_names')->nullable()->after('nickname');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['nickname', 'alternate_names']);
        });
    }
};
