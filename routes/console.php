<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use App\Console\Commands\GenerateVibeCalls;
use App\Console\Commands\ProcessStreaks;
use App\Console\Commands\ProcessTrials;
use App\Console\Commands\SendMotivationalNotifications;
use Illuminate\Support\Facades\Schedule;

Schedule::command(ProcessTrials::class)->daily();

// Every minute: each notification schedule decides for itself whether it is due,
// which is the only way to honour admin-configured send times and per-schedule
// timezones. `last_run_at` makes repeated invocations a no-op.
Schedule::command(SendMotivationalNotifications::class)
    ->everyMinute()
    ->withoutOverlapping();

// Hourly rather than daily so a badge earned this morning appears the same day.
// Recomputation is idempotent, so the extra runs cost nothing but a query.
Schedule::command(ProcessStreaks::class)
    ->hourly()
    ->withoutOverlapping();

// Hourly. Generation is keyed on (schedule_id, scheduled_at), so repeated runs
// create nothing extra — the lookahead window simply rolls forward.
Schedule::command(GenerateVibeCalls::class)
    ->hourly()
    ->withoutOverlapping();
