<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Puts member-written recipes behind review before they reach the shared library.
 *
 * Anything a member created went straight into the library every other member
 * browses — a boolean `is_public` defaulting to true with nothing between the
 * Save button and the whole membership. The client asked for the same treatment
 * Groups already get: private by default, submitted for review, approved or
 * declined with a reason by an admin.
 *
 * `status` is the single source of truth for library visibility. `is_public` is
 * kept in step with it (approved = public) so any code still reading that column
 * keeps working, but nothing should decide visibility from it any more.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->enum('status', ['private', 'pending', 'approved', 'rejected'])
                  ->default('private')
                  ->after('is_public')
                  ->index();
            $table->text('rejection_reason')->nullable()->after('status');
        });

        // The seeded library has no author and is the curated collection — it
        // stays exactly where it is.
        DB::table('recipes')->whereNull('user_id')->update(['status' => 'approved', 'is_public' => true]);

        // Everything a member wrote drops back to private. Nothing is deleted;
        // authors keep their recipes and can submit them for review.
        DB::table('recipes')->whereNotNull('user_id')->update(['status' => 'private', 'is_public' => false]);
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn(['status', 'rejection_reason']);
        });
    }
};
