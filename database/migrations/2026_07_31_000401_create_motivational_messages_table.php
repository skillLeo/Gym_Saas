<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pool of motivational messages the scheduler draws from (§4.4).
 *
 * `last_sent_at` and `send_count` exist so selection can be least-recently-sent
 * rather than random. Random repeats — with ten messages, a random pick shows
 * the same one twice in a row roughly one time in ten, which members read as
 * the app being broken.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('motivational_messages', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->string('body', 500);
            $table->boolean('is_active')->default(true);

            $table->timestamp('last_sent_at')->nullable();
            $table->unsignedInteger('send_count')->default(0);

            // Nulled rather than cascaded: an admin leaving must not delete the
            // message pool they wrote.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // Drives the selection query: active messages, oldest send first.
            $table->index(['is_active', 'last_sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('motivational_messages');
    }
};
