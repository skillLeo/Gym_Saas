# Queue & Scheduler Setup

Two background processes must run in production. Neither is optional, and
**neither is running on this machine today** — see [Current state](#current-state).

| Process | Command | Without it |
|---|---|---|
| Queue worker | `php artisan queue:work` | Queued jobs pile up in the `jobs` table and never execute |
| Scheduler | `php artisan schedule:run` (every minute, via cron) | `trials:process` never fires — trials never expire |

The app uses `QUEUE_CONNECTION=database` and `CACHE_STORE=database`, so both
depend on MySQL being reachable. No Redis required.

---

## Verify it works: `php artisan queue:health`

Run this on the server after every deploy. It dispatches a probe job and waits
for a worker to execute it.

```bash
php artisan queue:health            # waits 15s
php artisan queue:health --wait=30
```

- **Exit 0** — a worker picked the job up. Queue is healthy.
- **Exit 1** — nothing consumed it within the window. Queued work is not
  happening. Treat this as an outage.

It matches a per-run token, so a stale success from an earlier run cannot make
a dead queue look alive. Safe to run in a monitoring check.

> Dispatching a job is not the same as running it. `Job::dispatch()` succeeds
> whether or not a worker exists — it only writes a row. Without this probe,
> a dead queue looks identical to a working one from the application side.

---

## Production setup

### VPS / dedicated (supervisor)

`/etc/supervisor/conf.d/gym-saas-worker.conf`:

```ini
[program:gym-saas-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/Gym_Saas/artisan queue:work --tries=3 --timeout=60 --max-time=3600
directory=/var/www/Gym_Saas
autostart=true
autorestart=true
stopwaitsecs=70
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/gym-saas-worker.log
```

```bash
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl start gym-saas-worker:*
```

Then the scheduler, in `crontab -e`:

```cron
* * * * * cd /var/www/Gym_Saas && php artisan schedule:run >> storage/logs/scheduler.log 2>&1
```

**Every minute — not `*/5`.** Laravel's scheduler is designed to be invoked
every minute; it decides internally what is actually due. On a 5-minute cron,
any task that isn't due exactly on a 5-minute boundary is skipped silently and
permanently.

**Log the output, don't discard it.** `>> /dev/null 2>&1` throws away the only
evidence you get when a scheduled task starts failing.

### Shared hosting / cPanel (no persistent processes)

Many shared hosts kill long-running processes, so `queue:work` won't stay up.
Run a short worker from cron instead — it drains the queue and exits:

```cron
* * * * * cd /home/USERNAME/public_html && php artisan schedule:run >> storage/logs/scheduler.log 2>&1
* * * * * cd /home/USERNAME/public_html && php artisan queue:work --stop-when-empty --tries=3 --max-time=55 >> storage/logs/worker.log 2>&1
```

`--max-time=55` keeps each run inside its minute so overlapping workers don't
stack up. Trade-off: queued jobs wait up to a minute before starting. That is
fine for email and badge awards; it is not fine for anything a user watches.

Find the PHP binary with `which php` (often `/usr/local/bin/php`). Use the
full path if a bare `php` in cron resolves to the wrong version.

---

## Deploying: restart the worker

`queue:work` loads the application once and keeps it in memory. **After every
deploy, workers are still running the old code** until restarted.

```bash
php artisan queue:restart     # signals workers to exit; the process manager restarts them
```

Put it in your deploy script, after `migrate`. Skipping it produces the worst
kind of bug: new code on the web side, old code in the worker, and jobs failing
in ways that don't reproduce anywhere else.

---

## What depends on this

Currently scheduled (`routes/console.php`):

- `trials:process` — daily at 00:00. Sends 3-day expiry reminders, moves ended
  trials to `expired`. **This has never run in this environment**, because no
  scheduler is installed. Trials do not currently expire on their own.

Phase 8 adds more (subscription renewals, coupon and receipt email, badge
awards). All of it is inert until these two processes exist.

---

## Current state

As of 2026-07-31, on the local Windows dev machine:

- Queue worker: **not running for this app.** A `queue:work` process exists but
  belongs to a different project (`Rapzi-platform`) and consumes that app's
  queue, not this one.
- Scheduler: **not installed.** No Windows scheduled task invokes
  `schedule:run`, so `trials:process` has never executed.
- `jobs`, `job_batches`, `failed_jobs` tables exist and are empty.

Verified end to end on 2026-07-31: with no worker, `queue:health` exits 1 and
the probe sits unprocessed in `jobs`. With `queue:work` running, the same probe
executes in ~230ms and `queue:health` exits 0.

### Running locally (Windows)

```powershell
php artisan queue:work --tries=3 --timeout=60
```

Leave it in its own terminal. Restart it after changing any job class — the
same stale-code rule as production. For a one-shot drain, use
`--stop-when-empty`.

---

## Troubleshooting

**`queue:health` exits 1 but a worker looks like it's running**
Confirm the worker belongs to *this* app. On Windows, check the working
directory of the `php.exe` running `queue:work`; a worker started in another
project polls that project's database.

**Jobs run but the code is wrong / old**
The worker is running pre-deploy code. `php artisan queue:restart`.

**Jobs land in `failed_jobs`**
`php artisan queue:failed` to list, `queue:retry <id>` (or `--all`) to requeue.
The exception and stack trace are stored on the row.

**Scheduled task never fires**
`php artisan schedule:list` shows what is registered and when it is next due.
If cron is installed but nothing runs, the cron user usually lacks permission
on `storage/` — check `storage/logs/scheduler.log`.
