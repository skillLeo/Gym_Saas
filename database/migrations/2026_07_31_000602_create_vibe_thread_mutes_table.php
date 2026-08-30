<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-member mute for the Vibe Thread (§5.1).
 *
 * The brief is explicit that the thread cannot be hidden entirely — this stops
 * the notifications, not the channel. A muted member can still open and read
 * it, which is why there is no "hidden" flag here to be tempted by.
 *
 * `muted_until` NULL means muted indefinitely; a timestamp means it lapses on
 * its own, so "mute for a day" needs no cleanup job.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vibe_thread_mutes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamp('muted_until')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vibe_thread_mutes');
    }
};
