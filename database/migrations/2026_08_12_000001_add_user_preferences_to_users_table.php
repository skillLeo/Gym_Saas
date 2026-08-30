<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Backing store for two settings that had UI but nowhere to save to.
 *
 * The account settings "Email notifications" switch and the profile "Digital
 * Billboard" editor both reported success and then discarded the change on
 * reload — the toggle only ever set React state, and the billboard's "Save to
 * profile" button fired a toast and nothing else. Persisting them needs real
 * columns; there was no preferences store on `users` at all.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Opt-out rather than opt-in: existing members already receive
            // platform email, so defaulting to false would silently unsubscribe
            // everyone the moment this shipped.
            $table->boolean('email_notifications')->default(true)->after('daily_water_goal_glasses');

            // {text, font, color, background}. JSON rather than four columns —
            // it is one cohesive widget setting, and the shape may grow.
            $table->json('billboard')->nullable()->after('email_notifications');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['email_notifications', 'billboard']);
        });
    }
};
