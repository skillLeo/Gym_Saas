# Deployment Guide — My EXtreme Trainer (Shared Hosting / cPanel)

## Laravel Backend

### 1. Set Document Root
In cPanel → Domains → Set document root to: `public_html/public/`
(Upload all Laravel files to `public_html/`)

### 2. Upload Files
Upload everything EXCEPT:
- `node_modules/`
- `vendor/` (will install on server)
- `.git/`

### 3. Install Dependencies on Server
Via SSH terminal or cPanel Terminal:
```bash
cd /home/yourusername/public_html
composer install --no-dev --optimize-autoloader
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 4. Set Permissions
```bash
chmod -R 775 storage bootstrap/cache
chown -R yourusername:nobody storage bootstrap/cache
```

### 5. Configure .env on Server
Copy `.env` and update:
```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://myextremetrainer.com
DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=your_db_name
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
```

### 6. Run Migrations on Server
```bash
php artisan migrate --force
php artisan db:seed --force
```

## cPanel Cron Job Setup

Go to cPanel → Cron Jobs → Add New Cron Job:
```
*/5 * * * * /usr/local/bin/php /home/yourusername/public_html/artisan schedule:run >> /dev/null 2>&1
```
This runs every 5 minutes and handles trial processing emails.

## Next.js Frontend

### Build Locally
```bash
cd frontend
NEXT_PUBLIC_API_URL=https://myextremetrainer.com npm run build
```

### Deploy Options:
1. **Subdomain (Recommended):** Deploy to `app.myextremetrainer.com` using Vercel, Netlify, or cPanel subdomain with Node.js support
2. **Same Domain Subfolder:** Upload `frontend/out/` to `public_html/app/`

### Update CORS in .env
```
SANCTUM_STATEFUL_DOMAINS=app.myextremetrainer.com
FRONTEND_URL=https://app.myextremetrainer.com
```

## Required API Keys (fill in .env)

| Variable | Where to get |
|----------|-------------|
| NUTRITIONIX_APP_ID | developer.nutritionix.com (free account) |
| NUTRITIONIX_APP_KEY | developer.nutritionix.com |
| MAIL_HOST | Mailgun or SendGrid SMTP |
| MAIL_USERNAME | Email service SMTP user |
| MAIL_PASSWORD | Email service SMTP password |

## Quick Start (Local Development)

```bash
# Terminal 1 — Laravel API
cd /path/to/ExtremeTrainer
php artisan serve --port=8000

# Terminal 2 — Next.js Frontend
cd /path/to/ExtremeTrainer/frontend
npm run dev
```

Visit: http://localhost:3000
API: http://localhost:8000

**Demo login:** test@myextremetrainer.com / password123
