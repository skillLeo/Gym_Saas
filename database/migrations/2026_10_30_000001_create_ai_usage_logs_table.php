<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per AI call, for cost control and for answering "why is the bill
 * what it is".
 *
 * DELIBERATELY NOT STORED: prompt text, transcribed speech, the photo, the
 * food names, or anything else the member submitted. This table exists to
 * count money and failures, and a usage log is the easiest place in a codebase
 * for someone's dinner photo to quietly accumulate for years. Everything here
 * is a number, a status or a model name.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_usage_logs', function (Blueprint $table) {
            $table->id();

            /*
             * Nullable, and nulled rather than deleted when the member goes:
             * spend that already happened still happened, and a deleted
             * account must not quietly rewrite last month's total and release
             * headroom under the cap.
             */
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            /* food_analyze_image | food_analyze_audio | food_analyze_text | ... */
            $table->string('feature', 64);
            $table->string('model', 64);

            /*
             * Null for duration-billed models (transcription), where there are
             * no token counts to record. Null means "not applicable", not zero
             * — a zero would read as a free call.
             */
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();

            /*
             * An ESTIMATE from the pricing table in config/ai.php, never a
             * figure from OpenAI. 6 decimal places because a single analyse
             * call costs a small fraction of a cent and rounding to 2 would
             * record almost every call as $0.00 — the cap would then never be
             * reached no matter how many calls were made.
             */
            $table->decimal('estimated_cost_usd', 12, 6)->default(0);

            /* ok | error | invalid_response | unavailable | blocked */
            $table->string('status', 32);
            $table->unsignedInteger('latency_ms')->nullable();

            $table->timestamp('created_at')->nullable();

            /* Month-to-date spend, and the per-member daily count, are read on
             * every single AI request, so both need to be cheap. */
            $table->index(['created_at', 'status']);
            $table->index(['user_id', 'created_at']);
            $table->index(['feature', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_logs');
    }
};
