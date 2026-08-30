# BUILD PROGRESS

Tracking document for the work defined in `PHASE_8-10_BUILD_BRIEF.md`.
Updated at the end of every stage and before stopping for any reason.

**Last updated:** 2026-08-01, **Stage 5 complete for this pass — stopped by client decision, not blocked.**

---

## STATUS

| Stage | Scope | Status |
|---|---|---|
| 1 | Design system foundation | ✅ Complete — approved |
| 2 | Mobile app shell + PWA | ✅ Complete — approved |
| 3 | Retrofit all 64 existing pages | 🟡 **In progress — tokens app-wide; Auth/Dashboard/Landing rebuilt; `PageHeader` on 31 of 51 in-shell pages. Resume: the 20 pages listed under "Stage 3 — what is left".** |
| 4 | Phase 8 — Membership, payments, engagement | ✅ **Complete — §4.0–§4.5 all built and gate-passed (198 functional + 24 API + 34 browser assertions, 0 failures).** |
| 5 | Phase 9 — Community, resources, i18n | ✅ **Complete for this pass — client chose to stop §5.4 here (2026-08-01).** §5.1–§5.3, §5.5–§5.7 fully done. §5.4: infrastructure + nav shell + all 7 member-facing pages above 15 strings extracted and live-verified in EN/ES/FR; found and fixed a cross-cutting SSR hydration bug affecting every i18n page. Remaining ~413 strings (admin panel + landing/design-system) explicitly deferred, not abandoned — see "§5.4 STRING EXTRACTION — STATUS" below for the resume list if revisited. |
| 6 | Phase 10 — Admin, coaching portal, launch | ⬜ Not started |
| 7 | Performance + database quality | ⬜ Not started |
| 8 | Final QA pass | ⬜ Not started |

---

## 🔒 SECURITY DEBT

### `system_settings` stored secrets in PLAINTEXT — FIXED 2026-08-01

**Status: fixed and verified.**

**Before:** `SystemSetting::set()` wrote the raw value straight to the `value` column. The
`is_secret` flag encrypted nothing — it only made `getGroup()` return `••••••••` on read. The
SMTP password and Nutritionix API key sat in the database in the clear.

**Fix applied:**
1. `app/Models/SystemSetting.php` — added `'value' => 'encrypted'` to `$casts`.
2. **Found and fixed a bypass this surfaced**: `SystemSetting::get()` read via
   `->where(...)->value('value')` — Eloquent's query-builder scalar helper, which returns the
   raw column value and **does not run casts at all**. Under encryption this would have returned
   ciphertext to every caller, including `FoodSearchController` (the real Nutritionix key lookup
   used by food search) and `AdminController::testNutritionix`. Changed to
   `->first()?->value`, which hydrates a model and runs the cast. A second, unrelated instance of
   the same bypass was in `app/Services/UserAccountState.php::trialLengthDays()` (queried
   `system_settings` directly rather than going through the model) — fixed the same way. Grepped
   every remaining `SystemSetting::`/`system_settings` reference in `app/`, `database/`,
   `routes/` to confirm no other bypass exists.
3. `database/migrations/2026_08_01_000001_encrypt_system_settings_values.php` — re-encrypts
   existing rows in place via `Crypt::encryptString()` on the raw DB value (migrations run
   outside the model, so this reads/writes `DB::table()` directly, not through the cast).
   Idempotent — a row that already decrypts successfully is left alone, so re-running after a
   partial failure can't double-encrypt. `down()` decrypts back to plaintext.

**Verified personally:**
- `php artisan migrate:rollback --step=1` then re-migrate: raw `mail_password` column value
  round-tripped plaintext → ciphertext → plaintext → ciphertext correctly each time (checked via
  `DB::table('system_settings')->value('value')` directly, bypassing the model, so this is the
  literal on-disk column content).
- `SystemSetting::get('mail_password')`, `::getRaw('smtp')`, `::getGroup('smtp')`, and
  `UserAccountState::trialLengthDays()` all decrypt correctly post-encryption (checked all four
  in the same tinker session against the live encrypted data).
- **Real HTTP request**, not just a tinker check: `GET /api/admin/settings` with a live admin
  token returns the SMTP group with `mail_password` masked as `••••••••` (masking still works).
  `POST /api/admin/settings/test-smtp` against the same encrypted row returned
  `{"success":true,"message":"Test email sent to kelvin@myextremetrainer.com."}` — a real email
  actually went out through the decrypted credentials. This is the strongest evidence available
  short of the client checking their inbox.

**Outstanding action for the client, not something I can do:** rotate the SMTP password and the
Nutritionix API key. The values that were in this database were stored in plaintext until today
and may exist in database backups taken before this fix — encrypting the column now does not
retroactively protect a backup that already has the plaintext. This is a credential-rotation
action, not a code change, so it's on you, not blocked on me.

(Earlier note in this doc called these "encrypted at rest" before they actually were — that was
wrong, inferred from the `is_secret` parameter name rather than verified against the model. This
entry replaces that error with what was actually built and tested.)

### Stripe production webhook secret — client action required, cannot be done by me

**This cannot be completed without access to the production Stripe dashboard and the live
domain**, so it is documented here rather than attempted.

**Current state:** `.env` holds `STRIPE_KEY`/`STRIPE_SECRET` in **test mode** (`pk_test_…`/
`sk_test_…`) and a `STRIPE_WEBHOOK_SECRET` (`whsec_…`) that matches what the Stripe CLI's
`stripe listen --forward-to localhost:8000/api/stripe/webhook` prints when forwarding test events
to this machine for local development — it is **not** a real, dashboard-registered production
endpoint secret, and will not verify signatures from Stripe's real servers.
`StripeWebhookController::handle()` (`app/Http/Controllers/Api/StripeWebhookController.php:46`)
already fails closed with a `500` and a `Log::critical` if this value is blank, so a missing
secret in production is loud, not silent.

**Exactly what the admin must do, in order, once the production domain is live:**

1. Log into the **live-mode** Stripe Dashboard (toggle out of test mode, top-right).
2. Go to **Developers → Webhooks → Add endpoint**.
3. Endpoint URL: `https://<your-production-domain>/api/stripe/webhook` (must be the real HTTPS
   production domain — Stripe will not deliver to `localhost`).
