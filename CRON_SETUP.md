# Cron Job Setup for Shared Hosting

## cPanel Cron Configuration

1. Log into cPanel
2. Go to "Cron Jobs"
3. Add a new cron job with this command:

```
*/5 * * * * /usr/local/bin/php /home/USERNAME/public_html/artisan schedule:run >> /dev/null 2>&1
```

Replace `USERNAME` with your actual cPanel username.

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
