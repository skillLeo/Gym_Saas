<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Makes the "watching" number on the live screens real.
 *
 * `live_sessions.viewers_count` was displayed to members and to the admin as a
 * live audience figure, and nothing ever incremented it — it read 0 while people
 * were watching. The admin screen went further and derived a comment count from
 * it (`viewers * 0.4`), which is a number invented from another number.
 *
 * One row per member per session, so the count is distinct people who opened the
 * session rather than a total that climbs with every poll. Same shape as
 * `video_saves` and `saved_posts`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_session_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            // The uniqueness is the whole point: it is what stops a polling page
            // from inflating the figure.
            $table->unique(['live_session_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_session_views');
    }
};
