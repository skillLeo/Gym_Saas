<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Backing store for the feed's "Save" button.
 *
 * The button existed on every post but had no handler at all — clicking it did
 * nothing and said nothing. Follows the same shape as `saved_recipes` and
 * `video_saves` so bookmarking behaves consistently across the app.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->timestamps();

            // One save per person per post. Enforced here rather than by a
            // check-then-insert, which races when a button is double-clicked.
            $table->unique(['user_id', 'post_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_posts');
    }
};
