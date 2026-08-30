# Cron Job Setup for Shared Hosting

> Covers the scheduler only. A **queue worker** is also required — see
> [QUEUE_SETUP.md](QUEUE_SETUP.md), which documents both processes, the
> shared-hosting worker variant, and how to verify they actually run.

## cPanel Cron Configuration

1. Log into cPanel
2. Go to "Cron Jobs"
3. Add a new cron job with this command:

```
* * * * * cd /home/USERNAME/public_html && /usr/local/bin/php artisan schedule:run >> storage/logs/scheduler.log 2>&1
```

Replace `USERNAME` with your actual cPanel username.

Run it **every minute**, not `*/5`. Laravel's scheduler is built to be called
every minute and works out internally what is due; on a 5-minute cron anything
that isn't due exactly on a 5-minute boundary never fires. Log the output
rather than sending it to `/dev/null` — otherwise a failing scheduled task
leaves no trace.

## What the Cron Does

The `trials:process` command runs daily and:
- Sends 3-day warning email to users whose trial expires in 3 days
- Marks expired trials as `status=expired`
- Sends expiry notification emails

## Finding Your PHP Path

Run in cPanel Terminal:
```bash
which php
```

Common paths:
- `/usr/local/bin/php` (most shared hosts)
- `/usr/bin/php`
- `/opt/cpanel/ea-php83/root/usr/bin/php`