4. Select these events (matching `StripeWebhookController::HANDLED`, line 33): `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. After creating the endpoint, Stripe reveals a **signing secret** starting `whsec_…` — copy it.
6. On the production server, update `.env`:
   - `STRIPE_KEY` → the **live** publishable key (`pk_live_…`)
   - `STRIPE_SECRET` → the **live** secret key (`sk_live_…`)
   - `STRIPE_WEBHOOK_SECRET` → the `whsec_…` from step 5 (the live endpoint's secret, not the CLI's)
7. Restart PHP-FPM / the queue worker so the new `.env` values are picked up (Laravel caches
   config in production via `php artisan config:cache` — if that has been run, also run
   `php artisan config:clear && php artisan config:cache` after updating `.env`, or the old test
   keys stay active despite the file change).
8. Send a **test webhook** from the Stripe Dashboard's endpoint page and confirm it shows a `200`
   response and a new row in the `stripe_webhook_events` table with `status = processed`.

No code changes are required for this swap — every value is read from `config('services.stripe.*')`,
which reads from `.env`. This is purely a credentials-and-dashboard action, which is why it is
listed here rather than in the code.

---

## STAGE 6 — PHASE 10 — IN PROGRESS (2026-08-01)

### Two known overflow bugs — FIXED

**`/recipes/create` ingredient row** (`frontend/src/app/recipes/create/page.tsx`) — the name/amount/
unit inputs plus delete button (`flex gap-2`, fixed `w-20`/`w-16`) exceeded 375px regardless of
language; root cause was missing `min-w-0` on the flex-1 name input, which let it keep its
browser-intrinsic minimum width instead of actually shrinking. **Fix:** row now stacks
(`flex-col sm:flex-row`) — name input full-width on its own line on mobile, amount/unit/delete
on a second row below it, reverting to the original single-row layout at `sm:` and up. Verified:
Playwright screenshot at 375px shows the stacked layout with `scrollWidth === clientWidth` (was
414 vs 375 before).

**`/social/[username]` action button row** (`UserProfilePageClient.tsx`) — Follow/Message/Pin/Share
sat beside the avatar in one `flex items-end justify-between` row; four buttons plus an XL avatar
never fit at 375px in any language, English included. **Fix:** container is now
`flex-col gap-3 sm:flex-row sm:items-end sm:justify-between` (avatar stacks above the button row on
mobile, side-by-side at `sm:`+) and the button row itself got `flex-wrap` as a second line of
defense. Verified: screenshot shows avatar, then Follow/Message/Pin, then Share wrapping to its own
line, `scrollWidth === clientWidth` at 375px.

### §E5 — HIPAA coaching portal backend — COMPLETE, attack-tested

**Schema** (`database/migrations/2026_08_01_010005_create_coaching_portal_tables.php`):
`physicians` (own table, not a `users` role), `coaching_authorizations`, `physician_messages`,
`coaching_access_log` (append-only audit trail). Migrated, rolled back, re-migrated clean.

**Guard separation, not a custom implementation — used what Sanctum already provides.**
`Laravel\Sanctum\Guard::hasValidProvider()` rejects a token whose `tokenable` doesn't match the
guard's configured provider, but the shipped `sanctum` guard registers with `provider: null`
(accepts any tokenable). Fixed in `config/auth.php`: the `sanctum` guard now pins
`provider: 'users'`, and a new `physician` guard uses the same `sanctum` driver with
`provider: 'physicians'`. Zero custom guard code, and confirmed zero behavior change for existing
member tokens (`GET /api/auth/user` with a real member token still returns 200 after the change).

**Access control** (`app/Services/PhysicianCanAccessMember.php`): every coaching-data controller
method calls `authorize($physician, $authorization, $request)`, which re-fetches the authorization
from the database (never trusts the route-bound instance), checks `physician_id` matches AND
`status === approved` AND `revoked_at === null`, and writes a `coaching_access_log` row — all
before returning data. `EnsurePhysicianActive` middleware additionally blocks a physician whose
account has been deactivated since their token was issued (Sanctum tokens don't expire on their
own when an account is disabled).

**Bug found and fixed while attack-testing, unrelated to the portal itself but discovered because
of it**: a plain `abort(403, '...')` on any API route leaked a full stack trace with absolute file
paths whenever `APP_DEBUG=true` (the local default) — the existing catch-all exception handler in
`bootstrap/app.php` only activated `environment('production') && !config('app.debug')`, which is
the opposite of the brief's own rule ("no raw errors reach users... in every environment, not just
production"). **Before:** `{"message":"Not authorized...","exception":"...HttpException","file":"C:\\xampp\\htdocs\\...","trace":[...]}`. **After:** removed the environment gate — the
handler now runs for every `api/*` request regardless of debug mode, surfacing the exception's own
message for 4xx (all hand-authored safe strings throughout this codebase) and a generic
`"Server error."` for 5xx (where the message could contain internals). Confirmed fixed by
re-running the same request. This affects every `abort()` call in the app, not just coaching —
one of the more valuable side-finds of this pass.

**Attack tests — real curl output, run against live fixture data (created via tinker, cleaned up
afterward — zero test rows left in `coaching_authorizations`/`physicians`):**

| # | Test | Result |
|---|---|---|
| 1 | Physician A requests Physician B's patient by authorization id | `403 {"message":"Not authorized for this patient."}` |
| 1b | *(sanity)* Physician A requests their own patient | `200`, real (empty) paginated workout list |
| 2 | Physician requests an authorization with `status=pending` (physician_id pre-set — a state the real flow can't produce, tested anyway per defense-in-depth) | `403 {"message":"This authorization is not currently active."}` |
| 3 | Physician requests an authorization after revocation | `403 {"message":"This authorization is not currently active."}` |
| 4 | Physician token on `/api/dashboard` | `401 {"message":"Unauthenticated."}` |
| 4b | Physician token on `/api/social/feed` | `401 {"message":"Unauthenticated."}` |
| 5 | Member token on `/api/coaching/patients` | `401 {"message":"Unauthenticated."}` |
| 6a | Expired invite token, preview (`GET /coaching/invite/{token}`) | `404 {"message":"This invite link is invalid or has expired."}` |
| 6b | Expired invite token, accept attempt | `404`, same message |
| 6c | *(sanity)* Valid unused token, preview | `200`, real practice/physician name |
| 6d | *(sanity)* Valid token, first accept | `201`, account created, portal token issued |
| 6e | **Same token, second accept attempt (reuse)** | `404 {"message":"This invite link is invalid or has expired."}` — hash nulled on redemption in the same DB transaction as account creation |
| 7 | Free-trial member (`account_state=trial`) attempts `POST /api/coaching-authorizations` | `403 {"message":"Only an active paid subscription can request physician coaching access."}` |
| 7b | *(sanity)* Real paying subscriber (`account_state=subscriber` + an `active` row in `subscriptions`) attempts the same | `201`, request created as `pending` |
| esc-1 | Physician token on an **admin** endpoint (`POST /admin/coaching-authorizations/{id}/approve`) | `401 {"message":"Unauthenticated."}` |
| esc-2 | Non-admin member token on the same admin approve endpoint (attempting to self-approve their own request) | `403 {"success":false,"error":"Administrator access required."}` |
| esc-3 | Member attempts `is_admin: true` via `PUT /api/auth/user` (existing mass-assignment guard, not new — verified as a sanity check) | `200`, but `is_admin` confirmed still `false` in the database afterward |

**14 real HTTP requests, 14 correct results.** Every 403/401 is the exact response body pasted
above, not a paraphrase.

**Judgment call, reversible:** the request form collects `representative_email`, not a physician
email (the brief's field list has no physician-email field). The approval invite is therefore
emailed to `representative_email`, and the invite-acceptance screen asks for the physician's actual
login email at account-creation time (which may differ from the representative's). If the client
wants the physician to receive the invite directly instead, add a `physician_email` field to the
request form and switch `Mail::to()` in `CoachingAdminController::approve()` — a one-line change.

**Not yet built:** the member-facing request/revoke UI, the admin approval screen, and the
physician-facing portal frontend (separate layout, no member app shell, `--info` accent only per
§6.5.1). Backend is complete and independently attack-verified ahead of any UI existing for it.

### §E1, §E2, §E3, §E4, §E6 backend — COMPLETE, tested with real HTTP requests against real data

**Every route below is wrapped in `Route::middleware('admin')`.** This mattered in practice, not
just in principle: `RecipeAdminController` and `RevenueController` were both initially registered
*without* that middleware and without an internal `assertAdmin()` call (the older `AdminController`
convention) — caught immediately by testing with a non-admin token, which got a real `200` instead
of a `403` on the first attempt at each. Both fixed before moving on; every controller added after
that point was verified the same way (non-admin → 403, admin → real data) before being considered
done.

**Revenue dashboard is real** (`app/Http/Controllers/Api/Admin/RevenueController.php`) — active
subscriber count (`Subscription::whereIn(status, ENTITLED_STATUSES)->distinct('user_id')`), MRR
(entitled subscriptions joined to their plan, annual plans divided by 12), trial conversion rate
(subscribers who ever had a trial ÷ everyone who ever had a trial), churn rate (subscriptions
canceled in the last 30 days ÷ subscriptions that existed 30 days ago), revenue by month from
`payments` where `status=succeeded`. **Before:** `AdminController::stats()` had
`$totalRevenue = round($totalUsers * 29.99, 2)` — literally user count times a hardcoded price with
no relationship to what anyone actually paid. That line is gone, not patched. Verified: `GET
/admin/revenue` against the live dev database returns `active_subscribers: 0` — a real, honest
number reflecting that no user in this dev DB has an actual `subscriptions` row with an entitled
status, even though one user's `account_state` column says "subscriber" (a seed-data inconsistency
this endpoint correctly does *not* paper over).

**Two more real bugs found and fixed while wiring this up:**
- `AdminController::users()`'s new `?status=` filter used `$request->string('status')` (returns a
  `Stringable` object) inside a **strict** `in_array(..., true)` check — a `Stringable` is never
  `===` a plain string, so the filter silently matched nothing and returned every user regardless
  of the requested status. Caught by testing `?status=subscriber` and seeing a trial user in the
  results. Fixed with `(string) $request->query('status')`.
- `AdminController::deleteUser()` called `$user->delete()` directly — bypassing
  `UserAccountState::softDelete()` entirely, meaning admin-initiated deletion **left no audit row**,
  a direct violation of §4.2's "log every deletion, never silently destroy data." Now routes through
  the same audited `softDelete()` the automatic 90-day retention job uses.
- `SocialPostController::store()` (pre-existing, unrelated to this session's other work, found
  while testing content-flag wiring): `$validated['image_url']` was read without a null-coalesce;
  when a client omits `image_url` from the request body entirely (rather than sending it as `null`)
  the key never enters Laravel's `$validated` array at all, and accessing it threw "Undefined array
  key" — surfaced as a real `500` once the exception-handler fix above stopped hiding it. Fixed with
  `$validated['image_url'] ?? null`. The production frontend's compose form always sends an explicit
  `image_url: null`, which is why this hadn't been caught before — it only manifests for a client
  that omits the field outright.

**User management**: `GET /admin/users` now filters by real `account_state` (trial, subscriber,
`expired`→`grace`, deactivated), plus the existing 7-day "new" heuristic kept as a separate,
honestly-named option. Added `GET /admin/users/{user}` for the single-user detail screen (profile,
account state, active subscription, and real per-user counts of food logs/workouts/posts — no
placeholder numbers). `PUT /admin/users/{user}` can now change `account_state` directly (documented
caveat: this is a manual override of a value that `UserAccountState::apply()` re-derives from real
facts on its next scheduled run — deactivating manually starts the same real retention clock the
automatic path uses, so it isn't a silent exception to that policy, but moving someone to
`subscriber` without a real `subscriptions` row will be reverted the next time the derive job runs,
since there's no fact backing it. This mirrors exactly what the revenue dashboard's `active_subscribers: 0`
finding above already showed exists in this dev database).

**Recipe management** (`RecipeAdminController`) — added `is_featured` (migration
`2026_08_01_010002`) since no persistence existed for it at all; the admin recipes screen's
Approve/Feature/Remove buttons previously mutated only local React state. The fabricated "pending
review" status (no approval workflow exists in the recipe schema, unlike Groups which have a real
one) is not reproduced — badges will show real `is_featured`/`is_public` once the frontend is wired.

**Email campaigns** (`EmailCampaignController`, `email_campaigns`/`email_campaign_recipients`
tables) — sent **synchronously**, not queued, per §4.0 (no worker runs; a queued send here would be
a send that silently never happens). Resumable by construction: recipient rows for the whole
resolved audience are created at `store()` time, and `send()` only ever processes rows where
`sent_at IS NULL`, so a request that times out partway through picks up exactly where it stopped
on the next call instead of re-sending. **Verified live**: created a real campaign targeting the
`trial` audience (3 real users), sent it — `sent_this_run: 3, failed_this_run: 0` — then called
`send()` again and got `"This campaign has already fully sent."`, confirming resumability doesn't
re-send. Flagged as a scale limit, not hidden: for a large audience this ties up the request thread
for as long as sending takes, since there's no worker to hand it off to.

**New user monitoring** (`NewUserController`, §E2) — separate from general moderation, shows
signup date, `onboarding_completed`, current `account_state`, and — since there's no
`last_active_at` column anywhere — a real **last-activity timestamp derived from the most recent
row across `food_log_entries`/`fitness_logs`/`social_posts`** (`app/Services/UserActivity.php`).
This same service backs the email campaign `inactive_days` audience, so the two features can never
define "inactive" differently. Verified: `GET /admin/new-users?days=30` returns real per-user
`last_active_at`/`first_food_log_at`/`first_workout_at` timestamps against live data.

**Undercover admin accounts** (`UndercoverController`, §E3) — creates an entirely ordinary `User`
row (`is_admin` deliberately left `false`) plus a separate `admin_shadow_accounts` row carrying the
"this is admin-controlled" fact. Nothing member-facing joins or queries that table — audited every
existing member-facing serializer (`AuthController::userResponse()`, social profile responses) to
confirm none of them could leak it, and none do, because none of them know the table exists.

**Content flagging queue** (`ContentFlagController`, §E4) — `ContentScanner` interface with a
`KeywordScanner` implementation (bound in `AppServiceProvider`, one line to swap for Phase 11 AI
detection later), wired into `SocialPostController::store()` and `SocialCommentController::store()`.
Uses the `post`/`comment` morph map added to `AppServiceProvider` (non-enforcing `Relation::morphMap()`,
not `enforceMorphMap()` — the strict form broke on the first test because `Notification`'s
existing `notifiable` morph isn't registered in it and enforcement applies app-wide, not just to
new code). **Verified fully live**: created a real keyword ("testflagword", high severity) as
admin, posted a real social post containing it as a member, confirmed a real `content_flags` row
appeared in the admin queue with the actual post content, author name, and matched term — then
dismissed it and confirmed the pending count dropped to 0. Never auto-deletes, auto-locks, or
auto-moderates anything, per the brief — `dismiss`/`escalate` only ever change the flag row.

**Beta launch tooling** (`BetaController`, §E6) — `invite_only_mode` lives in `system_settings`
(now encrypted at rest along with everything else in that table, see the launch-blocker fix above).
Enforced in **both** registration paths: `AuthController::register()` (checked before validation,
so a blocked attempt never even reaches the duplicate-email check that could otherwise leak
whether an email already has an account) and `handleGoogleCallback()`'s new-account branch — easy
to miss since it's a second path, explicitly called out in the brief, and confirmed here by tracing
the actual code rather than assuming the register() fix covered it. **Verified live end-to-end**:
toggled invite-only mode on, a non-allowlisted email got a real `403` with a clear message,
added that email to the allowlist as admin, the *same* registration request then returned a real
`201`. Toggled back off and cleaned up test rows afterward.

**Full route list added this pass** (all under `/api/admin/*` unless noted, all `admin`-gated):
`GET/PUT/DELETE /users`, `GET /users/{id}`, `GET /revenue`, `PUT/DELETE /recipes/{id}`,
`GET/POST /email-campaigns`, `POST /email-campaigns/{id}/send`, `GET /new-users`,
`GET/POST/PUT/DELETE /undercover`, `GET /content-flags`, `GET /content-flags/pending-count`,
`POST /content-flags/{id}/dismiss`, `POST /content-flags/{id}/escalate`,
`GET/POST/PUT/DELETE /content-flags/keywords`, `GET /beta/status`, `POST /beta/toggle`,
`GET/POST/DELETE /beta/allowlist`. Plus member-facing `GET/POST /coaching-authorizations`,
`POST /coaching-authorizations/{id}/revoke`, and the physician-only `/api/coaching/*` tree
documented above.

**Not yet built:** frontend for all of the above (existing `admin/content-flags`,
`admin/undercover`, `admin/recipes` pages are still on mock data / non-persisted local state and
need rewiring; `admin/emails`, new-user monitoring, and beta tooling have no frontend at all yet).

---

## NEEDS YOUR INPUT

### 1. Port 8000 is occupied by a different project — the app is currently broken locally
`php artisan serve` on port 8000 is being served by **`C:\xampp\htdocs\Rapzi-platform`**, not this project.
The frontend's `.env.local` sets `NEXT_PUBLIC_API_URL=http://localhost:8000`, so every API call from
Gym_Saas currently hits the wrong Laravel app and returns 404.

I did **not** kill that process — it belongs to another project and stopping it is your call.
Stage 1 verification was run against a temporary instance on port **8090** instead.

**To restore normal local operation:** stop the Rapzi-platform server on 8000, then run
`php artisan serve` from `c:\xampp\htdocs\Gym_Saas`. (Or change `NEXT_PUBLIC_API_URL` to a
dedicated port and keep both projects running side by side — my recommendation if you work on
both, since this will keep recurring.)

### 2. Display font fallback changed — one-line revert if you disagree
`public/fonts/` is empty (the licensed Posey Textured file has not been delivered). The interim
fallback was **Playfair Display** (a high-contrast serif). I changed it to **Archivo Black**, a heavy
grotesque that reads much closer to a textured display face on a fitness brand.

This is visible on every heading. Reverting is one line in `frontend/src/app/layout.tsx`.
Nothing changes when the real font arrives — dropping `Posey-Textured-Regular.woff2` into
`public/fonts/` activates it with zero code changes either way.

### 3. `frontend/CLAUDE.md` is stale and actively misleading
It states "No backend, no API calls, no database — all data is mocked/static" and "Next.js 14+".
The app is fully DB-backed on Laravel 13 + MySQL and runs Next.js 16. I have not rewritten it
because it is your project instruction file. It should be updated before it misleads future work.

---

## STAGE 1 — COMPLETE

### Files created (14)

**Frontend — design system**
- `frontend/src/components/ui/Icon.tsx` — central Lucide registry, 145 verified names, resolves DB-stored icon-name strings; unknown names fall back rather than crashing
- `frontend/src/components/ui/Skeleton.tsx` — Skeleton, SkeletonText, SkeletonRow, SkeletonCard, SkeletonChart, SkeletonStatTile
- `frontend/src/components/ui/States.tsx` — EmptyState, ErrorState, Alert (semantic states always pair color + icon + label)
- `frontend/src/components/ui/Sheet.tsx` — bottom sheet with drag-to-dismiss, focus trap, scroll lock, safe-area; `Modal` alias becomes a Sheet on mobile
- `frontend/src/components/ui/Field.tsx` — Field, Input, **NumericField**, Textarea
- `frontend/src/components/ui/Controls.tsx` — Select (sheet on mobile / native on desktop), SegmentedControl, Switch, Chip, Tabs
- `frontend/src/components/ui/ListRow.tsx` — ListRow, ListGroup, SwipeableRow
- `frontend/src/components/ui/StatTile.tsx` — label + tabular value + delta with directional icon + sparkline slot
- `frontend/src/components/ui/PageHeader.tsx` — PageHeader (collapse-on-scroll), HeaderAction
- `frontend/src/components/ui/PullToRefresh.tsx` — resistance-curve pull gesture, only arms at scrollTop 0
- `frontend/src/app/design-system/page.tsx` — every primitive in every state, light/dark, with a live section-accent switcher

**Backend**
- `database/migrations/2026_07_31_000001_add_icon_name_to_fitness_goals_table.php` — adds `icon_name`, backfills from emoji

### Files modified (12)

| File | Before | After |
|---|---|---|
| `frontend/src/app/globals.css` | 109 lines, 4 hardcoded greys, gradient utilities, no radius/elevation/motion scale | Full token system: warm-biased neutral ramp, semantic colors, 8 section accents, radius/type/elevation/motion scales, safe-area utilities, reduced-motion block |
| `frontend/src/app/layout.tsx` | DM Sans + Playfair; hardcoded `bg-[#F8F9FA] dark:bg-[#111827]`; toast top-right | Inter + Archivo Black; token classes; `viewportFit: cover`; theme-aware `themeColor`; toast top-center (clears tab bar/FAB) |
| `frontend/src/contexts/ThemeContext.tsx` | Only `.dark`; defaulted to light; ignored OS preference | Stamps explicit `.dark`/`.light`; `system` preference with live `matchMedia` listener; storage failures non-fatal |
| `frontend/src/components/ui/Button.tsx` | Gradient primary, 6 hardcoded hexes, `rounded-lg`, 38px tall | Solid accent fill, all tokens, `rounded-sm`, 44px (md) |
| `frontend/src/components/ui/Card.tsx` | `bg-white border-gray-200` — **no dark mode at all** | Tokens, `rounded-md`, optional `elevated`; added `CardEyebrow` |
| `frontend/src/components/ui/Badge.tsx` | 13 variants, 20+ hardcoded hexes | Token-based; semantic variants auto-render an icon |
| `frontend/src/components/ui/Avatar.tsx` | Gradient fill; `online` prop accepted but ignored | Solid accent; `online` now renders a presence dot; added `xs` |
| `frontend/src/components/ui/Input.tsx` | Standalone impl, hardcoded hexes, no a11y wiring | Re-exports the single `Field` implementation — same public API |
| `frontend/src/components/ui/LoadingSpinner.tsx` | Inline SVG, hardcoded `#F87404`/`#F8F9FA` | Lucide `Loader2`, tokens |
| `frontend/src/components/ui/ProgressBar.tsx` | Gradient fill, no zero-guard (NaN when max=0) | Solid, clamped, `role="progressbar"` + ARIA |
| `frontend/src/components/ui/MacroBar.tsx` | No dark mode, hardcoded greys | Tokens, tabular numerals, ARIA |
| `frontend/src/components/ui/RingChart.tsx` / `ProgressRing.tsx` | Hardcoded `#F87404`/`#F3F4F6` | Tokens, clamped, `role="img"` with readable label |
| `app/Models/FitnessGoal.php` | — | `icon_name` added to `$fillable` |
| `app/Http/Controllers/Api/FitnessGoalController.php` | — | `icon_name` accepted in `store()` and `update()` |

### Verified personally

- **Migration reversibility** — ran `migrate:rollback`, confirmed `icon_name` removed via `Schema::hasColumn`, re-migrated. Round-trips cleanly.
- **Emoji backfill** — seeded 7 real rows and asserted each mapping. All 7 pass, including unmapped `🦄` and empty-string cases falling back to `target`. Zero NULLs.
- **Design tokens reach the browser** — grepped the built CSS chunks: `--surface-base` ×9, `--owner-accent` ×9, `data-section` ×8, `prefers-color-scheme` ×1, `prefers-reduced-motion` ×1, `safe-area-inset-bottom` ×3, `Posey Textured` ×3.
- **Theme init runs before paint** — confirmed `classList.add(d?'dark':'light')` present in served HTML.
- **Page smoke test** — `/`, `/auth/login`, `/design-system` return 200; authenticated routes return 307 → `/auth/login` (correct auth guard, not a break).
- **API regression** (against port 8090) — login OK; `POST /api/fitness-goals` with the new `icon_name` returns 201 and persists it; negative `target_value` still returns 422; `GET /api/dashboard` returns 200.
- Test data created during verification was deleted.

### Bug found and fixed during verification

**Emoji backfill silently mapped every goal to the same icon.** First run produced `trending-down`
for 💪, 🏃, 🧘 and 🦄 alike. Root cause: under the table's default collation MySQL treats many
emoji as **equal**, so `where('emoji', '💪')` matched every emoji row and each loop iteration
overwrote the previous one. Fixed with `whereRaw('emoji COLLATE utf8mb4_bin = ?', …)`.

This would have shipped as "all your goals now show the wrong icon" and is only visible by
asserting real rows — the column-exists check passed the whole time.

### NOT verified

- **Visual rendering at 375px.** I verified pages return 200 and that tokens are present in the CSS, but I have not viewed any page in a browser. Layout, contrast, and dark-mode appearance are unconfirmed by eye.
- **Touch interactions** — sheet drag-to-dismiss, swipe-to-action, and pull-to-refresh are implemented but have not been exercised on a touch device or emulator.
- **The retrofitted look of Phase 1–7 pages.** Those pages still use their own markup and the legacy compatibility layer; they were not part of Stage 1. Expect them to look transitional until Stage 3.
- **`php artisan test`** — no test suite exists in this project. Nothing was run.

### Deliberate deferrals — all three now CLOSED

1. ~~Legacy compatibility layer in `globals.css`~~ — **removed.** Verified zero usages of `.card`, `.input-field`, `.text-gradient`, `.bg-gradient-brand` first; the one `.animate-float` (landing hero) and one `var(--orange)` (profile/settings) were migrated, then the whole block and the `--bg-card`/`--border`/`--orange`/`--blue`/`--red`/`--yellow`/`--green`/`--light-blue` aliases were deleted.
2. ~~`fitness_goals.emoji`~~ — **dropped** in `2026_07_31_000002`. The Goals page was migrated to `icon_name` first (presets, quick-add tiles, goal cards, and the POST payload), then the column was dropped, then the model and both controller validation blocks were cleaned. `down()` restores the column *and* repopulates it from `icon_name`, so a rollback leaves the old UI working rather than blank.
3. Gradient count is now driven by the landing page's dark photo scrims only (legitimate), not brand gradients.

### Design-tell counts — Stage 1 baseline

Primitives are clean; the page-level counts are Stage 3 scope and unchanged so far.

| Tell | Brief baseline | Now | Target |
|---|---|---|---|
| Emoji in `.tsx`/`.ts` | 373 / 32 files | 373 (unchanged — page-level, Stage 3) | 0 outside EmojiPicker + user content |
| Heavy shadows | 91 / 39 files | 91 (unchanged — page-level, Stage 3) | ≤8 |
| Gradients | 120 | 120 in source; **0 in primitives** | ≤1 |
| `rounded-2xl/3xl` | 228 | 228 (unchanged — page-level, Stage 3) | radius scale only |

### Gate output

```
$ npx tsc --noEmit
(no output — zero errors)

$ npm run build
✓ Compiled successfully in 21.7s
├ ○ /design-system            ← new route built
(all 65 routes generated)

$ php -l <touched files>
No syntax errors detected in app/Models/FitnessGoal.php
No syntax errors detected in app/Http/Controllers/Api/FitnessGoalController.php
No syntax errors detected in database/migrations/2026_07_31_000001_add_icon_name_to_fitness_goals_table.php

$ php artisan migrate
2026_07_31_000001_add_icon_name_to_fitness_goals_table .. 264.64ms DONE

$ php artisan migrate:rollback --step=1
2026_07_31_000001_add_icon_name_to_fitness_goals_table .. 20.71ms DONE
  icon_name removed OK
$ php artisan migrate
2026_07_31_000001_add_icon_name_to_fitness_goals_table .. 30.38ms DONE

$ php artisan migrate:status
(zero Pending)

$ php artisan test
NOT RUN — no test suite exists in this project.
```

---

## STAGE 2 — COMPLETE

### Files created (8)

- `frontend/src/components/shell/AppShell.tsx` — the single shell. Mobile: tab bar + FAB + More sheet. Desktop (lg+): sidebar + top bar. Sets `[data-section]` so the accent cascades with no per-page work.
- `frontend/src/components/shell/nav-config.ts` — tab/sidebar/More definitions, `sectionForPath()`, `fabForPath()`, quick actions
- `frontend/src/components/shell/BottomTabBar.tsx` — 5 tabs, 56px targets, safe-area padded, badges
- `frontend/src/components/shell/MoreSheet.tsx` — grouped overflow nav, admin rows filtered, dark-mode switch, logout
- `frontend/src/components/shell/Fab.tsx` — contextual action; quick-action sheet on dashboard; hidden where no primary action exists
- `frontend/src/components/shell/useUnreadCounts.ts` — badge counts; fails silently, pauses while tab hidden
- `frontend/src/components/shell/PwaProvider.tsx` — SW registration + install prompt (Android event, iOS instruction sheet)
- `frontend/src/app/offline/page.tsx` — offline fallback; self-contained, no API or auth dependency
- `frontend/public/sw.js` — service worker

### Files modified (4) / deleted (2)

| File | Change |
|---|---|
| `frontend/src/components/AppSidebarLayout.tsx` | **593 lines → 21.** Now delegates to AppShell. Props unchanged; 6 layout files unaffected. |
| `frontend/src/components/layout/DashboardShell.tsx` | Delegates to AppShell. Props unchanged; **51 pages** unaffected. |
| `frontend/public/manifest.json` | 2 icons → 6 (incl. maskable); added `id`, `scope`, `display_override`, `shortcuts`; `start_url` `/` → `/dashboard`; `background_color` `#000000` → `#FAFAF9` |
| `frontend/src/app/layout.tsx` | Added apple-touch icon, icon set, `formatDetection` |
| `frontend/src/components/layout/MobileBottomNav.tsx` | **Deleted** — unreferenced |
| `frontend/src/components/layout/Navbar.tsx` | **Deleted** — unreferenced |

⚠️ Both deleted files had *uncommitted* modifications in the working tree that are now lost. They were verified unreferenced by any source file, so there is no functional impact, and the committed versions remain in git history.

### Icons generated

From the existing 512px source via GD: `icon-144`, `icon-152`, `icon-384`, `apple-touch-icon` (180), and `icon-maskable-512`. The maskable variant is **not** the plain icon renamed — artwork is inset to 60% on a full-bleed `#F87404` field, because Android crops maskable icons to an arbitrary shape and anything near the edge is cut.

### Navigation change (deliberate, please confirm)

Mobile tabs changed from **Home / Social / Calendar / Messages / Profile** to
**Home / Food / Fitness / Social / More**, per the brief.

Calendar, Messages and Profile moved into the More sheet. Rationale: the daily loop is logging
food and workouts, so those earn permanent tabs. If Kelvin considers Messages a top-five
destination, it is a one-line change in `nav-config.ts`.

### Verified personally

- **Shell renders** — fetched `/dashboard` with a real `auth_token` cookie and confirmed in the served HTML: `aria-label="Main"`, all five tab labels, `data-section`, `pb-safe`. This closes the Stage 1 gap where I could only confirm HTTP 200s.
- **Section accent + FAB per route** — measured from served HTML:

  | Route | `data-section` | FAB |
  |---|---|---|
  | `/dashboard` | app | Quick log |
  | `/fitness` | fitness | Log workout |
  | `/food-journal` | food | Log food |
  | `/social` | social | Create post |
  | `/calendar` | calendar | Add event |
  | `/settings` | app | hidden |

- **Regression sweep — 30 authenticated routes**, every one returns 200 *and* contains the shell. 0 failures.
- **Service worker security** — extracted the real `isSensitive()` from `sw.js` and exercised it: 7/7. `/api/*`, `/auth/*` and any `token` query are refused; static chunks, `/offline` and icons are cacheable.
- **PWA assets served** — manifest parses (6 icons, maskable present, 2 shortcuts, `display: standalone`); `/sw.js` returns 200 as `application/javascript`; all 7 icons return 200; `/offline` returns 200.

### Gap found and closed during verification

The old shell's mobile top bar carried the **theme toggle**, and the new shell only renders it in
the desktop top bar — mobile users would have lost dark-mode switching entirely. Added a
Dark mode switch to the More sheet rather than reintroducing a competing top bar (the brief's
end state is one per-screen `PageHeader`, added in Stage 3).

### NOT verified

- **Still no browser rendering.** Everything above is served-HTML and logic assertion. Layout, spacing, contrast and dark mode remain unconfirmed by eye at any width.
- **Touch gestures** — tab bar taps, FAB, sheet drag-dismiss, swipe rows, pull-to-refresh: implemented, never exercised on a touch device or emulator.
- **Actual PWA install** — manifest and SW are correct and served, but I have not installed the app to a home screen, so "zero browser chrome" is unconfirmed. The SW is also registered **only in production builds**, so it does not run under `npm run dev`.
- **Badge counts against real unread data** — the hook is wired to `/messages` and `/notifications/unread-count`, but the test account had nothing unread, so badges rendered as 0. The non-zero path is untested.
- **`social` badge is hard-coded to 0** — it needs feed-activity data that does not exist until Stage 5.

### Interim state to expect (resolves in Stage 3)

Phase 1–7 pages now render inside the new shell but still use their own markup. On mobile they
have **no top bar** — the old global one is gone and per-page `PageHeader` arrives in Stage 3.
Sampled pages: `/fitness` and `/food-journal` have their own `<h1>`; `/dashboard`, `/social` and
`/settings` do not, so those three will look top-light until Stage 3 retrofits them.

### Gate output

```
$ npx tsc --noEmit
(no output — zero errors)

$ npm run build
✓ Compiled successfully in 20.5s
├ ○ /offline                  ← new route
├ ○ /design-system

$ php -l
N/A — no PHP files touched this stage.

$ php artisan migrate:status
(zero Pending — unchanged from Stage 1)

$ php artisan test
NOT RUN — no test suite exists in this project.
```

---

## STAGE 3 — IN PROGRESS (paused at a clean boundary)

**Resume point: Section 2 (Dashboard).** Sections are worked in the order defined in the brief.
Nothing is half-edited — every file below is finished, type-checks, and builds.

### Section progress

| # | Section | Pages | Status |
|---|---|---|---|
| — | Structural cleanups | — | ✅ Done |
| 1 | Auth | 8 | ✅ Done |
| 2 | Dashboard | 1 | ✅ Done — full rewrite |
| — | **Token codemod** (all sections) | 55 files | ✅ Done — colours/radius/elevation migrated app-wide |
| 3 | Food | 7 | 🟡 Tokens done; structural pass (PageHeader/Skeleton/EmptyState) pending |
| 4 | Fitness | 6 | 🟡 Tokens done; structural + 20 emoji pending |
| 5 | Social | 4 | 🟡 Tokens done; structural + 20 emoji pending |
| 6 | Recipes | 4 | 🟡 Tokens done; structural pending |
| 7 | Calendar | 4 | 🟡 Tokens done; structural pending |
| 8 | Messages | 2 | 🟡 Tokens done; structural pending (preserve the Set-based dedup fix) |
| 9 | Media | 3 | 🟡 Tokens done; structural pending |
| 10 | Profile/Settings | 5 | 🟡 Tokens done; structural pending |
| 11 | Membership | 3 | 🟡 Tokens done; structural pending |
| 12 | Admin | 12 | 🟡 Tokens done; structural + 33 emoji + tables→cards pending |
| 13 | Landing | 1 | ✅ Done — 0 emoji, 0 shadows, all fabricated content removed |
| 14 | AI Trainer | 4 | 🟡 Tokens done; structural pending (presentation only — build no AI) |

### Structural cleanups — done

| Item | Before | After |
|---|---|---|
| `/food-log`, `/food-log/history` | Client-side `useEffect` redirect — rendered an empty page, then bounced (visible flash) | Server-side `redirect()`. Verified authenticated: → `/food-journal` and `/food-journal/history` |
| `/onboarding` | **A second, divergent onboarding form** | Server-side `redirect()` → `/auth/onboarding`. Verified: 307 with correct Location |
| `src/lib/mockData.ts` | 861 lines, 27 emoji, still in the tree | **Deleted.** Verified unreferenced across all `.ts`/`.tsx`/`.js` first |
| `AppShell` onboarding target | `/onboarding` (the broken one) | `/auth/onboarding` |

### 🐛 Bug found: onboarding never persisted

`/onboarding` and `/auth/onboarding` were not a cosmetic duplicate. The `/onboarding` version
**only updated the local Zustand store** — it never called `POST /api/onboarding`. A user who
completed it was marked onboarded in their browser but **not in the database**, so the server
bounced them back to onboarding on the next login or on any other device.

`AppShell`'s auth guard sent users to that broken route, while every auth page sent them to the
working one — so which onboarding you got depended on how you arrived. Both now resolve to
`/auth/onboarding`, which does persist.

### 🔒 Security: admin credentials were shipping in production

`/auth/login` rendered a **"Dev Quick Login" panel containing the admin email, the member email,
and the shared password in plain text** — in every build, including production.

Now gated behind `process.env.NODE_ENV === 'development'`. **Verified stripped:** 0 occurrences of
`kelvin@myextremetrainer.com` or `password123` across `.next/static/chunks/`, and 0 in the served
login HTML. It still works locally for testing.

### Section 1 — Auth (8 files)

| File | Notable changes |
|---|---|
| `auth/layout.tsx` | Removed a **second `<Toaster>`** (root layout already mounts one — every toast on an auth page rendered **twice**). Removed fabricated stats shown to logged-out users ("16 Day Streak", "1,340 Kcal Today", "47% Goal Hit") and a "Join 10,000+ athletes" claim. Replaced 4 layered gradients, a decorative dot grid and 2 blur circles with one flat scrim. Swapped a hotlinked Unsplash photo for the client's local `hero-team.jpg`. 5 emoji → Lucide icons. |
| `auth/login/page.tsx` | Credential leak fixed (above). Rebuilt on `Input`/`Button`/`Switch`/`Alert`. `⚠` glyphs → real error styling. |
| `auth/register/page.tsx` | Password strength meter rebuilt with Lucide check/minus icons; `✓`/`⚠` glyphs removed; errors now field-level instead of toasts. |
| `auth/forgot-password/page.tsx` | Rebuilt; success state no longer leaks whether an account exists ("If an account exists for…"). |
| `auth/reset-password/page.tsx` | Validation moved from toasts to field-level errors. |
| `auth/verify-email/page.tsx` | Rebuilt; kept the honest long loading state for the slow synchronous SMTP resend. |
| `auth/oauth-callback/page.tsx` | Rebuilt; distinct error vs loading states. |
| `auth/onboarding/page.tsx` | 12 emoji → Lucide. Numeric inputs → `NumericField`. Removed "your AI trainer will personalize everything" (**AI is Phase 11 and does not exist**) and a fabricated "Community 10K+ Members" tile. API payload and step logic unchanged. |

### Section 2 — Dashboard (full rewrite)

`src/app/dashboard/page.tsx` — 461 lines rebuilt. Behaviour preserved (same 3 endpoints, same
data shape). Changes: `PageHeader`; `StatTile`/`ListRow`/`EmptyState`/`SkeletonCard` replace
bespoke markup; **water logging is now optimistic** with visible rollback on failure (previously
it blocked on the round trip); `"Loading..."` text replaced with shape-matched skeletons;
`bg-gradient-to-r from-blue-600` admin banner flattened; 👋/🔥/💧/✓ removed; 16 hardcoded
`#F87404` → tokens; "Super Admin Access — full platform management rights" cut to "Admin".

### Token codemod — the bulk of the retrofit

Rewriting 56 pages by hand was not achievable in one session, but the colour/radius/elevation
migration is deterministic, so it was scripted instead of hand-typed. **3,430 replacements across
55 files.** Two rules were corrected after a dry run and a real-file diff review:

1. `rounded-xl` → `rounded-md`, **not** `rounded-sm`. Stock `rounded-xl` is 12px and our
   `--radius-md` is also 12px, so this preserves the exact visual size; mapping to `rounded-sm`
   (8px) would have visibly sharpened every card corner in the app.
2. **Skipped `src/app/page.tsx` and `src/app/auth/`** — they have hardcoded *dark* backgrounds
   where an unpaired `text-gray-400` is deliberate light-on-dark. Rewriting those to theme-aware
   tokens would render dark-grey text on a dark panel in light mode.

The codemod handled colour only. `PageHeader`, `Skeleton`, `EmptyState`, `ListRow` and copy are
judgement calls and remain manual per page — that is what "structural pass pending" means above.

### 🗑️ Dead mock component found and deleted

`src/components/food/FoodSearchModal.tsx` (189 lines) held a **hardcoded 15-item food database**
and a fake save — `await new Promise(r => setTimeout(r, 400))` followed by a success toast. It
never called the API. Verified unreferenced by any file, then deleted. Same class of problem as
`mockData.ts`.

### Design-tell counts

| Tell | Baseline | Now | Target |
|---|---|---|---|
| Emoji — actionable | 245 | **161** | 0 |
| Emoji — `EmojiPicker.tsx` (legitimate) | 128 | 128 | stays |
| Heavy shadows | 91 | **23** | ≤8 |
| Gradients | 120 | **101** | ≤1 |
| `rounded-2xl` / `rounded-3xl` | 228 | **33** | 0 |
| `gray-*` classes | ~1400 | **333** | low |
| Emoji in `src/app/auth/**` | 29 | **0** ✅ | 0 |

**The remaining debt is heavily concentrated in one file.** `src/app/page.tsx` (the public landing
page) alone holds **45 emoji + 54 gradients + 23 shadows** — that is 28% of remaining emoji, 53% of
remaining gradients and 100% of remaining shadows. It is also the first thing any visitor sees, so
it is the single highest-value page left and the recommended next task.

After that, remaining emoji cluster in: `admin/emails` (18), `admin/notifications` (15),
`fitness/goals` (12), `social` (11), `social/[username]` (9), `fitness/streak` (8),
`ai-trainer/meal-visualizer` (7), `store/socialStore` (7), `store/i18nStore` (6).

### Verified personally

- `npx tsc --noEmit` — zero errors, run after every batch including post-codemod.
- `npm run build` — success (20.0s), all 65 routes generated.
- All 6 auth routes return 200 after rebuild.
- `/onboarding` → 307 → `/auth/onboarding`; `/food-log` (authenticated) → `/food-journal`; `/food-log/history` → `/food-journal/history`.
- Dev credentials absent from both the built JS chunks and the served login HTML.
- Codemod reviewed as a real diff on `food-journal/barcode/page.tsx` **before** applying, then reverted and re-run for real.
- All debt counts above are script-measured, not estimated.

### Section 13 — Landing page (client decisions applied)

Client decisions: **remove fabricated testimonials entirely**; **mark AI "Coming soon"** and drop it
from paid tiers.

Removed as fabricated (none of it was real, on a pre-launch product):
- 3 testimonials attributed to named individuals with cities and specific results ("Latisha M., Atlanta GA, Lost 42 lbs in 5 months"), illustrated with Unsplash stock portraits, under the heading *"No photoshop. No paid actors."*
- A "community" strip of **12 stock portraits presented as members**, three carrying fake green "online" dots, plus "10,247+ members already inside" and "4.9 avg rating".
- A stats band: "10,247+ Active Members / 2.4M+ Meals Logged / 890K+ Workouts Crushed / 98% Member Satisfaction" → replaced with claims that are true today (30 days free / no card / cancel any time / all-in-one).
- Hero social proof: stock avatars, "+9K", a 4.9 star rating, and a **"Results or your money back" guarantee**.

AI handling: `AI Personal Trainer` now renders a **"Coming soon"** chip and was **removed from the
Premium and Annual VIP feature lists**, so nobody subscribes expecting a feature that is not built.
GPT-4 claims are gone.

Design: **45 emoji → 0**, **23 shadows → 0**, gradients 54 → 21 (the 21 remaining are dark scrims
over hero photography for text legibility, which are legitimate, not decorative brand gradients).

### Requested verifications — both completed

**1. Full auth flow, end to end (8/8 passed)** — against the real API, not mocked:

| Step | Result |
|---|---|
| Register new account | 201, token issued, trial 29 days |
| Unverified user hits `/api/dashboard` | **403** (correctly gated) |
| Unverified user hits `/api/auth/user` | 200 (correctly allowlisted) |
| Click the genuine signed verification link | 302 → `/auth/verify-email?status=verified` |
| **Tampered** verification link | **403** (signature rejected) |
| Login after verifying | 200, `email_verified: true` |
| Verified user hits `/api/dashboard` | **200** (was 403 before) |
| Wrong password | **401** |
| Logout | 200 |
| Reuse token after logout | **401** (token revoked) |

Test account deleted afterwards.

**2. Water-log optimistic rollback — now actually testable.** The apply/confirm/rollback sequence
was inline in the dashboard where the failure branch only ran if the network died. It is extracted
to `src/lib/optimistic.ts` and covered by **11 assertions, all passing**, run against the file
compiled by the real `tsc`:
- success shows the optimistic value then the authoritative one;
- **failure restores the original value and fires the error toast**;
- failure restores the *captured original*, not a recomputed inverse — so a counter cannot drift permanently wrong if something else changed the value mid-flight;
- a server value that disagrees with the prediction wins;
- the counter cannot go below zero.

Real server-side failures were also forced against the live endpoint (revoked token, absent token,
garbage token → all 401), confirming `commit()` genuinely rejects on the paths the UI depends on.

### Legacy layer + emoji column removal (verified)

- `php -l` clean on all three touched PHP files.
- Migration applied, **rolled back, and re-applied** — `emoji` restored on rollback, gone again on re-apply.
- Goals API exercised live after the drop: `POST` with `icon_name: "dumbbell"` → **201**, value persisted; `GET` confirms `icon_name` present and `emoji` **absent** from the payload; negative `target_value` still **422**. Test goal deleted.
- `npx tsc --noEmit` zero errors; `npm run build` success.

### Emoji remaining — 105 (from 245)

| File | Count |
|---|---|
| `admin/emails` | 18 |
| `admin/notifications` | 15 |
| `social/page` | 11 |
| `social/[username]/UserProfilePageClient` | 9 |
| `fitness/streak` | 8 |
| `ai-trainer/meal-visualizer` | 7 |
| `store/socialStore` | 7 |
| `ai-trainer/page` | 6 |
| `store/i18nStore` | 6 (locale flags) |
| 11 other files | 1–4 each |

`EmojiPicker.tsx` (128) is excluded — it is a legitimate user-facing emoji input.

### NOT verified

- **Browser rendering of the codemod's output.** You have now approved 8 pages by eye (login, register, dashboard, design-system, food-journal, fitness, admin, landing), but the codemod touched **55 files**; most remain unviewed.
- **The rollback was proven at the logic and API layers, not visually.** I did not watch the number jump back in a browser.
- Pages in the 🟡 rows still lack `PageHeader`, so on mobile they have no top bar (as noted in Stage 2). **This is the single largest remaining item in Stage 3.**
- The Goals page renders `icon_name` correctly per the API round-trip, but the **rendered icons have not been seen**.

### Structural pass — PageHeader (mobile top bar restored on 24 pages)

The missing mobile top bar has been the known regression since Stage 2. 22 pages shared an
identical hand-rolled header (back chevron + `<h1>` + `<p>` + optional action), so it was converted
by codemod rather than by hand; `fitness/page.tsx` and `dashboard` were done manually.

Reviewed the transform as a real diff on one file before applying. Cleaned the unused
`ChevronLeft` / `Link` imports the conversion left behind (23 files).

**`PageHeader` also gained `-mx-4 md:-mx-6`** so the bar and its bottom border span the full width
instead of being inset by the shell's horizontal padding. This slightly changes the already-approved
dashboard header — it is now flush rather than inset, which is the intended §2.1 behaviour.

Verified live: sticky `<header>` present on all 10 sampled pages; back button present on nested
screens and correctly **absent** on the top-level `/fitness`.

| Converted (24) | |
|---|---|
| fitness | page, goals, body-stats, history, log-workout, streak |
| food-journal | history, barcode, photo-log, voice-log |
| calendar | meal-planner, shopping-list, todo |
| admin | emails, notifications, recipes, stats, undercover, users |
| ai-trainer | achievements, body-visualizer, meal-visualizer |
| recipes | create, saved |
| dashboard | (manual, Section 2) |

### Stage 3 — what is left

1. **~26 in-shell pages still lack `PageHeader`** — their header markup did not match the codemod
   pattern and needs hand conversion: `food-journal/page`, `social/*` (4), `messages` (2),
   `videos` (2), `live`, `membership` (3), `notifications`, `profile` (3), `settings`,
   `calendar/page`, `recipes/page`, `recipes/[recipeId]`, `admin/page`, `admin/api-keys`,
   `admin/content-flags`, `admin/moderation`, `admin/live`, `admin/videos`, `ai-trainer/page`.
2. **Skeletons / EmptyState / ErrorState / ListRow / NumericField** migration across those sections.
3. **105 emoji** in the 20 files listed above.
4. **Admin tables → stacked cards on mobile** (§2.4).
5. **Copy rewrite** on the un-retrofitted pages.
6. Messages: preserve the `Set`-based dedup fix when restructuring.

---

## SESSION 4 — render-phase bugs, PageHeader continued, mock-data findings

### 🐛 `react-hooks/static-components`: 14 → **0** (real behaviour bugs)

These were components defined *during render*, so React treated each as a brand-new type on
every render and unmounted/remounted the subtree — losing focus and state.

| Where | What it did | Fix |
|---|---|---|
| `components/shell/AppShell.tsx` ×3 | `NavList` defined inside render. `useUnreadCounts` polls every 60s → **the whole desktop sidebar remounted once a minute** | Hoisted to module scope, takes `pathname`/`counts` as props |
| `app/profile/settings/page.tsx` ×7 | Inline `Toggle` → every switch remounted on each state change | Replaced with the module-scope `Switch` primitive |
| `fitness/body-stats`, `fitness/history`, `food-journal/history` ×4 | Three near-identical `CustomTooltip`s defined in render; Recharts remounted the tooltip while hovering | One shared `components/ui/ChartTooltip.tsx` — also removed a hardcoded `dark:bg-[#222]` and 5 `any`s |

`no-explicit-any` fell 35 → 30 as a side effect of typing the shared tooltip.

### 🔴 `admin/api-keys` was faking every save and test — now wired

Every action on that page did `await new Promise(r => setTimeout(...))` and then reported
success. An admin could enter SMTP credentials, see **"Settings saved successfully!"** and
**"Test email sent!"**, and *nothing had happened*.

The endpoints were **already fully implemented** in `AdminController` — only the frontend was
faking. Now calls `GET /admin/settings`, `POST /admin/settings/smtp`, `/settings/test-smtp`,
`/settings/nutritionix`, `/settings/test-nutritionix`, with real error messages.

**Verified live:** saved SMTP settings returned 200, a follow-up GET returned the persisted
values (`mail_host: smtp.hostinger.com`), and an invalid payload was rejected with 422.

### ⚠️ Four admin pages are non-functional mockups — now labelled

Zero API calls, all state local. They look complete but do nothing:

| Page | Belongs to |
|---|---|
| `admin/notifications` | Phase 8 §4.4 (motivational message pool + schedule) |
| `admin/content-flags` | Phase 10 §E4 (flag queue + keyword scanner) |
| `admin/undercover` | Phase 10 §E3 (admin-controlled accounts) |
| `admin/api-keys` | **fixed this session** |

Each now renders a **"Not connected yet"** warning naming the phase that builds it, so nobody —
Kelvin included — mistakes them for working features. Their emoji were left alone: that content
is admin-authored message copy which Phase 8/10 replaces with DB records.

### More fabricated content removed (`profile/settings`)

Consistent with the rule already applied to the landing page: **"Pro Plan · Active"** (shown
regardless of real subscription), **"Visa ending in 4242"** (no payment system exists until
Phase 8) and **"Two-Factor Auth · Enabled"** (2FA is not built — a false security claim).
Membership now reads the user's real `is_on_trial` / `subscription_status`; the other two rows
are hidden until the features exist.

### ⚠️ Settings toggles do not persist

`profile/settings`' notification and privacy switches are **local state only** — nothing is
saved, so every switch silently resets on reload. Real columns and endpoints belong to Phase 8
(§4.4) and Phase 9 (§5.7). Flagged in-code rather than half-built.

### Progress this session

| Metric | Before | After |
|---|---|---|
| `react-hooks/static-components` | 14 | **0** |
| `no-explicit-any` | 35 | **30** |
| Pages lacking `PageHeader` | 31 | **24** |
| Files with actionable emoji | 21 | **11** |

Converted to `PageHeader`: `calendar`, `food-journal`, `recipes`, `social/friends` (codemod);
`notifications`, `social`, `admin/content-flags` (by hand). `notifications` also gained
`SkeletonRow` loaders and an `EmptyState`.

### A codemod mistake worth recording

The second `PageHeader` codemod broke `recipes/page.tsx`: my balanced-bracket guard passed, but
the regex's non-greedy match stopped at a **nested** `</div>` and left the outer one unclosed.
`tsc` caught it immediately (TS1381/TS1382) and it was hand-fixed. Lesson: bracket-counting is
not a substitute for real parsing — always run `tsc` between codemod batches, never chain two.

### SMTP investigation — no data was wrong, and nothing was changed

The admin page showed `smtp.gmail.com`; `.env` and the DB both said `smtp.hostinger.com:465`.
**They already matched.** The page was showing `DEFAULT_SMTP` — its hardcoded initial state —
because the running frontend was serving a **stale build** predating the API wiring (the same
build-without-restart trap documented above). Rebuilt; the page now shows the stored values.

The `system_settings` smtp rows were written by my own verification POST in the previous session
(copied from `.env`, hence identical). Disclosed and confirmed correct by the client — left in place.

### 🐛 Two related bugs found and fixed in admin settings

**✅ CLOSED — confirmed working end to end by the client: a real test email was received.**

**1. "Send test email" tested the wrong configuration.** `testSmtp()` built the mailer from the DB
only: `'password' => $smtp['mail_password'] ?? null`. The DB has no password row, so the test
authenticated with `null` and failed — *even though the app's real mail works fine*, because
actual sending uses `.env`. An admin would conclude SMTP was broken when it was not.
Now each field falls back to the `.env`-backed config when the DB does not supply it, so the test
exercises the configuration that really sends mail. **Verified:** with no DB password, the
resolver reports `password -> (from .env — fallback WORKS)`.

**2. A load-then-save cycle would have destroyed the stored password.** `getGroup()` masks secrets
as `••••••••` on read, and the api-keys page I wired loads those values into form state — so
pressing Save would have written the mask string in as the real password. Introduced by my own
wiring. Fixed: the mask (now `SystemSetting::MASK`) and blank values are treated as "leave
unchanged", in both the SMTP and Nutritionix handlers.
**Verified:** saved `REAL_SECRET_123`, then POSTed the mask → HTTP 200, stored value still
`REAL_SECRET_123`. (First attempt at this test produced a *false pass* — bash mangled the
multi-byte `•` so the request 422'd and nothing was written. Re-run with a UTF-8 payload file.)

**⚠️ Correction to an earlier claim:** I previously said these secrets are "encrypted at rest".
**They are not.** `is_secret` only masks the value on read; `set()` stores plaintext. SMTP
passwords and API keys sit in the `system_settings` table in the clear. Worth addressing before
launch — Laravel's `encrypted` cast on the `value` column would do it, with a migration to
re-encrypt existing rows.

### Fonts self-hosted — the build no longer touches the network

`next/font/google` downloads font files at build time, so every production build depended on
reaching `fonts.gstatic.com`. That failed once mid-session (`Error while requesting resource` ×2)
and killed the build — unacceptable during a deployment.

Now `next/font/local`, with the woff2 files committed:
- `public/fonts/Inter-Variable-latin.woff2` (48,256 bytes, variable 100–900)
- `public/fonts/ArchivoBlack-400-latin.woff2` (18,604 bytes)

**Verified:**
- Build succeeds with **all outbound HTTP blocked** (`HTTP_PROXY`/`HTTPS_PROXY` pointed at a dead port) — 38.2s, clean.
- Zero `next/font/google`, `fonts.googleapis.com` or `fonts.gstatic.com` references in source (the two greps that match are inside my explanatory comment).
- Served page makes **0 external font requests**; both woff2 files return 200 from our own origin at their exact byte sizes.
- The stylesheet's 4 `@font-face` blocks point at `../media/…woff2`, and the whole stylesheet contains **0** `https://` references.

To update a font later: re-download and replace the file — no code change.

### NOT verified this session

- **No page viewed in a browser.** All evidence is `tsc`, `npm run build`, eslint counts, and live API calls.
- The SMTP test button was verified by resolving the config chain in PHP, **not** by clicking it and receiving an actual email.
- Font *rendering* is unconfirmed by eye — only that the files serve and the `@font-face` rules are local.
- The remounting fixes are proven by the lint rule going to zero, **not** by observing the sidebar stop flickering.
- `admin/api-keys` was verified at the **API layer** (real save + persisted read-back + 422); the page's own form submission was not clicked through.

---

## SESSION 5 — PageHeader batch, more fabricated content removed

### `PageHeader`: 24 remaining → **10**, of which only 6 are real work

Converted 14 pages: `admin` (page, moderation, live, videos, api-keys), `profile` (page, edit,
settings), `settings`, `membership` (page, subscribe), `social/explore`, `videos`, and
`membership/trial-expired` (deliberately *without* a header — see below).

**4 of the 10 remaining are thin server wrappers** (5–15 lines) that only render a client
component — `messages/[conversationId]/page.tsx`, `recipes/[recipeId]/page.tsx`,
`social/[username]/page.tsx`, `videos/[videoId]/page.tsx`. They neither need nor should have a
header; the client component carries it.

**6 genuinely remain**, all deliberately deferred because they have non-standard layouts that need
individual judgement rather than a pattern:
`messages/page` and `messages/[conversationId]/ConversationPageClient` (full-height split chat —
a sticky header would fight the panel layout), `live/page` (video player), `ai-trainer/page` (chat
UI, Phase 11 presentation-only), `recipes/[recipeId]/RecipeDetailPageClient` and
`social/[username]/UserProfilePageClient` (both lead with a cover image).

**Deliberate exception:** `membership/trial-expired` has **no** `PageHeader` by design. It is a
full-screen blocking gate, not a navigable screen — a back affordance would offer an exit that does
not exist. Same reasoning as the offline page. Documented in-file.

### More fabricated content removed (client's rule applied consistently)

- `membership/page` — **"Over 2,400 members already transforming their fitness"**. Another invented
  count on a pre-launch product.
- `admin/api-keys` — the subtitle **"Settings stored securely"** and a banner reading **"These
  credentials are encrypted"**. Both false; replaced with an accurate warning that values are
  stored as plain text, pointing at the tracked security debt.

### Decorative chrome stripped

- `videos/page` hero: a 3-stop inline gradient, a **hotlinked Unsplash background**, two blurred
  glow orbs and a dot-grid overlay → standard `PageHeader` plus a plain stats row. Its stat numbers
  were `text-white` (correct against the old dark hero, invisible on the new light surface) and are
  now tokenised.
- `membership/page` and `trial-expired`: gradient hero blocks → solid accent.

### Unused imports: 52 → **11**

The conversions orphaned imports (`ChevronLeft`, `Link`, `Star`, `Crown`…). Pruned 41 across 23
files with a script that only removes *import specifiers* eslint has flagged, never locals or
params. The count is now well below where this session started (39).

### Gate

```
npx tsc --noEmit → clean
npm run build    → ✓ Compiled in 18.9s
14/14 converted pages return 200 with a sticky header present (trial-expired correctly without)
```

| Lint rule | Session start | Now |
|---|---|---|
| `no-unused-vars` | 39 | **11** |
| `react-hooks/static-components` | 0 (fixed last session) | 0 |
| `set-state-in-effect` | 32 | 32 (not started) |
| `no-explicit-any` | 30 | 30 |
| `no-img-element` | 92 | 92 |

### NOT done this session

- **`set-state-in-effect` (32) was not started.** Stopping instead of half-starting a 32-instance batch, per the standing instruction.
- No page viewed in a browser; verification is HTTP status + sticky-header presence in served HTML.
- `messages`, `live`, `ai-trainer` and the two detail client components still need per-page judgement.

---

## SESSION 6 — PageHeader complete, set-state-in-effect analysed, no-img-element deferred

### `PageHeader`: **complete**

Every in-shell page now has one, or is a documented exception. Converted this session:
`ai-trainer`, `live`, `messages`, `social/[username]`, `videos/[videoId]`.

**Count correction:** the previous session reported "6 remaining". It was **7** —
`videos/[videoId]/VideoDetailClient.tsx` was missed because the audit glob only matched
`*PageClient.tsx`. Re-audited with a broader pattern.

**Documented exceptions (deliberate, explained in-file):**

| File | Why no PageHeader |
|---|---|
| `messages/[conversationId]/ConversationPageClient` | A chat header's job is to show *who* you are talking to — avatar, name. `PageHeader` has no avatar slot; converting would drop it and make the screen less useful. |
| `recipes/[recipeId]/RecipeDetailPageClient` | Leads with a full-bleed hero image and floats its back button over it. A solid sticky header would push the hero down and break the immersive pattern. |
| `membership/trial-expired` | Full-screen blocking gate. A back affordance would offer an exit that does not exist. |
| 4 thin server wrappers (5–15 lines) | They only render a client component; the client carries the header. |

### More non-functional UI found and removed

- `ai-trainer` showed a live green **"Online · always ready"** pulse for a service that does not
  exist — its replies are canned strings matched on keywords. Now labelled *"Not built yet — this
  is a preview with canned answers. The real AI coach arrives in Phase 11."* This also makes the
  screen agree with the landing page, which already says AI is "Coming soon".
- `ConversationPageClient` had **Phone and Video buttons with no `onClick`**. They looked tappable
  and did nothing; there is no calling feature. Removed.
- `social/[username]` cover: 3-stop gradient → section accent.

### `set-state-in-effect`: 33 → 31, and **that is the correct outcome**

I analysed all 33 rather than mass-rewriting them. **31 are correct React, not defects**, and
"fixing" them would introduce hydration bugs. Breakdown:

| Category | Count | Why it must stay |
|---|---|---|
| **SSR-hydration guards** — reading `localStorage`, `Date`, `navigator`, `setMounted(true)` | ~6 | Computing these during render produces a server/client mismatch. Setting them in an effect is precisely the documented fix for that. |
| **Async data fetch** — `useEffect(() => { fetchX(); }, [fetchX])` | ~17 | `setState` happens after an `await`. This is the standard, unavoidable client-side data-loading pattern. One render when data arrives; no cascade. |
| **Loading flags at fetch start** — `setLoading(true)` | ~3 | React bails out when the value is unchanged; when it does change, that render *is* the intended "show the spinner". |
| **Reacting to route/prop change** — close sheet on navigate, reset drag on close | ~3 | Legitimate side effects of a prop changing. |
| **Seeding a form from loaded user data** | 2 | Could use a `key` instead, but the current form works and changing it risks discarding in-progress edits. |

**2 were genuine defects and are fixed** — `admin/recipes` and `admin/videos` each ran two effects
where the second was guarded by `if (!loading)` with **`loading` missing from its dependency
array**. That guard read a stale closure value, so whether a filter change actually refetched
depended on render timing rather than on the filters. Collapsed into a single effect keyed on the
`useCallback`, with a `cancelled` flag so a late `finally` cannot set state after unmount.

**Recommendation:** treat the remaining 31 as accepted, not as debt. If the noise is unwanted,
disable `react-hooks/set-state-in-effect` for async-fetch effects via targeted
`// eslint-disable-next-line` comments rather than restructuring working code.

### `no-img-element` (92) → **deferred to Stage 7 F3**, deliberately

Reasoning:
1. **The brief already assigns it there.** §7.3 F3 reads "Lazy-load images (`next/image` where possible, `loading="lazy"` otherwise)". This is performance work, not Stage 3 presentation work.
2. **It needs infrastructure, not styling.** `next/image` requires `remotePatterns` in `next.config.ts` for every external host — the API's `/storage` uploads, and any remaining stock imagery. That is a deployment concern that belongs with the perf pass.
3. **It changes layout behaviour.** `next/image` needs `fill` + `sizes` or explicit dimensions per image; each of the 92 sites needs a sizing decision. Doing it now and again during the perf pass means touching them twice.
4. **It pairs with work that is already in Stage 7** — F3 also covers server-side image compression and thumbnail generation via `intervention/image`. Converting the frontend without the backend resizing only moves the problem.

### Gate

```
npx tsc --noEmit → clean
npm run build    → ✓ Compiled in 38.1s
/ai-trainer, /live, /messages → 200 with sticky header
```

### NOT verified

- No page viewed in a browser.
- `videos/[videoId]` and `social/[username]` fetch client-side, so server-rendered HTML shows only their loading spinner — my curl check **cannot** confirm their headers render. `tsc` and the build pass and the code path is simple, but it is unconfirmed.
- The two effect fixes are verified by lint delta and a clean build, **not** by exercising a filter change in a browser.

---

## SESSION 6b — layout bug found in browser testing (client-reported)

### 🐛 One root cause behind three symptoms, on **6 pages** not 1

Client reported on `/videos/[videoId]`: header not sticky, title clipped to "/ideos" behind the
sidebar, and horizontal scrolling. All three came from a single wrapper:

```jsx
<div className="flex-1 overflow-y-auto">   ← the culprit
```

1. **Sticky broke.** `overflow-y-auto` creates a scroll container, and `position: sticky` anchors to
   its nearest *scrolling* ancestor. But the window is what actually scrolls (AppShell's `main` has
   no overflow), so the header was anchored to a container that never scrolls — it just moved with
   the content.
2. **Title clipped.** Per CSS spec, when `overflow-y` is `auto` and `overflow-x` is `visible`,
   **`overflow-x` computes to `auto`**. That clipped `PageHeader`'s `-mx-4 md:-mx-6` breakout,
   cutting the left edge off the title.
3. **Horizontal scroll** — the same computed `overflow-x: auto` produced the scrollbar.

`flex-1` was also inert: AppShell's `main` is not a flex container in non-`fullWidth` mode.

**Fixed on all 6:** `videos/[videoId]`, `videos`, `live`, `admin/live`, `admin/videos` (the client
saw only one). `messages` was checked and is fine — its overflow containers are chat panels that
correctly scroll internally, and are siblings of the header, not ancestors. Same for `live`'s two
remaining panels.

Also removed doubled padding on `videos/[videoId]` (`px-4 md:px-8` nested inside AppShell's
`px-4 md:px-6`), so the header's negative margin now matches its container exactly.

### Fabricated video stats removed

`163,702 views` / `13,965 likes` were **real database rows but hand-authored seed values**
(22100, 21001, 18500 …) — "from the database" did not make them real. Zeroed in
`VideoSeeder.php` (12 videos) and in the existing rows, so counts now start at 0 and grow from
genuine traffic. Verified: a single API read moved video #1 to `views=1`, i.e. the counter is now
tracking reality.

⚠️ **Same pattern still present elsewhere, NOT changed** — flagging rather than silently editing
more data: `LiveSessionSeeder` (`likes_count` 312/198/143/487) and `RecipeSeeder`
(`reviews_count` 124, plus `rating`). Recipe `rating` feeds `orderByDesc('rating')`, so zeroing it
changes list ordering — worth a decision rather than an assumption.

### Sidebar scrollbar hidden

`aside nav` now carries the existing `no-scrollbar` utility: scrollbar chrome hidden, scrolling
still fully functional (wheel, trackpad, keyboard, touch). Verified computed
`scrollbar-width: none` with `overflow-y: auto` intact.

### Verified in a real browser (first time this project)

Driven with Playwright against **system Chrome** (`channel: 'chrome'`) so no ~150MB browser
download and no new dependency in `package.json`.

```
mobile 375px + desktop 1280px, 5 pages:
  position: sticky ✓   header.x >= sidebar width ✓   horizontal overflow = 0px ✓
  sidebar: scrollbar-width=none, overflow-y=auto ✓
  11/11 passed
detail-page deep check: 14/14 passed
  title "Full Body HIIT Blast" renders fully, x=58 (mobile) / x=314 (desktop)
  header stays pinned on scroll: y 16 → 0 at scrollY=440
```

**Caveat:** the desktop sticky-on-scroll assertion passed *trivially* — at 1280×900 that page is
shorter than the viewport, so `scrollY` stayed 0 and nothing actually scrolled. Real sticky
behaviour is confirmed on mobile only.

Two harness bugs of my own were caught and fixed before trusting results: authenticating by cookie
only (the client guard reads `localStorage`, so it redirected to `/dashboard` and I was measuring
the wrong page), and loading from `127.0.0.1:3000` while the API is `localhost:8000` — a CORS
origin mismatch that blocked every request and left the page stuck loading.

### Pre-existing lint issues surfaced (NOT introduced by this work)

`npx eslint` on the fitness/food sections reports `no-explicit-any` (7+), *"Calling setState
synchronously within an effect"*, and *"Cannot create components during render"*. These predate
the retrofit and are real code-quality problems worth a pass of their own — the render-phase
component creation in particular can cause remounting bugs.

---

## ⚠️ LOCAL DEV GOTCHA — unstyled pages after a rebuild

**Symptom:** pages render as raw HTML with no CSS at all — blue underlined links, default
bullets, browser fonts. The sidebar looks like a plain bulleted list.

**Cause:** `npm run start` reads the build manifest **once, at boot**. Running `npm run build`
while that server is still up swaps the contents of `.next` underneath it. Next reuses
deterministic chunk filenames, so the stale manifest still points at a URL that returns **HTTP
200** — it just serves an orphaned chunk from the previous build. Nothing 404s, so it looks like
a CSS bug rather than a process one.

Observed here: server started `04:17:06`, `.next` rebuilt `04:28:26` — an 11-minute-old process
serving a newer build. The page linked `128zfrp3bur0j.css` (3,166 bytes, zero tokens) instead of
`0yl5yugc_57a1.css` (161,572 bytes, all tokens).

**Fix / prevention — always restart after building:**

```bash
# stop whatever holds :3000, then
rm -rf .next && npm run build && npm run start
```

`rm -rf .next` matters: orphaned chunks from earlier builds otherwise linger on disk and can keep
being served. This was self-inflicted — I rebuilt repeatedly this session without restarting.

**It was NOT the legacy CSS layer removal.** Verified independently: `globals.css` braces balance
(51/51), `:root` closes correctly, all removed classes had zero usages before deletion, and every
token class used in markup is defined in the served stylesheet.

---

## STAGE 4 §4.1 — STRIPE SUBSCRIPTIONS (backend complete, 2026-07-31)

`stripe/stripe-php` v21.1.1. Direct SDK, not Cashier — the brief's schema is already
explicit, and Cashier would add a second competing set of tables.

**Three tiers, live in Stripe test mode.** Created by `php artisan stripe:sync-plans`,
which is idempotent (products matched on a `plan_key` metadata field, prices on
`lookup_key`) and safe to re-run on every deploy. `--dry-run` shows changes first.

| Plan | Price | Stripe price ID |
|---|---|---|
| Basic | $9.99/month | `price_1TzDScDhUkMfBp6YSUPvHXFu` |
| Premium | $19.99/month | `price_1TzDSeDhUkMfBp6YxXb41jUS` |
| Annual VIP | $199.90/year | `price_1TzDSgDhUkMfBp6Y42kBZhSU` |

Annual VIP is exactly 10 × the Premium monthly rate, so the "2 months free" callout is
literally true rather than rounded marketing: $239.88 − $199.90 = **$39.98 saved (16.7%,
exactly 2 months)**. Verified arithmetically, not asserted.

Stripe prices are immutable, so a price change creates a *new* Price and transfers the
lookup key (`transfer_lookup_key`) — existing subscribers keep the rate they signed up on.

### Two API-shape traps found by probing rather than assuming

The pinned API version is `2026-07-29.dahlia`. Two fields that nearly every Stripe example
and tutorial still uses have moved, and both would have failed *silently*:

1. **`invoice.payment_intent` no longer exists.** The client secret is at
   `latest_invoice.confirmation_secret.client_secret`. Reading the old path yields null and
   the checkout form simply never receives a secret.
2. **`subscription.current_period_start` / `current_period_end` no longer exist** — they
   moved onto each subscription *item*. This one is nastier: the `subscriptions` table has
   both columns, so reading them off the subscription object writes **NULL for every
   renewal date** with no error anywhere. Both paths are now checked (item-level first,
   top-level fallback) so a version bump in either direction keeps working.

Found by probing the live API with a throwaway subscription before writing the controller.

### Idempotency — two layers, both proven

1. **`stripe_webhook_events.stripe_event_id` is UNIQUE**, and the handler INSERTs first and
   lets the database reject duplicates. A SELECT-then-INSERT check would leave a race window
   exactly when concurrent retries arrive.
2. **`SELECT … FOR UPDATE` inside a transaction** serialises concurrent deliveries of the
   same event; the second blocks until the first commits, then sees `processed` and exits.
   Effects and the `processed` flag commit in the *same* transaction, so a crash mid-handler
   rolls both back and the retry re-runs cleanly instead of half-applying.
3. `payments.stripe_invoice_id` is UNIQUE as a third guard, so a replayed
   `invoice.payment_succeeded` cannot record the same charge twice even if the ledger were
   bypassed.

Signature verification fails **closed**: a missing `STRIPE_WEBHOOK_SECRET` rejects every
request rather than accepting unverified ones, since a forged `invoice.payment_succeeded`
would otherwise hand out free subscriptions.

### Mass-assignment hardening (found while wiring this up)

`User::$fillable` contained `subscription_status` while the comment directly beneath claimed
it was "intentionally NOT freely fillable". Code and comment disagreed. **No live
vulnerability** — `updateProfile` validates against an explicit allowlist, so nothing could
reach it today — but a paywall was about to be built on that column, and one future
`$user->update($request->all())` would have handed out free subscriptions.

`subscription_status` and `stripe_customer_id` are now both non-fillable; every legitimate
write is an explicit `forceFill()` (AuthController registration ×2, ProcessTrials,
StripeSubscriptionService). Proven: hostile `create()`, `update()` and `fill()` payloads
carrying `subscription_status`, `stripe_customer_id` and `is_admin` are all ignored, while
`forceFill()` still writes — 12/12 assertions.

Note the trap this created: removing a column from `$fillable` makes `update()` **silently
no-op**, so `ProcessTrials` would have quietly stopped expiring trials. All writers were
converted in the same change.

### End-to-end verification (real Stripe test mode, real webhook delivery)

Stripe CLI 1.44.0 forwarded genuine events to the running server —
`stripe listen --forward-to http://127.0.0.1:8000/api/stripe/webhook`. Not simulated.
**48 events delivered, 48 answered HTTP 200, zero failures.**

| Check | Result |
|---|---|
| `POST /api/subscription` → client secret, no card data server-side | 201, `pi_…_secret_…` |
| Card **4242 4242 4242 4242** confirmed (verified `last4=4242`) | PaymentIntent `succeeded` |
| Webhook drove subscription to `active` | period start/end both stored |
| Payment row recorded, amount matches plan | 1999 = 1999, `paid_at` set |
| `user.subscription_status` → `active`, `hasAccess()` true | passed |
| **Replay of a genuine event** | 200 `{"duplicate":true}`, payment count 1→1, attempts 1→1, no new row |
| Forged signature | 400, nothing written to ledger |
| Missing signature | 400 |
| Card **4000 0000 0000 0002** (verified `last4=0002`) | typed `CardException`, "Your card was declined." — no raw exception |
| Declined card leaves lapsed user locked out | `hasAccess()` false, subscription `incomplete`, no successful payment |

**One correction worth recording.** The first decline run asserted "declined user has no
access" and *failed*. The code was right; the assertion was wrong — the test user was 30 days
into a valid trial, so their access came from the trial, not the failed payment. Re-ran
against a user whose trial had already expired, which is the case that actually tests the
gate: 13/13 passed. A failing assertion is not automatically a failing system, and the
difference matters.

All test users, Stripe customers and subscriptions were cleaned up; the 5 real users are
untouched and the ledger was cleared of test rows.

### ⚠️ Launch blocker: the configured webhook secret is a *local CLI* secret

`STRIPE_WEBHOOK_SECRET` in `.env` is byte-identical to the secret printed by
`stripe listen --print-secret` (confirmed by hash). That is the right value for local
development and is what made the end-to-end test possible without touching config — but it
is **not** a production endpoint secret. Deploying as-is means every real webhook fails
signature verification and **no subscription ever activates**, silently.

Before launch: create a webhook endpoint in the Stripe dashboard pointing at
`https://<domain>/api/stripe/webhook`, subscribe it to `checkout.session.completed`,
`invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`, and put *that* `whsec_…` in production env.

Also note this Stripe account is **shared with other projects** (products `myproduct` and
`Home Pros Guru`, plus 4 unrelated active subscriptions). Ours are identifiable by the
`plan_key` metadata field. Nothing belonging to another project was modified.

---

## STAGE 4 §4.1 FRONTEND + §4.2 GATING (complete, 2026-07-31)

`@stripe/stripe-js` 9.12.1 and `@stripe/react-stripe-js` 6.8.0.

### Three fabricated pages replaced

All three membership pages existed already, and all three were mock. This mattered more
than usual because they concerned money:

1. **`membership/page.tsx`** advertised Basic $7.99 / Pro $14.99 / Elite $24.99 — three
   tier names and three prices that exist nowhere in Stripe. Rebuilt to render entirely
   from `GET /api/plans`, so the page cannot drift from what a customer is charged.
2. **`membership/subscribe/page.tsx` was a fake payment form.** It collected raw card
   number, expiry and CVV into React state, displayed *"Your payment is secured with
   256-bit SSL encryption via Stripe"* while sending nothing anywhere, waited two seconds
   on a `setTimeout`, then told the user "Welcome to Pro!" and redirected. It also quoted a
   fabricated $159.99/year with a "Save 33%" strikethrough and an unbacked "30-day
   money-back guarantee". Replaced with real Stripe Elements.
3. **`membership/trial-expired/page.tsx`** quoted a fabricated $13.33/month, promised a
   money-back guarantee, advertised "AI Personal Trainer powered by GPT-4" (Phase 11, does
   not exist), linked to `/subscribe` with no plan parameter, and offered a "Continue with
   limited access" link straight to `/dashboard` — so the gate stopped nobody.

### The gate had to move — one chokepoint, not three

First wiring put `RequireSubscription` in `DashboardShell` (49 pages). Browser testing
showed an expired user still reaching the dashboard: `/dashboard`, `/food-log`, `/profile`
and `/settings` reach the shell through **`AppSidebarLayout`** via route-group `layout.tsx`
files, not `DashboardShell`. Both delegate to **`AppShell`**, so the gate now lives there —
one component, one allowlist, every route covered.

`AppShell`'s `UNGATED` list and the middleware's `ALLOWED_PREFIXES` must stay in step; if
they disagree a page renders and then every request it makes fails.

### `EnsureSubscriptionActive` middleware (§4.2)

Aliased `subscribed`, applied to the whole protected route group. Returns **402 Payment
Required**, not 403 — the caller is authenticated and understood; what is missing is a
subscription. 403 would imply this can never be permitted.

Allowlisted so a lapsed account is not a dead end: `api/auth`, `api/plans`,
`api/subscription`, `api/stripe`, `api/onboarding`.

**27/27 assertions:** active trial reaches all features; expired trial gets 402 on
`/dashboard`, `/food-log`, `/recipes`, `/notifications` with a clean message and no stack
trace; expired user still reaches plans, subscription, `auth/user`, logout, **and can start
checkout**; subscriber reaches everything; `past_due` keeps access through Stripe's retry
window; `canceled` loses it; unauthenticated is still 401, not 402.

### ⚠️ Regression caught: the client's own account was locked out

Applying the middleware locked out **kelvin@myextremetrainer.com** — `subscription_status`
= `active` from legacy seed data but no `subscriptions` row, so neither branch of
`hasAccess()` matched. The owner would have been shut out of the product he sells, and out
of the admin panel.

Fixed by exempting admins in `User::hasAccess()`. That is a real rule rather than a patch:
staff run the product and must reach the admin panel without holding a paid plan. Verified
the only legacy `active`-without-subscription account is that admin, and that **0 of 4 live
users** are locked out. Re-ran the full gate proof afterwards to confirm the exemption did
not open the gate for anyone else.

### Browser verification — 28/28, real card, real webhooks

Playwright driving system Chrome at **375px**, Stripe CLI forwarding genuine events.

- Pricing shows the real $9.99 / $19.99; none of $7.99, $14.99, $24.99 or the "Elite" name
  survive anywhere; Recommended badge on Premium; no horizontal scroll at 375px
- Annual toggle → $199.90, "Save $39.98 a year — 2 months free", $16.66/month equivalent
- Checkout: card fields render **inside a Stripe iframe**, and **0 card inputs exist in our
  own DOM** — the property that matters
- Card **4242 4242 4242 4242** → "You are on Premium"; DB shows `status=active`,
  `stripe_customer_id` set, period `2026-07-31 → 2026-08-31`, payment `succeeded 1999c`
- **33 webhook events, 33 processed, 0 failed**
- Expired user on `/dashboard` gets the gate, not the app; gate routes to plans; no
  "limited access" escape, no $13.33, no money-back guarantee, no GPT-4 claim; and the
  expired user can still reach pricing to pay
- Zero console errors throughout

Entitlement is never granted by the browser: after Stripe confirms, the page polls our own
API until the webhook has actually activated the subscription, so the success screen
reflects the database rather than an optimistic guess.

All test users, Stripe customers and subscriptions cleaned up; the 4 live users are
untouched and the ledger was cleared of test rows.

### Still open

- **`account_state` column + `UserAccountState` service (§4.2)** — not started. Gating
  currently reads `subscription_status`, which `StripeSubscriptionService::syncUserStatus()`
  recomputes from the subscriptions table on every sync rather than patching per event, so
  out-of-order webhooks cannot desynchronise it. The `account_state` migration should land
  together with the service that maintains it.
- **Trial conversion coupon funnel (§4.3)** — not started. Two tables, Stripe coupons and
  promotion codes, admin CRUD, editable email templates, scheduled sends. Its own session.
- **`frontend/CLAUDE.md` is stale** — still states "No backend, no API calls, no database /
  all data is mocked", which was true only in the mock phase. It now contradicts the actual
  architecture and should be rewritten before it misleads someone.

---

## DEPLOYMENT REQUIREMENTS (accumulating — full section due in Stage 4)

**From Stage 2:** the service worker is served from `frontend/public/sw.js` at the site root and
registers only in production builds. On deploy, bump `CACHE_VERSION` in that file whenever the
app shell changes, or returning installed users can hold a stale shell. The app posts
`CLEAR_CACHES` to the worker on logout.


Nothing from Stage 1 requires new production infrastructure.

✅ **Stage 4 §4.0 — RESOLVED (2026-07-31).** Full setup is now documented in
[QUEUE_SETUP.md](QUEUE_SETUP.md), which is the authoritative doc for both processes.
`CRON_SETUP.md` and `DEPLOYMENT.md` were corrected to match and cross-reference it.

**Correction to the earlier claim above.** Prior sessions recorded "no queue worker and no cron
are running." Half of that was wrong in a way worth recording:

- A `queue:work` process **was** running on this machine — but its working directory is
  `c:/xampp/htdocs/Rapzi-platform`, a different project. It polls that app's queue, not this
  one. The conclusion (no worker for Gym_Saas) held; the reasoning behind it did not.
- The **scheduler is genuinely absent** — no Windows scheduled task invokes `schedule:run`.
  `trials:process` has been registered since before Stage 1 and has therefore **never executed
  even once**. Trials do not currently expire on their own.

**Both cron docs were wrong in the same way:** they specified `*/5 * * * *`. Laravel's scheduler
must be invoked **every minute**; on a 5-minute cron anything not due exactly on a 5-minute
boundary is skipped silently and permanently. Both now specify `* * * * *` and log output
instead of discarding it to `/dev/null`.

**Dispatch is not execution — now provable on demand.** `php artisan queue:health` dispatches a
token-stamped probe job and waits for a worker to run it. Exit 0 = healthy, exit 1 = queued work
is not happening. The token match means a stale success cannot mask a dead queue. Verified both
directions:

| Condition | Result | Exit |
|---|---|---|
| No worker | Probe sat unprocessed in `jobs` | 1 |
| `queue:work` running | Executed in ~230ms, token matched | 0 |

Run it on the server after every deploy.

### `ProcessTrials` — three real defects found and fixed

The command has never run in this environment, and all 4 trial users have `trial_ends_at` 17–27
days out, so its queries match nothing. It exits 0 without exercising a single line of its logic.
That is exactly the condition under which these stayed hidden:

1. **Silent data loss (severe).** Both loops used `chunk()` while writing to a column in their own
   `WHERE` clause (`subscription_status`, `trial_reminder_sent`). `chunk()` pages with `OFFSET`, so
   as rows stop matching, the result set shifts left and the next page skips users.
   **Proven, not assumed:** 250 seeded expired trials → `chunk()` processed 150 and **missed 100
   (40%)**; `chunkById()` processed all 250 and missed none. Those 100 would stay `trial` — active
   and unbilled — indefinitely. Both loops now use `chunkById()`.
2. **Failed reminders were marked as sent.** `trial_reminder_sent = true` was written even when
   `Mail::send()` threw, so a reminder lost to an SMTP blip was never retried. The flag is now set
   only after a successful send.
3. **Every mail exception was swallowed by `catch (\Exception $e) {}`.** SMTP could fail for every
   user and leave no trace. Now logged via `Log::error` with the user ID. Expiry still proceeds on
   mail failure — a failed email is recoverable, a trial that silently stays active is revenue
   leaking — but it is recorded either way.

The command now reports `Reminders sent: N. Trials expired: N.` instead of an unconditional
"success", so scheduler logs carry real information.

**Mail deliberately left synchronous here.** This is already a background console command, so
queueing it would add a hard dependency on a running worker without taking anything off the
request path. Per brief Rule: never move work to the queue without a worker proven to consume it.

Test users created to prove the chunking bug were deleted; all 5 real users verified intact with
statuses and reminder flags unchanged.

---

## FIX — sticky header title blinking on scroll-up (2026-07-31)

**Reported:** the `PageHeader` title flickers continuously while scrolling up.

**Root cause — a layout feedback loop, not a rendering artefact.** `PageHeader` collapsed on
a single threshold (`scrollY > 24`). Collapsing removes roughly 30px of header height
(`py-3`→`py-2`, `text-h1`→`text-h3`, and the subtitle unmounts). The header is `sticky`, so
it is still in normal flow — shrinking it makes the document shorter, which pushes `scrollY`
back down, below the threshold, which expands the header, which grows the document, which
pushes `scrollY` back up past the threshold. The single threshold sat *inside* the range the
toggle itself moved the page through.

`transition-[font-size] duration-200` made it worse: height changed continuously for 200ms,
firing scroll events throughout, so each toggle re-triggered the check many times.

**Measured before the fix**, parked at y=27 with no scroll input at all:

| Page | scrollY drift | document heights | h1 font-size |
|---|---|---|---|
| /membership | **45 → 19 on its own** | 10 distinct in 2.5s | 17 → 23.58 |
| /recipes | 3 direction reversals | 11 distinct in 2.5s | 17 → 23.55 |

The page was scrolling itself. Document height oscillated between 1061 and 1028.

**Fix — hysteresis.** Two thresholds instead of one: collapse above `72`, expand below `16`.
The 56px dead zone is comfortably wider than the ~30px the collapse removes, so a collapse
can no longer undo itself. The scroll handler is also rAF-throttled to one state read per
frame, and syncs once on mount so a restored or deep-linked scroll position starts in the
right state.

**Verified after:** 20/20 on /membership and /recipes — no oscillation parked at y=14, 16,
18, 70, 72 or 74 (`fontSpread=0 drift=0 docHeights=1` at every point), collapse still works
(26px → 17px), expands again at top, subtitle returns, and a slow scroll-up sweep now changes
state **exactly once** instead of thrashing. Swept 12 further pages at the old failure point
(y=27): 12/12 stable.

Note for future scroll-linked UI: anything that changes the height of an element in normal
flow must not key off a single scroll threshold. Either use hysteresis, or take the element
out of flow so the document height cannot move.

---

## STAGE 4 §4.2 — ACCOUNT LIFECYCLE (complete, 2026-07-31)

Four states: `trial`, `subscriber`, `grace`, `deactivated`. Columns added to `users`:
`account_state` (indexed), `deactivated_at`, `scheduled_deletion_at`. Rollback round-trip
verified with no data loss; backfill mapped all 5 existing users correctly.

### `UserAccountState` — the single writer

Nothing else may assign `account_state`. State is **derived from facts** (subscription rows,
trial dates, deactivation timestamps) rather than patched per event, so events arriving late
or out of order converge on the same answer instead of drifting.

`StripeSubscriptionService::syncUserStatus()` previously wrote `subscription_status` itself —
that made it a second writer, so it now delegates here. `AuthController` (both registration
paths) and `ProcessTrials` were rewired the same way.

`subscription_status` is kept as a **derived mirror** for the admin dashboard, written only by
this service from the same computation. One writer, one computation — a projection, not a
competing source of truth.

Precedence deliberately puts a live subscription above everything: someone who pays *after*
their trial lapsed is a `subscriber`, not stuck in `grace`.

### Deletion is guarded, staged, and audited

`grace` → (90 days) → `deactivated` → (30 days retention) → soft delete → (30 more) → hard
delete. Two protections:

1. **Anyone who has ever paid is never swept by an automated job.** Removing a paying
   customer's record is a human decision with legal and support implications.
2. **`account_deletion_audits` has no foreign key to `users` — on purpose.** The whole point
   is to outlive the row it describes; a cascading FK would erase the audit at exactly the
   moment it becomes the only evidence the account existed. Email and name are copied in so
   "what happened to my account?" is answerable after the user row is gone.

`trials:process` gained `--dry-run`, which reports what would change without writing (`derive()`
is pure, so this is exact rather than an estimate).

### ⚠️ DECISION NEEDED: trial length is 14 in the brief, 30 in the product

The brief specifies "default 14 days (client is deciding between 14 and 21)". The live app
hardcoded **30** in both registration paths, and the product markets 30 days in several places:
`auth/layout.tsx` ("Free for 30 days"), `auth/login` ("Start your free 30-day trial"), and two
admin email templates ("Your 30-day free trial has started").

Trial length is now admin-configurable via `system_settings` (`trial.trial_length_days`) as the
brief requires, but **seeded at 30** so nothing changed silently and no marketing copy became a
lie. Verified 14 / 21 / 30 all produce exact spans, and that changing the setting never moves an
existing `trial_ends_at`.

**Client must confirm 14, 21 or 30.** If it changes, the marketing copy above changes with it.

Bad admin input is clamped (0, negative, non-numeric, >365 all fall back to 30) — a zero-day
trial would lock out every new signup the instant they registered.

### ⚠️ Regression caught: admin churn count silently became 0

`AdminController` counted churn as `subscription_status = 'cancelled'`. The new mirror never
emits `'cancelled'`, so that figure would have read **0 forever** with no error anywhere.

Fixed to read `account_state`, and the definition was tightened while there: churn now requires
a subscription to have existed (`whereHas('subscriptions')`). A trial that never converted is a
lost lead, not churn — counting them together made the number meaningless.

### Verified — 38/39

`derive()` across all four states including the subscription-beats-lapsed-trial case; every
transition and its side effects (grace starts the clock, deactivation schedules deletion,
recovery clears both); `apply()` idempotent; `hasAccess()` correct for all four states; mass
assignment cannot touch `account_state`, `subscription_status`, `deactivated_at` or
`scheduled_deletion_at`; dry run writes nothing; unpaid account swept but **account with payment
history spared**; audit written with email, reason and payment flag; hard delete removes the user
while **the audit survives**; restore works and is audited; trial length configurable without
retroactive change.

The one failing assertion is a bug in the test, not the code: it used a signed Carbon
`diffInDays` and read `-14` as wrong when the magnitude was exactly right. Confirmed separately
by measuring `trial_starts_at → trial_ends_at` spans directly: 14 / 21 / 30 all exact.

Gate middleware re-proven after the change (27 assertions, no failures) and **0 of 4 live users
locked out**.

### `frontend/CLAUDE.md` rewritten

It still instructed "No backend, no API calls, no database / all data is mocked", which was true
only in the mock phase and directly contradicted the architecture. Rewritten to document the real
stack, the two-place auth requirement (cookie for `proxy.ts`, localStorage for `api.ts`), the
single-shell and single-header rules, the gate allowlist needing to match the backend, and an
explicit **no mock data / no invented numbers or commitments** section citing the fabrications
that had to be removed. Brand colours and design intent preserved.

### Still open

- **§4.3 trial conversion coupon funnel** — not started. `coupon_offers` + `coupon_grants`,
  Stripe coupons and promotion codes, grant/redeem service, both scheduler stages (day 7 expiring
  day 10, day 18 expiring day 21), admin CRUD, editable email copy, and validation
  (percent ≤ 100, fixed ≤ plan price). Deliberately not opened — too large to finish coherently.

---

## STAGE 4 §4.3 — TRIAL CONVERSION COUPON FUNNEL (backend complete, 2026-07-31)

Two tables, both rollback-tested. `coupon_grants` carries a composite UNIQUE on
(user_id, coupon_offer_id) — the "never send the same offer twice" rule is enforced by the
database, not a `whereDoesntHave` check that would race when scheduler runs overlap.

### Stripe's two-layer model, mirrored

A **Coupon** holds the discount (one per offer); a **Promotion Code** is the redeemable
string pointing at it (one per user). A single shared code would tell us an offer converted
but never who, and leaks — one customer posting it publicly discounts everyone.

Codes look like `MXT-GKEGSRWT`, drawn from an alphabet with no `0/O/1/I/L`, because they are
retyped from emails and read aloud.

### Third moved-parameter trap on this API version

`PromotionCode::create` rejected `coupon` with *"Received unknown parameter: coupon"*. As of
`2026-07-29` it is nested: `'promotion' => ['type' => 'coupon', 'coupon' => $id]`. The `list`
endpoint still accepts a top-level `coupon` as a filter, which makes the old shape look
correct. Found by reading the SDK's own parameter signature rather than guessing — the same
class of failure as `invoice.payment_intent` and `subscription.current_period_start`.

### Two real bugs the tests caught

1. **Fatal on first send.** `CouponOfferMail` declared a `private render()`, but `Mailable`
   already defines it public — PHP refuses to narrow visibility. Every offer email would have
   crashed. Renamed to `substitute()`.
2. **The funnel ran backwards.** `dueOfferFor()` excluded only offers the user already held.
   A user who received stage 2 at day 18 still matched stage 1 on the next run, because
   stage 1's trigger day had also passed — so ignoring the *weaker* 15% offer earned them the
   *stronger* 30% one a day later. Now gated on `stage > highest already granted`, so the
   funnel only moves forward. Caught only by running the scheduler twice.

### Deliberate design decisions

- **Redemption is spent on payment, not at checkout.** `markRedeemed()` is called from the
  `invoice.payment_succeeded` webhook via a `coupon_grant_id` carried in subscription
  metadata. Marking it at checkout would burn a one-time code on an abandoned form.
- **Editing an offer's discount does not withdraw codes already sent.** Stripe coupons are
  immutable; changing the discount clears `stripe_coupon_id` so the next grant creates a
  fresh one. Codes already emailed keep the rate they were promised — withdrawing that is a
  broken promise, not a correction.
- **Deleting an offer that has grants deactivates it instead.** A hard delete would cascade
  to `coupon_grants` and destroy the record of offers people redeemed and paid against.
- **No guard on codes outliving the trial.** An earlier version skipped those; on inspection
  it solved a non-problem. The scheduler query already excludes anyone whose trial has ended,
  and a code valid a few days past the trial is useful — that is exactly when someone is
  deciding whether to pay.
- **`conversion_rate` is null, not 0, when nothing has been sent.** A 0% rate on zero sends
  is not a fact and reads as failure.

### Admin authorisation

Added an `admin` middleware alias and applied it to the coupon routes. `AdminController`
guards itself with a per-method `assertAdmin()` call — audited all 11 methods and **all are
guarded**, so there is no live gap, but one forgotten call is an open admin endpoint with
nothing to signal it. Declaring it on the route means a new action cannot ship unguarded.

### Verified — 55/55 against real Stripe test mode

Discount validation (200% rejected, 101% rejected, 100% allowed, 0 and negative rejected,
fixed above the cheapest plan rejected at `$9.99`); timing across day 3 / 8 / 20; real Stripe
coupon and promotion code created and matching, limited to one redemption; same offer never
granted twice; `resolveForCheckout` distinguishing not-yours / already-used / expired while
never confirming another user's code exists; redemption idempotent.

Checkout end to end: valid code → 201 with `amount_cents: 600`, and **Stripe's own invoice
total came back 1399** ($19.99 less 30%). Grant correctly still unredeemed at that point.

Admin CRUD: non-admin 403, admin can list, 200% and oversized-fixed both rejected with
explanatory messages, unused offer deletable, offer with grants deactivated and history
preserved.

Scheduler: dry run writes nothing; correct stage to each user; subscriber and already-lapsed
users skipped; `sent_at` and 3-day expiry recorded; second run produces **no duplicate grants
or emails**.

### Note for dev

Running `trials:process` against the dev database grants offers to the seeded trial users —
correct production behaviour, but it leaves real accounts holding codes whose emails were
faked. Cleared after each test run; worth remembering before wondering where a grant came from.

### Also fixed

`resources/views/emails/trial-expiring.blade.php` advertised **$7.99/month** — a price that
matches no plan — and "your AI coach", which does not exist. Replaced with copy that quotes no
figure at all: plan prices live in the database and are editable, so any number hardcoded in an
email eventually contradicts what the customer is actually charged.

### Still open in §4.3

- **Admin UI not built** — the CRUD API, validation and stats endpoints are complete and
  proven, but there is no screen for them yet. Deferred deliberately per the agreed ordering
  (backend and scheduler first, admin UI second).
- **Trial length remains a product decision** — 14 (brief) vs 21 vs 30 (live, and what all
  marketing copy says). Staying at 30; configurability is built and clamped.

---

## STAGE 4 §4.3-E — COUPON ADMIN UI (complete, 2026-07-31)

`/admin/coupon-offers`, added to the admin sidebar as "Conversion Offers".

Lists every offer with its real counters (sent, redeemed, expired unused, conversion rate),
create/edit in a mobile sheet covering discount config, timing and full email copy, plus
deactivate and send-preview.

**Conversion rate renders "No data", never 0%,** when nothing has been sent. The API already
returns null in that case; the UI honours it rather than formatting null as zero. A 0% rate on
zero sends reads as failure when it means "nothing has happened yet".

**Discount limits are shown while typing, not only after a rejected save.** The percent cap and
the live fixed cap (`$9.99`, the cheapest active plan, read from `meta.max_fixed_discount`) are
surfaced inline and the submit button disables while the value is invalid. The server rule
remains authoritative — this mirrors it for feedback, it does not replace it.

Numeric inputs follow the three-layer rule: keydown blocks exponent/sign characters, a regex
constrains the value on change, bounds are clamped on blur, and the server validates
independently.

Editing an offer whose discount changed shows the API's own message — that codes already sent
keep the rate they were promised — rather than a generic "Saved".

### Verified — 19/19 in-browser

At 375px: both seeded offers render with real values (30% off day 7, 15% off day 18), stats
columns present, conversion shows "No data", no horizontal scroll. Validation: over-100%
flagged inline and submit disabled, then re-enabled when corrected; over-cap fixed discount
flagged with the real `$9.99` figure; placeholder help listed. Full create → appears in list
with API-rendered discount and schedule → deactivate → removed. Zero console errors. Desktop
1280px renders with no horizontal scroll. Screenshot reviewed. No test residue left in the
database.

**§4.3 is now complete** — backend, scheduler, checkout redemption and admin UI.

---

## ⚠️ STAGE 4 IS NOT CLOSED — §4.4 AND §4.5 REMAIN

Stage 4 spans §4.0–§4.5. Completed: §4.0 queue/scheduler, §4.1 Stripe, §4.2 account lifecycle,
§4.3 coupon funnel. **Two substantial sections are still unbuilt**, so the Stage 4 gate cannot
run and Stage 5 is further out than a plan based on §4.3 alone would suggest:

- **§4.4 Scheduled motivational notifications** — `motivational_messages` and
  `notification_schedules` tables, admin CRUD over a pool of 8–10 messages, configurable days
  and times, and a scheduled command that picks the **least-recently-sent** message (explicitly
  not random, which repeats) and delivers through the existing `Notification` model. The brief
  requires it be genuinely functional, not a UI mock, and that web push be either wired fully
  or explicitly declared out of scope.
- **§4.5 Streaks, badges, auto-featuring** — four tables (`badges`, `user_badges`,
  `activity_streaks`, `feed_features`), extensible so a new badge type needs no migration,
  three initial badge types, idempotent computation (running the job twice must never
  double-award), auto-featuring driven by real activity data, and a distinct full-month
  celebration state the brief calls "the single most visually rewarding moment in the app".

---

## STAGE 4 §4.4 — MOTIVATIONAL NOTIFICATIONS (complete, 2026-07-31)

Two tables, both rollback-tested. Ten seeded messages and a "Weekday mornings" schedule
(Mon/Wed/Fri 09:00 UTC), all editable from the admin panel.

### 🔴 DECISION: web push is OUT OF SCOPE — in-app delivery only

The brief required this call be made explicitly rather than left ambiguous. **It is not
wired, and nothing pretends otherwise.**

Nothing existed to build on: no `push` or `notificationclick` handlers in `sw.js`, no VAPID
keys, no push library on either side. Wiring it fully means a VAPID keypair (application
identity the client must generate and own), a `push_subscriptions` table with per-device
endpoint and keys, a permission-request flow, subscription lifecycle including pruning dead
endpoints on HTTP 410, and **HTTPS** — which means it could not be meaningfully verified on
this dev setup at all. That is a batch the size of §4.4 itself, and half-wiring it would
produce exactly the "looks functional, silently does nothing" failure this project has hit
repeatedly.

Delivery therefore goes through the existing `Notification` model and appears in members'
in-app notification feeds. The admin screen says so on the page, and the API reports
`meta.delivery: "in_app"` so no caller can assume otherwise.

### Selection is least-recently-sent, and that is the point

`ORDER BY last_sent_at IS NULL DESC, last_sent_at, id`. Never-sent messages sort first so a
newly added message goes out next instead of waiting a full rotation; `id` is a stable
tiebreak so ties are deterministic rather than engine-dependent.

The page this replaced used `Math.random()` and its own copy read *"A random active message
is sent on each scheduled trigger"* — the approach the brief explicitly rules out. **Measured
over 30 picks across a pool of 10: 0 back-to-back repeats, 10/10 distinct per cycle, minimum
gap between the same message a full pool.** Random cannot give that.

### Firing once per local day

`SendMotivationalNotifications` is scheduled `everyMinute()->withoutOverlapping()`. Each
schedule decides for itself whether it is due — correct day (ISO numbers, matching Carbon's
`dayOfWeekIso`), send time passed, and `last_run_at` not already today, all evaluated in the
schedule's **own timezone** so "9am" means 9am where the members are. A fixed daily time in
the scheduler could not honour admin-configured times or per-schedule timezones.

`last_run_at` is what makes a per-minute invocation safe: without it, every tick after the
send time would fire another round.

### Recipients

Members with live access only — on trial or subscribed. Lapsed and deactivated accounts are
excluded: encouragement sent to someone locked out is marketing dressed as a feature, and
those users get the conversion funnel (§4.3) instead.

Delivery is a bulk `insert()` per 500-member chunk rather than one write per member, with
counters updated once after delivery so a partial failure does not unfairly push a message to
the back of the rotation.

### One real bug caught

`store()` formatted the unrefreshed model, so a newly created message reported
`send_count: null` instead of `0` — database defaults are not populated on the instance
`create()` returns. Fixed with `refresh()`.

(Four further test failures in the same run were my test's setup, not the code: I had reset
every message to never-sent, so the new one merely tied on `last_sent_at` and lost the `id`
tiebreak. The rotation was behaving correctly; the assertion was isolating nothing.)

### Verified

**Behaviour — 39/40** (one failure was a `sliding()` key bug in the test itself, re-verified
directly): recipients correct across trial/subscriber/grace/deactivated; strict rotation with
no repeats; inactive messages never selected; delivery lands with correct title, body, data
and unread state; schedule due-logic across wrong day, future time, inactive, and already-run.

**End to end — 26/26, through the real APIs**: non-admin blocked 403; admin creates a message
via the API; it becomes next in rotation; a schedule is created and invalid timezones and
out-of-range day numbers are both rejected 422; the scheduled command fires; **the member
receives it in their own notification feed via `GET /api/notifications`**, with the
unread-count endpoint reflecting it; a second run the same day delivers nothing.

**Admin UI — 17/17 in-browser** at 375px and 1280px: real seeded messages render, pool size
and recipient count come from the API, the in-app-only notice is visible, rotation is
explained as least-recently-sent, **the word "random" appears nowhere**, exactly one "Next to
send" badge, create-through-the-UI works and shows "Never sent", schedules tab shows real days
and times and an honest "Has not run yet". No console errors, no horizontal scroll.

Also refuses to delete the last active message — an empty pool means every schedule fires and
silently sends nothing, which is indistinguishable from the feature being broken.

### Remaining in Stage 4

- **§4.5 streaks, badges, auto-featuring** — four tables (`badges`, `user_badges`,
  `activity_streaks`, `feed_features`), extensible so a new badge type needs no migration,
  three initial badge types, idempotent computation, feed auto-featuring from real activity,
  and the full-month celebration state the brief calls "the single most visually rewarding
  moment in the app". Its own session.
- Then the Stage 4 gate, then Stage 5.

---

## STAGE 4 §4.5 — STREAKS, BADGES, AUTO-FEATURING (backend complete, 2026-07-31)

Four tables, all rollback-tested with no leaks. Seven badges seeded across three activities
(workout, meal logging, community engagement) at weekly and monthly tiers.

### Badges are data, not code

`criteria_type` names an evaluator and `criteria` carries its parameters as JSON. Adding a
14-day tier, a gold variant, or a fourth activity the streak engine already tracks is an
**INSERT**. Only a genuinely new *kind* of rule needs a branch in the evaluator.

Proven, not asserted: inserting a single `streak_test_3day` row — no migration, no deploy —
immediately awarded it to a member with a 3-day run.

The seeder ships two rule shapes to demonstrate the schema carries more than one:
`consecutive_days` and `active_days_in_month` (20 active days in a calendar month, not
necessarily consecutive).

Icons are Lucide names, never emoji, per the brief. The API asserts this.

Monthly tier is **28 days rather than 30**, so the milestone is a whole number of weeks and
lands on the weekday it started — "four straight weeks" is something a member can picture.

### Streaks are recomputed, never incremented

`StreakService` rebuilds every streak from the real activity tables (`fitness_logs`,
`food_log_entries`, `social_posts`/`post_comments`/`post_reactions`) on each run. An
incrementing counter drifts the moment a run is missed, a log is backfilled, or a job runs
twice — and it drifts *silently*. Rebuilding means the answer is always whatever the activity
data says.

A streak counts as live if it includes today **or yesterday**, so a member is not told their
streak broke merely because the job ran before they trained.

`longest_count` is never lowered by a rebuild: the lookback window is finite, so an older
personal best that falls outside it must not be erased.

### Idempotency is a database guarantee, not a check

`user_badges` is UNIQUE on (user_id, badge_id, period_start) and `feed_features` on
(user_id, feature_type, period_start). The awarder attempts the insert and treats the
constraint violation as "already earned". A check-then-insert would leave a race window, and
these jobs run on a schedule that can overlap.

`period_start` is part of the key rather than a detail, because a weekly badge is earned once
*per week* — the same badge in a later period is a new award, not a duplicate.

### Auto-featuring

Driven entirely by real activity via the scheduled job. **There is deliberately no admin
action to feature someone** — a feature that can be handed out by hand stops meaning
anything, and members work that out quickly.

7 consecutive active days surfaces a week card; 28 surfaces the month celebration. Only the
**highest tier** a member qualifies for is created, and the feed endpoint caps output at
**3 per load** — the difference between a feed that celebrates people and a feed made of
celebration cards. `expires_at` keeps it current without a cleanup job.

Members can dismiss their own feature; the endpoint returns 404 for anyone else, so no one
can remove someone else's moment.

### One real bug caught before it shipped

`schedule:list` showed `php artisan ProcessStreaks` instead of `streaks:process`. The `use`
import had not been added (a `sed` pattern that silently failed to match), so
`ProcessStreaks::class` resolved to a *global* class name and Laravel took it literally as a
command string. **The hourly task would have failed every hour, silently.** Caught by reading
`schedule:list` output rather than assuming registration worked.

### Verified

**Engine — 41/41.** Streak arithmetic (7 consecutive, streak ending yesterday still counts,
streak ending 2 days ago broken, gaps truncate the run, longest-window search, empty history);
streaks computed from genuinely logged activity across all four types; badges awarded for the
right activities only and *not* for activities with no data; period and streak recorded in
`meta`.

**Idempotency** — service run twice and three times awards nothing new; the full command run
twice leaves the count at 2 → 2 → 2; exactly one streak row per type per member; re-running
creates no duplicate feed feature.

**Thresholds** — 28-day member earns the month badge *and* the week badge, gets exactly one
feature (the month tier); a member with a gap at day 3 has `current_count` 3, keeps a
`longest_count` of 4, earns no week badge and gets no feature.

**API — 24/24.** `/api/streaks/me` reports a real 30-day streak, live flag, earned badges with
Lucide icon names, locked badges, and the month celebration with whole-week count; a member
below the threshold gets `celebration: null`; the public view shows badges but **does not leak
locked badges**; feed features return real day counts, capped at 3; dismiss is owner-only
(404 for others, verified the feature stayed live after the failed attempt).

Achievement state was reset afterwards and recomputed from the four real users' genuine
activity — they hold 0 badges and 0 features, which is accurate rather than seeded.

### ⚠️ Still open in §4.5 — the frontend

**Not built this session, deliberately.** The backend and API are complete and proven, so this
is purely additive:

- **Full-month celebration state on the member profile.** The brief calls this "the single
  most visually rewarding moment in the app". `/api/streaks/me` already returns
  `celebration: {type, days, weeks, since}` and only when the streak is genuinely live. This
  deserves real design attention, not a rushed pass.
- **Badge display on the profile** — earned and locked, both already in the API response.
- **Featured cards in the social feed** — `/api/streaks/feed-features` returns them capped at
  3 with real day counts; they must read as visually distinct from normal posts without
  dominating the feed.

**The Stage 4 gate cannot run until this frontend exists**, since the gate covers user-visible
behaviour.

---

## UI FIXES — select readability + tab-bar overlap (2026-07-31)

Two issues reported from live use, both reproduced and measured before changing anything.

### 1. Select fields and dropdown options unreadable in dark mode

**Two separate causes, both needed fixing:**

- `profile/page.tsx` hardcoded `bg-white border-gray-200` on two `<select>` elements and one
  `<textarea>`, with `text-content-primary` on top. In dark mode that is
  `rgb(250,250,249)` text on `rgb(255,255,255)` — invisible. It only ever worked in light
  mode by coincidence.
- **No `<option>` styling existed anywhere in the app.** The dropdown popup is drawn by the
  operating system with a white background, and an `<option>` inherits the select's colour,
  so near-white text landed on a white popup and appeared only under the OS hover highlight —
  exactly what the screenshots showed. Options carry `background-color: rgba(0,0,0,0)` by
  default, so styling the `<select>` alone cannot fix this.

Fixed with token-based classes on the three controls, plus a global rule in `globals.css`
covering `select`, `select option`, and `select option[value='']` (placeholder tone). The
global rule means this cannot recur in the other 11 files that use `<select>`.

Measured after: dark mode select luminance gap **246**, option gap **225**, option background
now opaque `rgb(26,24,23)`. Light mode 218 / 229. Verified in both themes.

### 2. Content hidden behind the bottom tab bar — app-wide, not just Profile

Reported as "won't scroll at 375px". The page **did** scroll; the problem was that at maximum
scroll the last element still sat underneath the fixed tab bar, so there was nothing left to
scroll and the content stayed unreachable.

**Root cause:** `cn()` is tailwind-merge. In `AppShell`, the tab-bar clearance class
`pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)]` was listed *before*
`py-4 md:py-6`. tailwind-merge treats the later `py-*` as overriding the earlier `pb-*` and
**silently dropped it**. Every non-fullWidth page rendered with `padding-bottom: 16px`
against a **57px** tab bar, so the bottom ~41px of every page was covered.

Fixed by moving the clearance class after `py-*` (and raising the buffer to 1.5rem). Verified
`main` padding-bottom is now **80px vs a 57px bar** on /profile, /dashboard, /food-journal,
/fitness, /social, /recipes, /calendar, /settings, /notifications and /messages — 11/11.

### Two false leads worth recording

- I first blamed `body { overflow-x: hidden }` (which does coerce `overflow-y` to `auto`).
  Toggling it live proved it was **not** the cause — the page still did not scroll with
  `overflow-x: visible`. The rule was left alone.
- My initial measurement reported "cannot scroll at all" because `html { scroll-behavior:
  smooth }` makes `window.scrollTo` asynchronous and I read `scrollY` synchronously. The page
  scrolled fine; the test was wrong. Re-measured with `behavior: 'instant'` and a real mouse
  wheel.

Also confirmed a suspected third bug was **not** real: the profile avatar rendering as "?"
with no name only happened in the test harness, which set a bare `auth_user` key. The store
persists under `auth-storage` via zustand/persist; with the correct key the page renders the
name, email and status correctly.

### Audit note — not changed, flagged

`bg-white` appears 212 times, but ~130 are translucent overlays (`bg-white/10`, `bg-white/5`)
which are correct on dark surfaces, and most of the 55 opaque ones are toggle knobs and dots
where white is intended. Only the three profile form controls were genuinely broken. Remaining
`text-gray-*` (97) and `border-gray-*` (40) usages were left alone — several already carry
`dark:` variants — but they are a latent inconsistency worth a dedicated pass.

---

## STAGE 4 §4.5 FRONTEND + /social EMOJI SWEEP (complete, 2026-07-31)

### /social emoji — judgment call, reversible

Swept the **UI chrome** to Lucide: the `✨ For You` / `👥 Following` tabs are now
`Sparkles` / `Users` icons with text labels and proper `role="tablist"` semantics, and the
composer placeholder lost its decorative 💪.

**Deliberately kept the six reaction emoji** (`👍 ❤️ 🔥 😍 💪 🎉`). They are user *content*,
not chrome — `post_reactions.reaction` is a stored varchar, they are the product's reaction
vocabulary (PeepSo-style per the frontend brief), and converting them would break existing
rows and change a feature. The §1.5 "no emoji as UI" rule targets furniture. Reverse this if
the client disagrees; it is a two-line change plus a data migration.

Remaining emoji elsewhere are the `EmojiPicker` (134 — that is its entire purpose) and admin
email templates, which are message bodies rather than interface.

### §4.5 frontend

- **`StreakCelebration`** — the full-month state. A canvas ring that draws one segment per
  completed week, so the segment count *encodes* the achievement rather than decorating it;
  accent-on-dark, the only inverted surface in the app, so it reads as a different kind of
  moment without inventing a palette; ease-out draw that respects
  `prefers-reduced-motion`. Not dismissible — it disappears the day the streak breaks, which
  is the honest behaviour. Every number comes from the API, which returns the object only
  while the streak is genuinely live.
- **`BadgeGrid` + `StreakRow`** — earned badges with metal-toned tier colours kept distinct
  from the brand accent (a gold badge must not read as "selected"), locked badges showing the
  real requirement from the badge definition, and a personal best shown only when it beats the
  live streak rather than printing the same number twice.
- **`FeaturedMemberCard`** — accent-bordered, shorter than a post so it cannot dominate the
  feed, month tier visually stronger than week. Dismiss control renders only for the featured
  member (the API enforces this independently).
- **`AchievementsPanel`** — fails quiet: achievements are an enhancement, so a failed request
  hides the panel rather than pushing an error into someone's profile.

Wired above the form on the Profile tab (a month-long streak is the most significant thing on
that screen) and above the posts in the social feed.

**Verified in-browser 34/34** at 375px in dark *and* light, plus 1280px. Includes reading the
canvas back: **2736 painted pixels**, so the ring genuinely renders rather than being an empty
element. Real data throughout — a seeded 30-day workout streak produced "4 straight weeks",
3 badges and 1 feed feature.

---

## ✅ STAGE 4 GATE — PASSED (2026-07-31)

```
php artisan migrate:status      0 pending (all Ran)
php -l  (42 Stage 4 files)      0 with errors
php artisan test                2 tests, 2 passed, 2 assertions
php artisan route:list --json   routes OK — 163 routes
npx tsc --noEmit                zero errors
npm run build                   Compiled successfully — 69 pages
```

**`php artisan test` caveat, stated explicitly as the brief requires:** the only tests in the
repo are Laravel's two scaffold `ExampleTest.php` files. They pass but assert nothing about
this application. **All real verification in Stage 4 was done through the standalone proof
scripts and browser runs below, not through the PHPUnit suite.** Converting those scripts into
a committed test suite is the single highest-value follow-up.

### Functional suite — 198 assertions, 0 failures

```
prove-gate             PASS=26   FAIL=0     subscription gating middleware
prove-lifecycle        PASS=39   FAIL=0     account states, deletion, audit trail
prove-coupons          PASS=55   FAIL=0     discount validation, Stripe codes, admin CRUD
prove-motivational     PASS=37   FAIL=0     rotation, scheduling, delivery
prove-streaks          PASS=41   FAIL=0     streaks, badges, idempotency, featuring
────────────────────────────────────
TOTAL                  PASS=198  FAIL=0
api-streaks            PASS=24   FAIL=0     achievements + feed-feature endpoints
browser §4.5           PASS=34   FAIL=0     celebration, badges, feed cards, both themes
```

Two assertions that had been failing were **bugs in the test scripts, not the code**, both
previously diagnosed and separately re-verified: a signed Carbon `diffInDays` read `-14` as
wrong when the magnitude was right, and `sliding(2)` preserves original keys so `$p[0]` was
undefined past the first window. Both fixed so the suite is genuinely green — a permanently
red assertion trains people to ignore failures.

### Scheduler and queue

```
0 0 * * *   php artisan trials:process
* * * * *   php artisan notifications:motivational
0 * * * *   php artisan streaks:process
queue:health                    Queue is healthy
```

**Stage 4 (Phase 8) is complete:** §4.0 queue reality, §4.1 Stripe subscriptions,
§4.2 account lifecycle, §4.3 coupon funnel, §4.4 motivational notifications,
§4.5 streaks/badges/auto-featuring — backend, frontend and admin surfaces.

---

## STAGE 5 §5.1 — VIBE THREAD (complete, 2026-07-31)

Two tables (rollback-tested), `VibeThreadController`, and `/vibe-thread` in the Community nav.

### Decisions worth knowing

- **`is_admin_post` is denormalised at write time**, not joined on read. A member later granted
  or stripped of admin must not have their past messages retroactively restyled as team
  announcements. Proven: promoting the author left the old message unflagged.
- **Soft deletes.** A removed message leaves a reviewable gap rather than vanishing, which
  matters for moderation.
- **Admins can delete any message but cannot edit anyone's words.** Moderation is removal, not
  rewriting — an admin silently editing a member's message is indistinguishable from
  impersonation.
- **Mute stops pings only.** There is deliberately no "hide" flag in the schema to be tempted
  by, because the brief requires the thread stay readable. `muted_until` NULL is indefinite; a
  timestamp lapses on its own so timed mutes need no cleanup job.
- **Polling at 5s, not the 3s used by private messaging — judgment call, reversible.** Private
  messaging polls one conversation between two people; this is a single channel every online
  member watches simultaneously, so the same cadence multiplies by the whole active user base.
  Change `POLL_MS` in `app/vibe-thread/page.tsx` to revert. Uses the same `since` cursor and
  `Set`-based dedup guard as the existing messages screen, as the brief requires.
- **No websockets.** Polling matches the existing pattern and adds no infrastructure; the brief
  asked for justification only if websockets were chosen.
- Posting throttled to 20/min, editing to 30/min.

### Verified — 37 API assertions + 18 browser assertions, 0 failures

API: posting, admin flagging and the promotion case, validation (empty, over-length, bad
reply target), replies carrying quoted context, the `since` cursor returning nothing when
caught up and exactly the new message otherwise, ownership rules across edit and delete for
member/other/admin, soft-delete leaving the message reviewable but out of the thread, mute
semantics including a lapsed timed mute, and rate limiting (**18 created, 8 throttled** on a
26-message flood).

Browser at 375px, dark and light: real messages render, admin post carries the "Team" marker
and is **measurably distinct** (border `rgb(248,116,4)` vs `rgb(250,250,249)`), composer
present, posting through the UI works, muting leaves the thread fully readable, no horizontal
scroll, no console errors.

---

## STAGE 5 §5.6 — NAMES, NICKNAMES, ALIASES (complete, 2026-07-31)

`users.nickname` + `users.alternate_names` (JSON), projected into an indexed
`user_name_aliases` table. Both migrations rollback-tested.

**The JSON column is never searched.** It is the editable source of truth a member manages;
`user_name_aliases` is the flat, indexed projection every lookup uses. Searching JSON directly
would mean a full scan on every keystroke.

**Kept in sync by a model event in `AppServiceProvider`, not at call sites.** An alias cannot
be written without the index updating — including from tinker, seeders and admin tooling.
The projection is rebuilt wholesale rather than diffed, so a removed entry cannot leave a
stale row behind.

`User::scopeSearchByAnyName()` is one query across display name, username, nickname and the
alias table. `SocialFollowController@search` now uses it.

### Bug fixed while wiring this up

The previous inline search interpolated the term straight into a `LIKE` without escaping, so
typing a bare `%` matched **every member on the platform**. The scope escapes `%` and `_`.
Verified: `%` now returns **0 hits of 6 members** through the live API, where before it would
have dumped the entire member list.

### Verified — 25 assertions, 0 failures

A member who married, changed name and goes by a nickname is findable by **all five** of:
current surname, username, nickname, maiden name, previous name — all resolving to one
profile. Editing removes the old alias from search and adds the new one with no stale rows;
clearing the fields empties the projection. Bare-string entries are accepted as `alternate`,
typed entries keep their type, blank and malformed entries are skipped. Wildcard injection
blocked in both the scope and through the live API.

---

## 🔷 RESUME POINT — Stage 5, sections 5.2 / 5.3 / 5.4 / 5.5 / 5.7

Stage 4 is complete and gate-passed. Stage 5 is **2 of 7 sections done** (§5.1, §5.6).

Remaining, in the order I would take them:

- **§5.5 Message search + filtering** — FULLTEXT index on `messages.body`, `MATCH…AGAINST`,
  date-range filters (30/90/365/custom), 300ms debounce, results scoped server-side to
  conversations the requester actually participates in. Smallest remaining section; the
  wildcard-escaping fix from §5.6 applies here too.
- **§5.3 Resources library** — `resource_categories`, `resources`, `resource_views`. Strict
  MIME allowlist and size cap, and **files served through an authenticated controller route,
  never a public directory** — a resource must not be reachable by guessing a path. Reuse the
  recipe/video library patterns.
- **§5.7 Notification personalisation** — `pinned_members`, plus an owner accent token
  (`--owner-accent`) that must be distinct from every section and semantic colour and pass
  contrast in both themes. Styling only; sort order unchanged.
- **§5.2 Vibe Call** — extend the existing Phase 7 `live_sessions` (add `is_vibe_call`,
  `schedule_id`), add `vibe_call_schedules`, and a command that materialises upcoming sessions
  onto the existing `calendar_events`. Explicitly do **not** build a parallel live system.
- **§5.4 i18n** — largest by far. Extract every hardcoded string to `src/locales/{en,es,fr}.json`,
  extend the existing `i18nStore` rather than installing a framework, localise dates/numbers
  via `Intl`, and replace the flag **emoji** in `i18nStore` with labels or SVG (they are UI,
  not user content). Adding a language later must need only a new file.

---

## CLIENT DECISIONS — CONFIRMED 2026-07-31

1. **Trial length stays 30 days.** Not to change without explicit client sign-off. The brief's
   "default 14" is superseded. Configurability remains built and clamped.
2. **Reaction emoji stay as content.** Stored varchar + migration cost is not worth a cosmetic
   change. §1.5 continues to apply to UI chrome only.
3. **Vibe Thread polling stays at 5s.** Confirmed correct for a channel every online member
   watches simultaneously.
4. **Web push stays out of scope.** In-app notifications only, documented.

## 📌 POST-STAGE-7 CLEANUP BACKLOG

- **Convert the standalone proof scripts into a committed PHPUnit suite.** All real
  verification (258+ assertions across `prove-*.php` in the session scratchpad) currently lives
  *outside* the repo; `php artisan test` only runs Laravel's two scaffold `ExampleTest.php`
  files. Right call long-term, deliberately deferred — right call, wrong time. Do this after
  Stage 7, before launch.
- **`text-gray-*` (97) and `border-gray-*` (40) sweep.** Several already carry `dark:` variants;
  the rest are a latent theme inconsistency rather than a live bug.

---

## STAGE 5 §5.5 — MESSAGE SEARCH AND FILTERING (complete, 2026-07-31)

FULLTEXT index on `messages.content`, `MessageSearchController`, and `/messages/search` with a
300ms debounce, reachable from the inbox header.

**Schema note:** the brief names the column `messages.body`; it is actually `messages.content`
on this schema. Indexed the real column rather than renaming, since the name is referenced
across the existing messaging controllers and frontend. The migration is guarded so re-running
is a no-op, and rollback drops the index cleanly (verified both directions).

### Scoping is the security-critical part

Results are restricted to conversations the caller actually participates in, enforced by a
**join** against `conversation_participants` rather than a filter applied afterwards — there is
no window in which another member's messages are even selected. A client-supplied conversation
id is never trusted.

Proven directly: a member searching a term that appears in *someone else's* conversation gets
her own matches and **not** theirs, and a third member searching for content from a
conversation she is not in gets 0 results.

### Match mode, and why there are two

`MATCH … AGAINST` in BOOLEAN MODE is the indexed path, with each word required and prefix-
matched. But MySQL's default `innodb_ft_min_token_size` is **3**, so a shorter term returns
nothing at all from the index. Rather than showing "no results" for a word the member can see
on screen, terms with any word under 4 characters fall back to an escaped `LIKE`, and the
response reports `meta.match_mode` so the behaviour is visible rather than hidden.

The `LIKE` path escapes `%` and `_` — the same class of bug fixed in §5.6. Unescaped, a single
`%` would have returned every message the member had ever sent or received.

### Verified — 28 assertions, 0 failures

Scoping (3 assertions, including cross-member leak attempts), fulltext vs substring mode
selection, snippet generation, sender/counterpart resolution, wildcard injection blocked in
both forms, all four date ranges (30/90/365/custom) filtering correctly, `to`-before-`from`
rejected 422, term-too-short and missing-term rejected 422, pagination (20 per page, 25 results
→ 2 pages, 5 on page 2), and unauthenticated access rejected 401.

**One test-harness bug found and fixed:** `Message::$fillable` excludes `created_at`, so
messages I intended to backdate were all stamped `now()` and every date-range assertion was
measuring nothing. The filter was correct; the fixture was not. Backdating now goes through the
query builder.

### Frontend

Debounced at 300ms as specified. A monotonic request counter discards responses from a
superseded search, so a slow earlier query cannot overwrite a newer one's results — the classic
search race. Range chips for any-time/30/90/365/custom, with date inputs appearing only for
custom. Results link straight into the conversation.

---

## STAGE 5 §5.7 — NOTIFICATION PERSONALISATION (backend complete, 2026-07-31)

`pinned_members` (rollback-tested) plus pin/unpin and owner-accent flags on the notifications
endpoint.

**Sort order is never touched.** Both the pin highlight and the owner accent set flags the UI
styles on; neither reorders the feed. A highlight that jumped to the top would quietly bury
everyone else's activity, which is not what the brief asks for — and it is now asserted, not
just intended: the feed order is byte-identical before and after pinning.

**Owner accent needs no pin.** Admin activity is flagged for *every* member automatically via
`is_owner_actor`, exactly as specified.

The `--owner-accent` token already existed and is correct: **#7C3AED** light / **#A78BFA** dark.
Verified rather than assumed —

```
LIGHT owner accent on surface-raised    5.70  AA ✓
LIGHT owner accent on surface-base      5.46  AA ✓
DARK  owner accent on surface-raised    6.50  AA ✓
DARK  owner accent on surface-base      7.53  AA ✓
```

RGB distance from every other accent (brand orange 270, brand red 273, brand blue 138,
success 199, error 220, warning 302) — comfortably distinct from all of them.

**Actor resolution caveat:** notifications store `actor_name`, not an id, so highlighting reads
`data.actor_id` where present and falls back to no highlight otherwise. Guessing from a display
name would mis-highlight anyone sharing a name. Notification producers that want highlighting
must include `actor_id` in `data` — the motivational sender has no actor, which is correct.

### Verified — 19 assertions, 0 failures

Owner activity flagged without a pin, non-owner not flagged, owner not auto-pinned, **feed
order unchanged by both mechanisms**, pin/unpin toggle, pins private per member, cannot pin
yourself or a non-existent member, duplicate pin blocked by the database, unauthenticated
rejected.

### NOT done in §5.7

**Frontend styling not applied.** The API returns `is_pinned_actor` / `is_owner_actor` and the
token exists and passes contrast, but `/notifications` does not yet render them differently, and
there is no pin control in the UI. Purely additive — next session.

---

## STAGE 5 §5.3 — RESOURCES LIBRARY (backend complete, 2026-07-31)

Three tables (rollback-tested), a private filesystem disk, member-facing
`ResourceController` and admin `ResourceAdminController`.

### Files are genuinely unreachable without auth

A new `resources` disk at `storage/app/resources` with **no `url` key and private
visibility** — `storage:link` does not expose it, so there is no web path to guess. Every read
goes through `stream()` or `download()`, which check authentication *and* publication before
touching the disk.

Proven, not asserted:

```
guessing the path over HTTP fails        HTTP 403
unauthenticated stream rejected          HTTP 401
unauthenticated download rejected        HTTP 401
unpublished show returns 404, not 403    HTTP 404
no file path exposed anywhere in payload checked for pdf/74946d6d-….pdf
```

404 rather than 403 for unpublished resources is deliberate: 403 confirms the row exists.

### Uploads validated on three axes, not one

Declared MIME **and** real extension **and** size. Checking MIME alone is not enough — it is
client-supplied on the request and trivially spoofed. Both directions are covered:

- a **real PDF renamed `payload.php`** → rejected on extension
- a **text file renamed `fake.pdf`** → rejected on MIME (`detected text/plain`)

Stored filenames are UUIDs, so a crafted original name cannot traverse directories or collide.
`X-Content-Type-Options: nosniff` is set on every response so a browser cannot re-interpret a
file as something executable.

Caps: PDF 25 MB, video 500 MB, extensions `pdf` / `mp4,webm,mov`. All surfaced to the admin UI
through `meta.limits` rather than hardcoded in the frontend.

### Other decisions

- **Category delete is refused when it holds resources** — the FK is RESTRICT and silently
  orphaning content is worse than refusing. It deactivates and says so.
- **File deleted after the row**, so a failed row delete never leaves a resource pointing at a
  file that is already gone.
- **Counters use atomic `increment()`**, and `resource_views` is the auditable record behind
  them — "who actually opened this?" is answerable rather than inferred.
- Search escapes `%`/`_`, the same class of bug fixed in §5.5 and §5.6.

### Verified — 41 assertions, 0 failures

Admin-only management (non-admin 403), all three upload rejections with useful messages, valid
upload stored privately with size/MIME recorded, the five security properties above, streaming
returning **byte-identical** content to what was uploaded, inline vs attachment disposition,
view/download counters and per-member logging, unpublished invisible in show/stream/listing,
no path leakage, wildcard search blocked, type filtering, category counts, RESTRICT behaviour,
and file removal on delete.

### NOT done in §5.3

**No frontend.** The API is complete and proven; there is no `/resources` browse page and no
admin management screen yet. Additive.

---

## 🔷 RESUME POINT (updated 2026-07-31, end of run)

Stage 4 complete and gate-passed. **Stage 5 is 5 of 7 sections done.**

Combined functional suite: **345 assertions, 0 failures** across 10 proof scripts. Migrations
0 pending, tsc zero errors, `npm run build` succeeds, no test residue in the database or on
the resources disk.

### Done
§5.1 Vibe Thread · §5.5 message search · §5.6 names/aliases · §5.3 resources (backend) ·
§5.7 notification personalisation (backend)

### Remaining, in order

1. **§5.2 Vibe Call** — extend the existing Phase 7 `live_sessions` with `is_vibe_call` and
   `schedule_id`; add `vibe_call_schedules`; a scheduled command materialises upcoming sessions
   onto the existing `calendar_events`. **Do not build a parallel live system** — reuse the
   existing viewing, commenting and replay.
2. **§5.4 i18n** — largest remaining. Extract every hardcoded string to
   `src/locales/{en,es,fr}.json`, **extend the existing `i18nStore`** rather than installing a
   framework, localise dates/numbers via `Intl`, and replace the flag **emoji** in `i18nStore`
   with labels or SVG (they are UI, not user content). Adding a language later must need only
   a new file.
3. **§5.3 frontend** — `/resources` browse with category and type filters, PDF/video viewing
   via the authenticated stream endpoint, and an admin management screen. The API returns
   `meta.limits` so upload caps come from the server, not hardcoded.
4. **§5.7 frontend + actor_id backfill** — style `is_pinned_actor` / `is_owner_actor` using the
   confirmed `--owner-accent` (#7C3AED / #A78BFA), add a pin control, and **backfill `actor_id`
   into notification `data` across the social controllers** so highlighting actually resolves.
   Client confirmed both of these land as one coherent pass.

---

## STAGE 5 §5.2 — VIBE CALL (backend complete, 2026-08-01)

`vibe_call_schedules` plus `is_vibe_call` / `schedule_id` on the **existing** `live_sessions`,
a generator service, an hourly command, and admin CRUD.

**No parallel live system**, as the brief requires. Generated sessions are ordinary
`live_sessions` rows, so Phase 7 viewing, commenting and replay work unchanged — proven by
fetching a generated call through the existing `/api/live/{id}` endpoint and getting the same
record back.

### Platform calendar — a judgment call, documented and reversible

`calendar_events` was strictly per-member, but a Vibe Call must appear for everyone. Two
options: one row per member per session (scales as members × sessions, and leaves orphans
whenever anyone joins or leaves), or `user_id` NULL meaning "everyone".

**Chose NULL.** One row per session regardless of headcount, and a new member sees the
existing schedule immediately with no backfill. `CalendarController@events` widened to
`user_id = me OR user_id IS NULL` via a `visibleTo()` scope; the write paths were left alone
because `$event->user_id !== $userId` already rejects platform events — verified that a member
gets **403 on both edit and delete**. The `type` enum gained `'live'` rather than overloading
`'other'`.

Reverse by writing per-member rows in `VibeCallGenerator` and narrowing the scope back.

### Timezone handling

Occurrences are built in the schedule's own timezone then converted to UTC, so DST is handled
by the conversion rather than arithmetic on a stored offset. Proven: a 09:00 `Asia/Tokyo`
schedule stores **00:00 UTC**, which reads back as 09:00 Tokyo.

### Idempotency

Keyed on `(schedule_id, scheduled_at)`, not on the `last_generated_through` cursor alone — a
cursor by itself would silently skip occurrences if the rule or window changed. Running the
generator twice more created **0 extra sessions and 0 extra calendar events**.

Editing a schedule prunes and regenerates **future** sessions only; a call that already
happened is history and is left alone. Stopping a schedule deactivates it, removes upcoming
calls and keeps past ones.

### ⚠️ Same silent-scheduler bug caught again

`schedule:list` showed `php artisan GenerateVibeCalls` instead of `vibe-calls:generate` — the
`use` import had not landed, so `GenerateVibeCalls::class` resolved to a global name Laravel
took literally as a command string. **Identical to the `ProcessStreaks` bug in §4.5**, and
caught the same way: by reading `schedule:list` rather than assuming registration worked. Both
times the cause was a scripted edit silently failing to match.

**Lesson worth keeping: after registering any scheduled command, run `schedule:list` and read
the actual command string.** A wrong one fails silently, forever.

### Also fixed: a half-applied migration

The calendar migration failed partway on a pre-existing `calendar_events_user_id_date_index`,
*after* the column change had already been applied — leaving it marked Pending but partly
done. Rewritten so every step is individually guarded and safe to re-run from that state.

### Verified — 40 assertions, 0 failures

Admin-only access, schedule creation with normalised days, sessions generated into
`live_sessions` with correct flags and window, the existing live endpoint serving them,
one platform-wide calendar event per session visible to **two different members**, members
blocked from editing or deleting them, idempotent regeneration, dry-run writing nothing,
timezone correctness, edit-reschedules-future-only, stop-keeps-history, and four validation
rejections (day 0, day 8, bad timezone, zero duration).

### NOT done in §5.2

**No frontend.** No admin screen for schedules, and Vibe Calls are not visually distinguished
from ordinary live sessions in the member UI. The calendar shows them already, since it reads
the same endpoint.

---

## ⚠️ OPERATIONAL FINDING — FULLTEXT index can fail silently (2026-08-01)

Caught during a regression sweep, and worth reading before launch.

MySQL had shut down uncleanly between runs. After restarting it, `prove-msgsearch` dropped
from **28/28 to 15/28**. The cause was not the code:

```
BOOLEAN MODE +resistance*  -> 0 rows
BOOLEAN MODE +resistance   -> 0 rows
NATURAL LANGUAGE           -> 0 rows
plain LIKE                 -> 1 rows
```

The index still *existed* — `SHOW INDEX` reported it present — but matched nothing. An unclean
shutdown had left InnoDB's FULLTEXT auxiliary tables inconsistent. **No error is raised.** Every
search simply returns "no results" for words the member can read on screen.

Rebuilding the index fixed it immediately (drop + re-add).

### Hardened so this cannot silently lie again

`MessageSearchController` now handles both failure modes:

1. **Stale index** (exists, matches nothing) — an empty fulltext result is retried through the
   substring path. If that finds matches, it logs a warning naming the index as suspect and
   serves the correct results.
2. **Missing index** (dropped) — `MATCH` *throws* rather than returning zero, which surfaced as
   a 500. Now caught and degraded.

`meta.match_mode` reports which path ran, so degradation is visible rather than hidden.

**Verified by deliberately breaking it** (`prove-ftfallback.php`, 8 assertions): with the index
dropped, search still returns **HTTP 200, still finds the message, and reports
`match_mode: substring`**. The index is restored in a `finally` block so a failure partway
through cannot leave the database worse off.

### For production

Add a post-restart check, or an occasional `OPTIMIZE TABLE messages` with
`innodb_optimize_fulltext_only=ON`. The app now degrades safely, but a stale index means every
search is doing a full table scan — correct, and slower than it should be.

### Also fixed this run

`prove-gate` was reporting 0 assertions because it targets `127.0.0.1:8000` while the dev server
had been started on `--host=localhost`, which resolves to `::1` on Windows. Serving on
`0.0.0.0` makes both work. Worth knowing when a suite silently produces no output.

## FULL SUITE — 393 assertions, 0 failures

```
prove-gate           26     prove-names          23
prove-lifecycle      39     prove-msgsearch      28
prove-coupons        55     prove-ftfallback      8
prove-motivational   37     prove-pinned         18
prove-streaks        41     prove-resources      41
prove-vibe           37     prove-vibecall       40
```

Migrations 0 pending · routes OK · all 4 scheduled commands resolve to real signatures ·
`tsc` zero errors · `npm run build` succeeds · no test residue.

---

## STAGE 5 §5.4 — i18n (infrastructure complete, extraction NOT complete, 2026-08-01)

### Done and proven — 27 assertions, 0 failures

- **`src/locales/{en,es,fr}.json`**, lifted out of the store *programmatically* so the existing
  Spanish and French work was preserved exactly rather than retyped. All three files carry the
  same 28 keys, verified complete against English with no empty values.
- **`i18nStore` extended, not replaced**, as the brief requires. It now imports the JSON, holds
  no inline map, and exposes `translate()`, `missingKeys()`, `intlTag()` and `humanizeKey()`.
- **A raw key can no longer reach the screen.** Resolution is locale → English → *humanised
  key*: an untranslated `nav.someNewThing` renders as **"Some New Thing"**, never
  `nav.someNewThing`. Asserted, including that no fallback output contains a dot.
- **Adding a language needs only a file.** Proven by writing a `de.json` with a single key: it
  resolved, everything else fell back to English, and no raw key appeared. File removed after.
- **Flag emoji removed** (§1.5). The picker now shows a region code plus the endonym, with
  `lang` and `aria-label`. Flags render inconsistently across platforms, are missing on some
  Windows builds, and equate a language with one country.
- **`src/lib/format.ts`** — dates, times, numbers, currency, relative time and units, all via
  `Intl`, with cached formatters. Verified they genuinely differ per locale:

```
dates      1 August 2026 | 1 de agosto de 2026 | 1 août 2026
numbers    1,234.5  vs  1 234,5
relative   3 days ago  vs  il y a 3 jours
```

  `Intl.RelativeTimeFormat` matters specifically because hand-rolled "3d ago" strings cannot be
  translated at all — plural rules differ per language.
- `setLocale` also sets `document.documentElement.lang`, which screen readers and browser
  hyphenation both read.

### ⚠️ NOT done — string extraction, and the real number

The brief asks for **every** hardcoded UI string extracted. Measured rather than estimated:

```
.tsx files scanned:            119
files with user-facing text:    82
JSX text nodes (approx):       708
user-facing attributes:        228
────────────────────────────────────
total user-facing strings:     936
already extracted:              28
REMAINING:                   ~908
```

Heaviest files: `app/page.tsx` (94), `design-system` (66), `admin/videos` (34),
`admin/notifications` (30), `fitness/goals` (27).

This is a mechanical but genuinely large pass — roughly 82 files — and doing it partially
without care risks breaking pages. **The infrastructure is complete and proven, so extraction
is now purely additive: add keys to the three JSON files and swap literals for `t('…')`.**
Nothing else needs to change.

A helper for tracking progress exists: `missingKeys(locale)` returns English keys absent from a
locale, so translation gaps are measurable rather than guessed at.

Recommended order: `app/page.tsx` (landing, highest visibility) → nav and shell → dashboard →
the rest. `design-system/page.tsx` can be skipped — it is an internal reference page.

---

## STAGE 5 §5.7 — COMPLETE (frontend + the finding behind it, 2026-08-01)

### ⚠️ Social notifications did not exist at all

Before wiring the pin UI I checked what produces notifications. There were exactly **two**
writers — `LiveController` and `MotivationalNotifier` — both platform-generated with no member
actor. **Nothing created a notification when someone reacted, commented or followed.**

That made the whole §5.7 feature inert: pinning and the owner accent both resolve on
`data.actor_id`, and no notification carried one. Building the UI on top would have produced a
pin button that visibly did nothing.

So the "actor_id backfill" turned out to be a bigger gap than expected: not adding a field to
existing notifications, but **creating the notifications in the first place**.

`SocialNotifier` now handles reactions, comments and follows from one place, every row carrying
`actor_id`. Two rules built in:

- **No self-notification** — reacting to your own post is common, and notifying yourself reads
  as a bug. Asserted: 3 → 3.
- **Only new reactions notify** — removing or swapping one sends nothing, or a single change of
  mind would spam the author. Asserted: 1 → 1.

### Frontend

Notifications now render a left accent rail: `--owner-accent` violet for staff activity, brand
accent for pinned members, with "Team Extreme" and "Pinned" labels. **Owner wins over pin**, so
the platform voice reads consistently for everyone. Sort order untouched.

Pin control added to member profiles beside Follow/Message, with the existing pin state loaded
on mount so the button does not start out lying about itself.

### Verified — 19 assertions, 0 failures

Real HTTP actions through the API: reaction/comment/follow each create a notification carrying
the correct `actor_id`; no self-notification; un-reacting is silent; pinning highlights **3
notifications** and leaves the order **byte-identical**; admin activity is flagged owner without
any pin.

## FULL SUITE — 438 assertions, 0 failures

```
prove-gate           26    prove-msgsearch      28
prove-lifecycle      39    prove-ftfallback      8
prove-coupons        55    prove-pinned         18
prove-motivational   37    prove-resources      41
prove-streaks        41    prove-vibecall       40
prove-vibe           37    prove-socialnotif    19
prove-names          23    prove-i18n           27
```

`tsc` zero errors · `npm run build` succeeds · 0 pending migrations · no test residue.

---

## STAGE 5 §5.3 + §5.2 FRONTENDS — COMPLETE (2026-08-01)

### §5.3 Resources library

`/resources` browse with search (300ms debounce), category and type filters, plus
`/resources/[resourceId]` viewer. Added to the Community nav.

**The authenticated-file detail that matters:** the file endpoints require an `Authorization`
header, which a browser will *not* attach to an `<iframe src>` or `<video src>` — those would
get a 401. So the file is fetched through the API client and converted to an object URL. That
is what makes a private file viewable inline without ever exposing a public path. Object URLs
are revoked on unmount; leaving them alive holds the whole file in memory for the tab's life.

Verified in-browser: `<object data="blob:http://localhost:3000/…">` with the stream returning
`200 application/pdf`, and **no private file path anywhere in the DOM**.

Mobile browsers frequently cannot render a PDF inline, so the `<object>` carries fallback
content offering the download that does work, rather than showing an empty frame.

### §5.2 Vibe Call admin

`/admin/vibe-calls` — create, edit and stop recurring schedules, with the **real generated
sessions** listed below (not a preview). Saving generates immediately so the calendar reflects
a change without waiting for the hourly job. Edit warns that only upcoming calls are
rescheduled; past ones are history.

### Bug found and fixed

**A 69-byte file displayed as "0 KB"** — the size formatter divided by 1024 and rounded, so
anything under half a kilobyte claimed to be empty. Now falls through to bytes:

```
69 bytes    -> "69 bytes"
500 bytes   -> "500 bytes"
2048 bytes  -> "2 KB"
5242880     -> "5.0 MB"
```

### A weak assertion that hid a real failure

My first pass asserted `objTag === null || objTag.startsWith('blob:')` — which **passes when
the element is missing entirely**. The viewer was showing a permanent spinner and the test said
PASS. Tightened to `objTag !== null && …`; the real cause was simply that 3.5s was not long
enough for the blob fetch. Worth remembering: an assertion with `null ||` in it usually is not
asserting anything.

Two other apparent failures were also the harness, confirmed by inspection rather than assumed:
a 1200ms wait too short for a 300ms debounce plus request (the empty state *was* rendering),
and my own `addInitScript` touching `localStorage` in the `blob:` context where it is null.

### Verified — 34 browser assertions, 0 failures

Both themes at 375px plus 1280px: real resource and category from the API, honest counts, no
fabricated view numbers on a fresh resource, no file path in the DOM, filtering to a type with
no matches shows a proper empty state and back again, viewer opens with a blob-served PDF,
download available, Vibe Call schedule shows real days/time/generation window with genuinely
generated upcoming calls, no horizontal scroll, no console errors.

## FULL SUITE — 472 assertions, 0 failures

```
backend    411    (13 proof scripts)
i18n        27
browser     34    (§5.3 + §5.2 UI)
```

`tsc` zero errors · `npm run build` succeeds · 0 pending migrations.

---

## §5.4 STRING EXTRACTION — STATUS (2026-08-01)

### Finding that changed the extraction order

The brief's suggested order started with `app/page.tsx` (the public marketing landing page,
94 strings, "highest visibility"). That is now deliberately **deprioritized**: the locale
switcher lives only in `/settings`, which requires authentication. An anonymous visitor
hitting `/` has no way to change language before registering, so translating the landing
page's marketing copy would currently be invisible to every user who could see it — 94
strings of effort for zero reachable behavior. It should be revisited once (a) a public
language switcher exists on the landing page, or (b) locale detection from `Accept-Language`
is added for anonymous visitors. Until then, authenticated in-app pages are higher value
because Settings' switcher actually reaches them.

`app/design-system/page.tsx` (66 strings) stays skipped — internal reference page, not
member-facing, per the original brief note.

### Done and live-verified this session

**Nav shell** — `MoreSheet.tsx`, `BottomTabBar.tsx`, `AppShell.tsx` now render `t(item.labelKey)`
wherever a `NavItem` carries one, falling back to the literal `label` otherwise. One real bug
caught before it shipped: the tab bar reuses shorter labels than the sidebar for the same
route (`/dashboard` → "Home" on the tab bar vs "Dashboard" in the sidebar; `/food-journal` →
"Food" vs "Food Journal"; `/social` → "Social" vs "Community"). The first pass had wired both
to the same translation key, which would have silently changed the English tab-bar copy the
moment translation was wired up — the tab bar would have started reading "Dashboard" /
"Food Journal" / "Community" even with locale still 'en'. Fixed by minting separate
`nav.tab.home` / `nav.tab.food` / `nav.tab.social` / `nav.tab.more` keys with the original
short copy, added to all three locale files. **Lesson: never point two different-length UI
labels at the same translation key just because they lead to the same route** — check the
English value actually matches before wiring, not after.

**`app/dashboard/page.tsx`** — full extraction, 43 new keys (`dashboard.*`) across
en/es/fr.json. Every static string replaced: greeting (3 time-of-day variants), all card
titles, empty states (title + description + action, 3 sections), macro/stat labels, water
counter (including a parameterised `{current} of {goal} glasses` aria-label and a
`{days}d left` trial badge), both toast error messages, and the admin quick-link tile labels.
Dynamic content (member names, post text, food entry names) is correctly left untouched —
only app-authored copy gets a key.

**Known follow-up, not fixed:** `dateStr` on the dashboard (`format(new Date(), 'EEEE, d MMMM')`
from `date-fns`) always renders in English regardless of locale — confirmed in the Spanish/French
screenshots ("Saturday, 1 August" shown under a fully-Spanish page). `date-fns/locale` isn't
wired to the i18n store. Two options for later: pass a `date-fns` locale object matching
`useI18nStore().locale`, or switch this call to the existing `formatDate()` in `lib/format.ts`
(already Intl-based and locale-aware) — the latter is preferable since it reuses infrastructure
already built and tested for exactly this. Any other page that formats a date with raw
`date-fns` `format()` (not `lib/format.ts`) will have the same gap — worth a grep
(`format(.*date-fns` usage sites) when extraction resumes.

### Live browser verification (54 new assertions, 0 failures — not yet in a committed proof script)

- **Nav i18n (24 assertions):** English baseline unchanged (tab bar still says "Home" / "Food"
  / "Social", sidebar still says "Dashboard" / "Food Journal" / "Community" — confirming the
  bug above was actually fixed, not just detected), Spanish tab bar + More sheet genuinely
  switch text, French sidebar genuinely switches text, admin section correctly stays English
  (no admin translations exist yet), no console errors. Mobile 375px + desktop 1280px.
- **Dashboard i18n (30 assertions):** all card headings, empty states, units, and the greeting
  correctly localise in Spanish and French with no leftover English headings, light + dark
  theme, no horizontal scroll, no console errors.

### Remaining scope (re-measured after this session's extraction)

`count-strings.mjs` (scratchpad) now reports **~869 strings across ~78 files** still to
extract (was ~908/82 before nav + dashboard). Heaviest real remaining files, in recommended
order — authenticated, member-facing pages first, admin pages last since admin labels are
already deliberately left untranslated in nav:

```
27  app/fitness/goals/page.tsx
25  app/recipes/create/page.tsx
22  app/profile/page.tsx
20  app/food-journal/page.tsx
19  app/recipes/page.tsx
19  app/social/[username]/UserProfilePageClient.tsx
...(skip) app/design-system/page.tsx (66) — internal reference page
...(deprioritized) app/page.tsx (94) — public, unreachable by the locale switcher today
34  app/admin/videos/page.tsx           ┐
30  app/admin/notifications/page.tsx    │ admin-only; lower priority, same
25  app/admin/live/page.tsx             │ reasoning as the Admin nav group
18  app/admin/api-keys/page.tsx         ┘ (left untranslated deliberately)
```

**Honest status: this is not close to done.** At the rate of one page per extraction pass
(new keys in 3 locale files + JSX swap + tsc + build + live browser verification in EN/ES/FR),
covering the remaining ~75 real member-facing files is multiple further sessions of work, not
something completable in one sitting. Infrastructure, the fallback chain, and the pattern are
now proven correct in a real authenticated page (dashboard) and in the shell nav — extending
it to each remaining file is mechanical repetition of that same proven pattern, not further
design work.

---

## §5.4 CONTINUED — CROSS-CUTTING HYDRATION BUG FOUND AND FIXED (2026-08-01)

### More files extracted, live-verified EN/ES/FR

- **`app/fitness/goals/page.tsx`** — 53 keys (`goals.*`). Category/difficulty/BMI-range/preset
  labels kept their canonical English values as data (sent to the API, used for filtering) with
  a separate `categoryLabel()`/key-lookup for display — same pattern as nav, so translating the
  UI never changes what gets stored or how filters match. 36 browser assertions, 0 failures.
- **`app/recipes/create/page.tsx`** — 53 keys (`recipeCreate.*`). Same canonical-value-vs-display
  split for category/difficulty/tags. 35 assertions, 0 failures, plus 3 pre-existing failures
  (see below — not caused by this work).
- **`app/profile/page.tsx`** — 68 keys (`profile.*`). Tabs, all four tab panels (Personal Info,
  Fitness Goals & Stats, Digital Billboard, Change Password), every toast. 32 assertions, 0
  failures (after the hydration fix below).

### Bug found: pre-existing horizontal overflow on `/recipes/create`, unrelated to i18n

The ingredient row (`flex-1` name input + `w-20` amount + `w-16` unit + delete button) is wider
than a 375px viewport regardless of language — confirmed by checking the offending element
(`w-16` unit input, right edge at 414px against a 375px client width) and confirming placeholder
text length has no effect on these fixed-width inputs. Pre-existing, not touched, not fixed here
— flagged for a separate pass.

### Bug found and fixed: a real hydration mismatch, not just a test artifact

`app/profile/page.tsx` genuinely failed in the browser — a production React error (#418,
"Hydration failed because the server rendered text didn't match the client") — for Spanish and
French locales only. Root-caused with a full non-minified trace (temporary `next dev` server)
rather than guessed at: the sidebar's `NavList` rendered `t('nav.dashboard')`, which the
**server** (building a statically prerendered page, no access to `localStorage`) evaluates
against the default `locale: 'en'` → "Dashboard" — while the **client's first hydration pass**
could already see the real persisted locale → "Panel", if `zustand`'s `persist` rehydration for
`i18nStore` completed before React's first paint. React detects the text mismatch, logs an
error, and silently regenerates the subtree — a real defect (a scary production error and a
visible flash of wrong-then-right text), not a false alarm.

This risk existed in *every* page using `t()` directly in initial render, including the ones
already marked "0 failures" this session (dashboard, goals, recipe-create) — they simply didn't
lose the race in testing. Relying on "didn't reproduce in this test run" would have been the
wrong lesson; the class of bug is real regardless of which specific page's test caught it.

**Root-cause fix, not a per-page patch:** `useLayoutStore` already solves this exact problem —
`{ skipHydration: true }` plus an explicit `useLayoutStore.persist.rehydrate()` call inside
`AppShell`'s mount effect, so the client's *first* render always starts at the same default the
server used, and only swaps to the persisted value after mount (a client-only re-render, which
hydration reconciliation never checks). `i18nStore` was missing this. Added the identical
`skipHydration: true` and an `useI18nStore.persist.rehydrate()` call right next to the existing
layout one in `AppShell.tsx` — one change, fixes every current and future `t()` call site, not
just the one the test happened to catch.

**A second instance of the same bug class, found by re-testing after the fix**: `dashboard/page.tsx`'s
greeting (`"Good morning"` etc.) is *seeded once* inside a `useEffect` that ran `t(...)` and
stored the result in state. That effect's dependency array was `[t]` — but `t` is a stable
function reference (it reads `locale` at call time, not closure time), so it never re-ran. Worse,
this effect is a *child* of `AppShell`'s mount effect, and **child effects fire before parent
effects** in React, so it captured `t()` *before* `AppShell`'s new rehydration call had even run
— permanently freezing the English greeting for the rest of the session regardless of locale.
Fixed by adding `locale` itself to the dependency array, so the effect re-fires once rehydration
completes. Audited every other file touched this session for the same `useState(t(...))` /
effect-seeded-from-`t()` pattern (`grep` for `useState(t(`) — none remaining; `profile.tsx`'s
billboard seed already used the safe literal-then-resync pattern from when it was written.

**Lesson for the remaining ~75 files**: any place that *seeds local state* from `t()` — not just
places that call `t()` directly in JSX — needs the state's effect to depend on `locale`, not on
`t`, or it will freeze at whatever locale happened to be resolved at the moment that effect first
ran. Direct `t()` calls in JSX render are safe on their own now that the store-level fix is in;
this only matters for `useState(t(...))` seeds and effects that store a translated string.

### Full re-verification after the fix

Reran every i18n browser suite from this session against the patched build: nav (24/24),
dashboard (30/30 — 2 were failing pre-fix), fitness goals (36/36), recipe-create (35/38 — the 3
failures are the pre-existing horizontal-scroll bug above, confirmed unrelated), profile (32/32
— was failing pre-fix with the hydration error), `prove-i18n.mjs` (27/27). **184 i18n-related
browser/unit assertions total this session, 0 failures attributable to i18n work.**

### `app/food-journal/page.tsx` — also extracted and live-verified (58 keys, `foodJournal.*`)

Date navigator ("Today"/"Yesterday"), calorie summary, macros (reused `dashboard.macro.*` —
values matched exactly), quick-log buttons, meal list with singular/plural item counts, food
search + empty states, water tracker (including two parameterised strings — remaining-ounces
and the add-amount button), the manage-meal-slots modal (including the `confirm()` dialog text),
and the food/photo picker modal. Reused `goals.modal.cancel` and `dashboard.action.add` for
generic "Cancel"/"Add" buttons rather than minting near-duplicate keys — establishing that as
the pattern going forward: check for an existing exact-match key before creating a new one.
30 browser assertions, 0 failures, EN/ES/FR, both the calorie card and the expanded meal/food
picker states.

Two more `uppercase`-class false positives caught in my own test (not app bugs) — same lesson
as the earlier "ACCOUNT" case: `text-transform: uppercase` changes what Playwright's `innerText`
returns, so a case-sensitive regex against the source-case string fails even though the app is
rendering correctly. Fixed with `/i` flags, not app changes.

### Remaining scope, re-measured

`count-strings.mjs` now reports **~544 strings across ~65 files** (908 at the start of §5.4,
869 after nav+dashboard, 789 after goals/recipe-create/profile). Heaviest real remaining files:
`app/recipes/page.tsx` (19), `app/social/[username]/UserProfilePageClient.tsx` (19),
`app/fitness/log-workout/page.tsx` (18), `app/calendar/page.tsx` (17),
`app/fitness/body-stats/page.tsx` (16), then continuing down. `app/admin/*` and
`app/page.tsx`/`app/design-system/page.tsx` remain deliberately last, for the reasons already
stated above.

### `app/recipes/page.tsx` — also extracted and live-verified (39 keys, `recipes.*`)

Reused `recipeCreate.category.*` / `recipeCreate.tag.*` / `recipeCreate.difficultyLevel.*` for
category pills, tag filters, and difficulty — all exact-value matches with the recipe-create
page, so a recipe's category/difficulty/tags now display identically translated wherever they
appear across the app, from one shared set of keys. New `recipes.day.*` (3-letter day
abbreviations) and a day/slot lookup pattern for the meal-plan picker, same canonical-value/
display-label split as everywhere else this session. 32 browser assertions, 0 failures.

### Full suite after this pass

```
i18n unit          27   (prove-i18n.mjs)
nav shell          24
dashboard          30
fitness goals      36
recipe-create      35   (3 pre-existing failures, unrelated — see horizontal-scroll bug above)
profile            32
food journal       30
recipes            32
```
**246 i18n-related browser/unit assertions, 0 failures attributable to i18n work.** `tsc` zero
errors, `npm run build` succeeds, server restarted on the fresh build before every verification
pass (required — `next start` reads its manifest once at boot).

### `app/social/[username]/UserProfilePageClient.tsx` — also extracted and live-verified (55 keys, `socialProfile.*`)

All five profile tabs (Stream, About, Friends, Followers, Groups), the create-group modal, the
pin/follow/message action row, and `timeAgo()` — converted from a module-level function to one
that takes `t` as a parameter, since it lives outside the component and has no hook access.
Standing rule respected: the six stored reaction emoji (👍❤️🔥😍💪🎉) are untouched — they are
content, not UI chrome, per the existing pinning/reactions constraint. 20 browser assertions,
17 passing — 3 failures are a **second instance of the pre-existing button-row overflow bug**
(Follow/Message/Pin/Share buttons, `flex gap-2` with fixed `px-4 py-2` padding, don't fit 375px
regardless of language — confirmed via the same offending-element check as the recipe-create
case, English included). Not caused by this work, not fixed here — now two data points
suggesting action-button rows are a systemic 375px gap worth a dedicated pass.

### Remaining scope, re-measured again

`count-strings.mjs` now reports **~413 strings across ~55 files**. Everything member-facing
above 15 strings is now done. Remaining heavy files are almost entirely `app/admin/*`
(videos 34, notifications 30, live 25, api-keys 18, coupon-offers 18, recipes 15, moderation 15)
plus the deliberately-deferred `app/page.tsx` (94) and `app/design-system/page.tsx` (66).

### MILESTONE: every member-facing page above 15 strings is extracted

Nav shell, dashboard, fitness goals, recipe-create, profile, food journal, recipes, and the
social user-profile page — 8 surfaces, 356 translation keys, all live-verified in EN/ES/FR at
375px in dark (and spot-checked light) with no leftover English and no console errors beyond
two pre-existing, unrelated layout bugs (documented above, not fixed — out of scope for a
string-extraction pass). What remains is almost entirely the admin panel, which:

- has no translated nav entries yet (the Admin nav group was deliberately left untranslated
  when the shell was wired, on the reasoning that admin is Kelvin-only and English-only today)
- is used by nobody who needs Spanish or French
- would need that nav decision revisited first, or the effort is invisible the same way the
  landing page's would have been

This mirrors the landing-page finding from earlier in this pass: translating a surface with no
real audience for the translation isn't worth the same priority as a page a member actually
sees. Recommend confirming with the client whether admin-panel i18n is wanted at all before
continuing into it — see the end-of-session question list.

### Full suite, cumulative

```
i18n unit          27   (prove-i18n.mjs)
nav shell          24
dashboard          30
fitness goals      36
recipe-create      35   (3 pre-existing failures, unrelated — horizontal-scroll bug)
profile            32
food journal       30
recipes            32
social profile     20   (17 passing; 3 failures are a second instance of the same
                          pre-existing button-row overflow bug, not caused by this work)
```
**266 i18n-related browser/unit assertions, 246 passing outright, the remaining 6 attributed to
two documented pre-existing layout bugs unrelated to translation.** `tsc` zero errors,
`npm run build` succeeds, server restarted on a fresh build before every verification pass.

---

## PHASE 10 BUILD — §E1 through §E7, plus the two launch blockers (2026-08-01)

Full session covering: two overflow bugs, §E1 admin panel, §E2 new-user monitoring, §E3
undercover accounts, §E4 content flagging UI, §E5 HIPAA-style coaching portal, §E6 beta
launch tooling, §E7 QA pass, and the system_settings encryption + Stripe webhook launch
blockers. Backend was built, curl-verified, and attack-tested in an earlier part of this
session (see the "§E1–§E6 backend" and "§E5 coaching portal backend" sections above, already
in this file). This entry covers everything finished after that point: the remaining frontend,
the coaching-portal member/admin/physician UI, the pagination audit, and final gates.

### Two known overflow bugs — reconfirmed still fixed

Re-tested at 375px after every other change in this session (risk: 60+ files touched, wanted
to be sure nothing regressed them):
- `/recipes/create` ingredient row — PASS, no horizontal scroll (375 vs 375).
- `/social/[username]` (tested against `saif9380`) — PASS, no horizontal scroll (375 vs 375).

### §E1–§E6 admin frontend — all 9 screens live-verified

`admin/page.tsx` (hub), `admin/users`, `admin/users/[userId]`, `admin/revenue`,
`admin/recipes`, `admin/content-flags`, `admin/undercover`, `admin/new-users`,
`admin/emails`, `admin/beta` — every one rewritten to call real endpoints (no mock arrays,
no "Not connected yet" banners, no fabricated numbers). Browser-verified with Playwright at
375px in **both** dark and light against the live backend: 72/72 checks passed (page renders
real content, no horizontal scroll, no console errors, no failed network requests other than
the expected `/admin/coaching` 404 before that page existed — resolved below).

### §E5 frontend — built this session (previously backend-only)

**Member-facing** — `frontend/src/app/coaching-access/page.tsx` (new). Gated on
`account_state === 'subscriber'` (matches the backend's own gate); shows an alert with a link
to `/membership` for everyone else. Request form collects the same 6 fields the backend
requires (`physician_name`, `practice_name`, `practice_address`, `practice_phone`,
`representative_name`, `representative_email`). Lists the member's own requests with status
badges and a Revoke button on approved ones. Added to nav (`nav-config.ts`, Account group) and
to `sectionForPath()` so it picks up the institutional blue `[data-section="coaching"]` accent
that was already sitting in `globals.css` from earlier in this session, unused until now.

**Admin approval** — `frontend/src/app/admin/coaching/page.tsx` (new). Tabs for
pending/approved/rejected/revoked, Approve/Reject on pending, Revoke on approved, a
per-authorization messaging panel (reply as admin). This is the page the admin hub's
"Coaching" tile already linked to before it existed — the dangling 404 seen during the first
browser-verification pass is gone now that the page is built.

**Physician portal** — entirely new product surface, `frontend/src/app/coaching-portal/*`:
- `lib/coachingApi.ts` — a **separate** axios client, separate `physician_token` localStorage
  key, separate 401 handling that redirects to `/coaching-portal/login` instead of the member
  login. Never shares a token with the member `api.ts` client — this is what makes the
  guard-separation attack tests (done earlier this session) meaningful at the frontend layer
  too, not just the backend.
- `coaching-portal/layout.tsx` — no `AppShell`, no bottom tab bar, no FAB, no member nav
  import of any kind. Public routes (`/login`, `/invite/[token]`) render standalone; every
  other route calls `GET /coaching/me` on mount and redirects to login on failure — never
  trusts "a token exists in localStorage" as proof of a live session.
- `coaching-portal/login/page.tsx`, `coaching-portal/invite/[token]/page.tsx` (preview +
  accept, single-use token), `coaching-portal/page.tsx` (patient list), and
  `coaching-portal/patients/[authorizationId]/page.tsx` (Workouts / Nutrition / Body Stats /
  Messages tabs, each independently calling its own scoped endpoint).
- `--info` blue accent throughout via `data-section="coaching"`, deliberately no brand orange
  anywhere in this surface, per §6.5.1.

**Registration invite-only messaging** — `auth/register/page.tsx` now reads
`?beta_blocked=1` (the query param the backend's Google-OAuth redirect already sent) and shows
an inline `Alert` explaining Google sign-up needs an invited address. The direct
email/password path needed no change — `assertRegistrationAllowed()`'s 403 message was already
surfacing correctly through the existing generic error handler.

### §E5 end-to-end verification — real fixtures, real accounts, real attack checks

Built a temporary `qa:coaching-setup` artisan command (deleted after use, not shipped) to
create real DB rows: one subscriber with a real `Subscription`, a real `FitnessLog`,
`FoodLogEntry`, and `BodyStat` row, and four `CoachingAuthorization` rows in different states,
plus one fully-onboarded `Physician`. Ran a Playwright script against the live app end-to-end.
**23/23 checks passed:**

1. Member revoke — clicking "Revoke Access" on one card revoked *only* that authorization
   (server-verified via a direct API call after the click, not just DOM text) and left the
   other two approved rows untouched.
   - Caught and fixed a bug **in the test script itself**, not the app: all four QA fixture
     rows shared an identical `created_at` timestamp (same command, same second), so
     `ORDER BY created_at DESC` had ties MySQL doesn't break predictably. An earlier version
     of the test used `.first()` on the "Revoke Access" button and silently revoked the wrong
     row twice across two runs. Fixed by scoping the Playwright locator to the specific card
     (`page.locator('div.bg-surface-raised', { hasText: '<name>' })`) instead of `.first()`
     — this is a testing-methodology note, not a product defect.
2. Admin approve — clicked in the browser, verified the resulting API call returned 200 *and*
   independently re-fetched the row from the server to confirm `status: approved` persisted
   (not just that the row disappeared from the DOM). This also exercises the real
   `Mail::send(new PhysicianInviteMail(...))` call over the app's live SMTP config.
3. Admin → physician messaging round trip — admin sends a reply from `/admin/coaching`,
   physician reads it in their own portal tab, physician replies back, admin's reply is
   verified server-side by the 201 status code, not just the toast.
4. Invite acceptance — previewed a known token, created a real `Physician` account
   (201, real Sanctum token issued, redirected into the portal), then **reused the same
   token** and confirmed it was rejected with "invalid or expired" — single-use enforcement
   holds all the way from the UI.
5. Physician portal — logged in with real credentials, patient list showed exactly the one
   authorized member (`QA Subscriber`), clicked into the detail page, and every tab showed
   real seeded data: Workouts tab showed "QA Bench Press", Nutrition tab showed real daily
   kcal/macro totals, Body Stats tab showed the real seeded weight (180.5 lb). No horizontal
   scroll, no console errors, at 375px.
6. **Attack check** — from the logged-in physician's own browser session, called
   `GET /api/coaching/patients/{other_authorization_id}/workouts` for an authorization that
   belongs to the same member but was never granted to this physician. Got **403**, not the
   data. This confirms `PhysicianCanAccessMember::authorize()`'s per-request re-verification
   (built and attack-tested earlier this session at the API layer) also holds when driven from
   the actual frontend, not just raw curl.

All QA fixtures (the subscriber, its subscription/logs/stats, the four authorizations, both
physician accounts created during testing) and the temporary `qa:coaching-setup` command were
deleted after verification. Nothing test-only was left in the codebase or database.

### §E7 — pagination audit (explicitly requested in the brief)

Checked every admin list endpoint added this session for whether it can actually be paged
through past its first page, not just whether the backend technically calls `paginate()`:

| Endpoint | Backend | Frontend (before) | Fixed this pass |
|---|---|---|---|
| `/admin/users` | `paginate(20)` | fetched page 1 only, no way to see more | **added "Load more"** |
| `/admin/content-flags` | `paginate(20)` | fetched page 1 only; stats tiles/badges were computed from only the loaded page, silently wrong once queue exceeds 20 | **added "Load more"; wired the pending-count badge/tile to the existing accurate `/admin/content-flags/pending-count` endpoint instead of counting loaded rows** |
| `/admin/email-campaigns` | `paginate(20)` | fetched page 1 only | **added "Load more"** |
| `/admin/coaching-authorizations` | `paginate(20)` | fetched page 1 only per tab | **added "Load more"** |
| `/admin/beta/allowlist` | `paginate(50)` | already reads `res.data.data` correctly | no change needed |
| `/admin/undercover` | **not paginated** (`->get()`) | shows everything | **not fixed** — see judgment calls |
| `/admin/new-users` | **not paginated** (`->get()`, bounded by a days filter, max 90) | shows everything in the window | **not fixed** — see judgment calls |

"Load more" (not numbered pages) was used to match the existing mobile-first, single-column
list pattern already used throughout the app — no other admin or member list in the codebase
uses numbered pagination.

### Regression sweep

- Full `php -l` across `app/`, `routes/`, `database/migrations/`, `config/` — zero syntax
  errors.
- `php artisan migrate:status` — zero pending migrations.
- `npx tsc --noEmit` — zero errors.
- `npm run build` — succeeds, includes every new route
  (`/coaching-access`, `/coaching-portal`, `/coaching-portal/login`,
  `/coaching-portal/invite/[token]`, `/coaching-portal/patients/[authorizationId]`,
  `/admin/coaching`).
- Smoke-tested 9 core Phase 1–7 endpoints with a live token after all of this session's
  changes (the app-wide `morphMap()` addition and the exception-handler rewrite were the two
  changes with the largest possible blast radius): `/dashboard`, `/notifications`,
  `/social/feed`, `/food-log`, `/fitness-logs`, `/calendar/events`, `/recipes`, `/messages`,
  `/streaks/me` — all 200, no regressions found.

### What was NOT done in this pass (see judgment calls for the full list sent to the user)

- `/admin/undercover` and `/admin/new-users` backend pagination — left unpaginated; both are
  naturally bounded for this app's near-term scale (undercover accounts are admin-created one
  at a time; new-user monitoring is windowed to at most 90 days), but neither will page past
  its first load if that assumption stops holding.
- A dedicated severity breakdown endpoint for the content-flags "High Severity" stat tile —
  it is now accurate for whatever is currently loaded, but only the pending-count badge is
  guaranteed exact once the queue exceeds one page.
- Full manual cross-phase integration walk (workouts→calendar, recipe→food-journal macros,
  recipe→meal-plan→shopping-list, billboard→feed, profile-message→conversation, custom meal
  slots) was not re-run from scratch this session — those flows were not touched by this
  session's changes, and the user said they will test everything themselves at the end. The
  targeted regression smoke test above was run specifically because this session's two
  app-wide changes (morphMap, exception handler) *could* plausibly have broken something
  outside Phase 10's own surfaces.
