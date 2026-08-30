<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When motivational messages fire (§4.4).
 *
 * `days_of_week` holds ISO day numbers (1 = Monday … 7 = Sunday), matching
 * Carbon's `dayOfWeekIso`. Storing the ISO form avoids the off-by-one that
 * comes from mixing PHP's `w` (0 = Sunday) with Carbon's default.
 *
 * `timezone` is per schedule so "9am" means 9am where the members are, not
 * 9am UTC. `last_run_at` is compared in that same timezone so a schedule fires
 * once per local day regardless of how often the scheduler ticks.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->json('days_of_week');
            $table->time('send_time');
            $table->string('timezone')->default('UTC');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'last_run_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_schedules');
    }
};
