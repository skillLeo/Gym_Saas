<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Members a person has pinned, so that person's activity renders distinctly in
 * their notification feed (§5.7).
 *
 * Styling only — pinning never changes sort order. A pin that reordered the feed
 * would quietly bury everyone else's activity, which is not what "highlight"
 * means.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pinned_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pinned_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->unique(['user_id', 'pinned_user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pinned_members');
    }
};
