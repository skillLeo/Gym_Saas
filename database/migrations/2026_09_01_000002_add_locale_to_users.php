<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The site language was entirely browser-side (a Zustand store persisted to
 * localStorage), so it was tied to the device, not the account — two members
 * signing in from the same computer saw whichever language the last one left
 * behind, and a member's own preference never followed them to a new device.
 * This column is now the source of truth; the localStorage copy stays only as
 * the pre-login fallback for the marketing site, where there is no account yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('locale', 5)->default('en')->after('email_notifications');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('locale');
        });
    }
};
