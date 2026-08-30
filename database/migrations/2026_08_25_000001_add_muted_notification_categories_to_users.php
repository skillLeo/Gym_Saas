<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-category notification mutes.
 *
 * The settings screen carried notification toggles that were local React state
 * and reset on reload — the comment there said real columns and endpoints were
 * still owed. This is that column.
 *
 * A JSON list of muted category keys rather than a boolean per category, so
 * adding a category later needs no migration. Empty/null means nothing muted,
 * which is the correct default for an existing member.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('muted_notification_categories')->nullable()->after('email_notifications');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('muted_notification_categories');
        });
    }
};
