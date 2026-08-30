# MY EXTREME TRAINER — BUILD BRIEF: DESIGN OVERHAUL + MOBILE REBUILD + PHASES 8, 9, 10

**Read this entire document before writing a single line of code.**

You are working on an existing, functional Laravel 13 + Next.js 16 fitness SaaS. Phases 1–7 are built and working. This brief covers three things:

- **PART I** — A complete design system overhaul and mobile-first rebuild of all 64 existing pages.
- **PART II** — Building Phases 8, 9, and 10 from scratch.
- **PART III** — Performance, database, and final QA.

**AI features are explicitly OUT OF SCOPE.** They are Phase 11. Do not build them. Do not stub them "helpfully." If you touch anything under `/ai-trainer`, it is presentation-layer only.

---

## 0. EXECUTION PROTOCOL — READ FIRST

This brief is too large to complete in a single uninterrupted pass. Do not attempt to. It is divided into **8 sequential stages with hard verification gates.** You must:

1. Work stages **in order**. Later stages depend on earlier ones. Building Phase 8 UI before the design system exists means rebuilding it twice.
2. At the end of every stage, run the **Gate Command Block** (§0.2) and paste the real output.
3. **Do not proceed to the next stage if the gate fails.** Fix, re-run, then continue.
4. After each stage, produce a **Stage Report** in the format in §0.3.
5. If you run out of context mid-stage, stop at a clean boundary, write your progress into `BUILD_PROGRESS.md` at the repo root (which stage, which files done, which remain), and report where you stopped. Never leave the repo in a non-compiling state.

### 0.1 Stage map

| Stage | Scope | Depends on |
|---|---|---|
| 1 | Design system foundation (tokens, primitives, type, icons) | — |
| 2 | Mobile app shell + PWA | 1 |
| 3 | Retrofit all 64 existing pages onto 1 + 2 | 1, 2 |
| 4 | Phase 8 — Membership, payments, engagement | 1, 2 |
| 5 | Phase 9 — Community expansion, resources, i18n | 1, 2 |
| 6 | Phase 10 — Admin, coaching portal, launch tooling | 1, 2, 4 |
| 7 | Performance + database quality | 4, 5, 6 |
| 8 | Final QA pass | all |

### 0.2 Gate Command Block

Run all of these. All must pass. Paste actual output, not a summary.

```bash
# Backend
cd c:/xampp/htdocs/Gym_Saas
php artisan migrate:status          # zero pending
php -l <every .php file you touched this stage>
php artisan test                     # if tests exist; if none, say so explicitly
php artisan route:list --json > /dev/null && echo "routes OK"

# Frontend
cd c:/xampp/htdocs/Gym_Saas/frontend
npx tsc --noEmit                     # zero errors
npm run build                        # must succeed
```

### 0.3 Stage Report format

For every stage, report in exactly this shape. This project's owner has repeatedly caught fixes that were claimed done but were not. Vague reporting is treated as a failed stage.

```
## STAGE N REPORT

### Files created
- path/to/file.php — one line on what it does

### Files modified
- path/to/file.tsx — before: X | after: Y

### Verified personally
- <what you actually ran/clicked/curled, and the actual result>

### NOT verified
- <anything you could not test, and precisely why>

### Blocked
- <anything needing a credential or client decision>

### Gate output
<paste real terminal output>
```

**Rule on honesty:** If you did not personally run or observe something, write "not verified" and say why. Never write "everything works" or "looks good." A stage report claiming untested work is worse than one admitting gaps.

---

## 1. GROUND TRUTH — CURRENT CODEBASE STATE

This was audited directly. Trust these facts over any assumption.

### 1.1 Stack

- **Backend:** Laravel 13.7, PHP 8.4, MySQL (`gym_saas`), Sanctum 4.3 token auth, Spatie Permission 7.4, Socialite 5.29, Intervention Image 4. Served on `http://localhost:8000` via `php artisan serve`.
- **Frontend:** Next.js 16.2.4 (App Router), React 19.2, TypeScript 5, Tailwind CSS **v4** (CSS-first `@theme` config, no `tailwind.config.js`), Zustand 5, TanStack Query 5, Axios, Framer Motion 12, Recharts 3, lucide-react 1.14, react-hot-toast. Served on `http://localhost:3000`. `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- **Not installed:** Stripe (no Cashier, no stripe-php, no @stripe/stripe-js), any i18n library, any PWA/service-worker library, any test framework in use.

### 1.2 Backend inventory

**Models (27):** BodyStat, CalendarEvent, Conversation, DailyStep, FitnessGoal, FitnessLog, Follow, FoodItem, FoodLogEntry, Group, LiveSession, LiveSessionComment, MealPlan, MealSlot, Message, Notification, PostComment, PostReaction, Recipe, SavedRecipe, ShoppingListItem, SocialPost, SystemSetting, Todo, User, Video, WaterLog.

**API Controllers (24):** Achievement, Admin, Auth, BodyStat, Calendar, CustomFood, DailyStep, Dashboard, FitnessGoal, FitnessLog, FoodLog, FoodSearch, Group, Live, MealSlot, Message, Notification, Onboarding, Recipe, SocialComment, SocialFollow, SocialPost, Upload, Video, WaterLog.

**Middleware (2):** `Authenticate`, `EnsureEmailIsVerified` (aliased `verified.email`; has an `ALLOWED_PATHS` allowlist for logout/user/email-resend).

**Mail (4):** TrialWelcomeMail, TrialExpiringMail, TrialExpiredMail, VerifyEmailMail.

**Console Commands (1):** `ProcessTrials` (`trials:process`), scheduled daily in `routes/console.php`.

**`app/Jobs/` does not exist.** Queue is configured as `QUEUE_CONNECTION=database` but **no queue worker process runs.** This matters — see §4.0.

**`users` table columns:** id, name, username, email, google_id, email_verified_at, password, avatar, bio, date_of_birth, gender, height_cm, current_weight_kg, goal_weight_kg, activity_level, primary_goal, daily_calorie_goal, daily_protein_goal_g, daily_carbs_goal_g, daily_fat_goal_g, daily_water_goal_glasses, trial_starts_at, trial_ends_at, trial_reminder_sent, subscription_status, is_admin, onboarding_completed, remember_token, created_at, updated_at, deleted_at.

**Existing admin endpoints** (`/api/admin/*`): settings, settings/smtp, settings/nutritionix, settings/test-smtp, settings/test-nutritionix, stats, moderation, users, users/recent, users/{user} (PUT/DELETE), groups/pending, groups/{group}/approve, groups/{group}/reject.

**Global exception handling** already exists in `bootstrap/app.php`: an `AuthenticationException` handler returning clean 401 JSON, and a `QueryException` handler that converts any raw SQL error to a clean message for `api/*` in **every** environment. **Preserve both.** Extend, never remove.

### 1.3 Frontend inventory — all 64 page routes

```
/ (landing)
/dashboard
/admin  /admin/api-keys  /admin/content-flags  /admin/emails  /admin/live
/admin/moderation  /admin/notifications  /admin/recipes  /admin/stats
/admin/undercover  /admin/users  /admin/videos
/ai-trainer  /ai-trainer/achievements  /ai-trainer/body-visualizer  /ai-trainer/meal-visualizer
/auth/forgot-password  /auth/login  /auth/oauth-callback  /auth/onboarding
/auth/register  /auth/reset-password  /auth/verify-email
/calendar  /calendar/meal-planner  /calendar/shopping-list  /calendar/todo
/fitness  /fitness/body-stats  /fitness/goals  /fitness/history
/fitness/log-workout  /fitness/streak
/food-journal  /food-journal/barcode  /food-journal/history
/food-journal/photo-log  /food-journal/voice-log
/food-log  /food-log/history
/live
/membership  /membership/subscribe  /membership/trial-expired
/messages  /messages/[conversationId]
/notifications
/onboarding
/profile  /profile/edit  /profile/settings
/recipes  /recipes/[recipeId]  /recipes/create  /recipes/saved
/settings
/social  /social/[username]  /social/explore  /social/friends
/videos  /videos/[videoId]
```

Note `/onboarding` and `/auth/onboarding` both exist, and `/food-log` and `/food-journal` both exist. **Resolve these duplicates in Stage 3** — pick the canonical one, redirect the other, delete dead code. Do not leave both.

**Existing components:** `AppSidebarLayout`, `Providers`, `food/FoodSearchModal`, `layout/DashboardShell`, `layout/MobileBottomNav`, `layout/Navbar`, and `ui/`: Avatar, Badge, Button, Card, EmojiPicker, Input, LoadingSpinner, MacroBar, ProgressBar, ProgressRing, RingChart, RoleSwitcher, ThemeToggle.

**Existing stores:** authStore, foodLogStore, i18nStore (already has a basic en/es/fr key map — build on it, do not discard), layoutStore, socialStore.

**`src/lib/mockData.ts` still exists and is still imported in places.** The app is DB-backed now. In Stage 3, eliminate every remaining import of it and delete the file. Any page still reading mock data is a bug.

### 1.4 Audited design-debt counts (your targets)

These are the actual measured counts of the "AI-generated" tells. Drive each to its target.

| Tell | Current | Target |
|---|---|---|
| Emoji characters in `.tsx`/`.ts` source | **373 across 32 files** | 0 outside user-generated content and `EmojiPicker.tsx` |
| `shadow-lg` / `shadow-xl` / `shadow-2xl` | **91 across 39 files** | ≤ 8, only on sheets/dropdowns/FAB/modals |
| `rounded-2xl` / `rounded-3xl` | **228** | Only where the radius scale calls for `lg`/`xl` |
| Gradient usages (`bg-gradient`, `from-[#`, `text-gradient`) | **120** | ≤ 1 (optional landing hero only) |

`EmojiPicker.tsx` (128 of the 373) is a legitimate user-facing emoji **input** for composing posts — it stays. `lib/mockData.ts` (27) gets deleted. The rest must go.

---

## 2. NON-NEGOTIABLE RULES

1. **No functional regressions in Phases 1–7.** Every existing feature must still work identically after the redesign. You are changing presentation and structure, not behavior — except where this brief explicitly says otherwise.
2. **No raw errors reach users.** No SQL strings, no stack traces, no exception class names, no "Error 500." Every user-visible error is a plain, specific, human sentence. The global `QueryException` handler in `bootstrap/app.php` stays and is extended, not replaced.
3. **Every numeric input is guarded at three layers:** frontend (`onKeyDown` blocking `-`/`e` + regex `onChange` guard — the HTML `min` attribute alone does **not** prevent typing a negative), backend validation (`min`/`max`), and DB column precision. All three must agree. A `decimal(6,2)` column max is 9999.99 — validation must be at or under that. This class of bug has already caused a production error in this project twice (recipe `fat`, fitness goal `target_value`).
4. **Every list endpoint that can grow is paginated.** No unbounded `->get()` on user-generated content.
5. **Server-side authorization on every endpoint.** Never trust an ID from a URL or request body. This is critical in Phase 10's coaching portal (§6.5).
6. **Every migration is reversible.** A real `down()`, tested with `migrate:rollback`.
7. **No hardcoded hex colors in components** after Stage 1. Everything references a token.
8. **Mobile-first, always.** Write the 375px layout first, then add `sm:`/`md:`/`lg:` upward. Never write a desktop layout and squeeze it down.
9. **Do not run `git commit` or `git push`** unless explicitly asked. Leave changes in the working tree.
10. **Do not install a dependency without stating why** in the stage report. Prefer what is already in `package.json`/`composer.json`.

---

# PART I — DESIGN SYSTEM & MOBILE REBUILD

---

## STAGE 1 — DESIGN SYSTEM FOUNDATION

Build the system first. Everything after this consumes it.

### 1.1 The design position

The current UI reads as templated AI output: emoji icons, blanket drop shadows, uniform `rounded-2xl`, gradient text, and the same centered icon-over-title-over-description card repeated on every page. The target is the opposite: **flat surfaces, hairline borders, deliberate radius, restrained color, real typographic hierarchy, and layouts that differ per section because the information differs.**

The reference standard is a premium native fitness app — think the density and calm of a well-made banking or health app — not a marketing website. Surfaces are neutral. Brand color is punctuation, never wallpaper.

### 1.2 Color tokens

Write these into `src/app/globals.css` using Tailwind v4 `@theme`. **The brand hexes are the client's and must not be substituted.**

**Brand (unchanged, used as accent only):**
```
--brand-orange:      #F87404   /* primary action — the ONLY primary button color */
--brand-orange-deep: #FF5C04   /* hover/pressed state of primary */
--brand-red:         #FF0404   /* fitness section accent */
--brand-red-pure:    #FF0000   /* reserved, use sparingly */
--brand-yellow:      #FFC000   /* highlight accent */
--brand-blue:        #0000FF   /* reserved, high-saturation — use sparingly */
--brand-blue-deep:   #004AAD   /* food journal + resources accent */
```

**Neutral ramp — warm-biased (not pure grey; the slight warmth ties it to the orange and reads as chosen, not default):**

Light mode:
```
--surface-base:    #FAFAF9   /* page background */
--surface-raised:  #FFFFFF   /* cards, sheets */
--surface-sunken:  #F5F4F2   /* inset wells, disabled fields */
--border-subtle:   #E8E6E3   /* the default 1px separator — replaces shadows */
--border-strong:   #D6D3CE   /* input borders, emphasized dividers */
--text-primary:    #1C1917
--text-secondary:  #57534E
--text-tertiary:   #8A8580   /* captions, placeholders — must still pass 4.5:1 on surface-base */
```

Dark mode (true dark neutral, same warm bias):
```
--surface-base:    #0C0A09
--surface-raised:  #1A1817
--surface-sunken:  #050403
--border-subtle:   #292524
--border-strong:   #3A3532
--text-primary:    #FAFAF9
--text-secondary:  #A8A29E
--text-tertiary:   #78716C
```

**Semantic colors — deliberately distinct from brand:**
```
                    light      dark
--success:        #15803D    #22C55E
--warning:        #A16207    #EAB308
--error:          #B91C1C    #F87171
--info:           #1D4ED8    #60A5FA
```

**Critical design decision you must honor:** brand red `#FF0404` and error red are different colors serving different purposes. Brand red is a *section accent* for Fitness. Error red is a *state*. They must never be confused. Enforce this two ways: (a) error red is the deeper, less-saturated `#B91C1C`, and (b) **every semantic state pairs its color with a Lucide icon and a text label** — never color alone. Color-blind users and colour-fatigued users both depend on this.

**Section accents** (surfaces stay neutral in all sections; only the accent changes):

| Section | Accent |
|---|---|
| Social | `--brand-orange` |
| Fitness | `--brand-red` on near-black surfaces |
| Food journal | `--brand-blue-deep` + `--brand-orange` |
| Calendar | per-category palette (define 6 distinct category colors) |
| Resources | `--brand-blue-deep` |
| Membership/billing | `--brand-orange` |
| Coaching portal | **neutral + `--info` only, no brand orange** — see §6.5.1 |

**Dark mode contract:** define the palette as custom properties on `:root`, redefine only the tokens under `@media (prefers-color-scheme: dark)`, and redefine again under `.dark` (the existing class-based toggle, already wired via `@variant dark` in `globals.css`). Style components through tokens, never inside the media query directly. The manual toggle must win over the OS preference in both directions.

### 1.3 Typography

Keep the existing `@font-face` wiring for Posey Textured in `globals.css` (it correctly points to `/fonts/Posey-Textured-Regular.woff2` with `font-display: swap`). `public/fonts/` is currently **empty** — the licensed file has not been delivered. Do not block on it. Improve only the fallback stack so the interim state looks intentional rather than accidental.

Type scale (mobile-first values; scale up at `md:` where noted):

| Token | Size/Line | Tracking | Face | Use |
|---|---|---|---|---|
| `display` | 32/36 → 40/44 `md:` | -0.02em | Posey | Landing hero only |
| `h1` | 26/32 | -0.015em | Posey | Page title |
| `h2` | 20/28 | -0.01em | Posey | Section header |
| `h3` | 17/24 | -0.005em | Inter 600 | Card title |
| `body-lg` | 16/24 | 0 | Inter 400 | Primary reading |
| `body` | 15/22 | 0 | Inter 400 | Default UI |
| `body-sm` | 13/18 | 0 | Inter 400 | Secondary |
| `caption` | 12/16 | +0.01em | Inter 500 | Meta, timestamps |
| `overline` | 11/14 | +0.06em | Inter 600 UPPER | Section eyebrows, table headers |

Rules: body copy never exceeds ~65 characters per line. Headings get `text-wrap: balance`. Numbers in any aligned column or stat tile get `font-variant-numeric: tabular-nums`. Three sizes is not a hierarchy — use the scale.

### 1.4 Spacing, radius, elevation, motion

**Spacing** — strict 4px grid: `1=4 2=8 3=12 4=16 5=20 6=24 8=32 10=40 12=48 16=64`. Lay out sibling groups with flex/grid + `gap`, not per-element margins.

**Radius** — deliberate scale, applied by element class, not uniformly:
```
--radius-xs:   6px    chips, badges, tags
--radius-sm:   8px    inputs, buttons, segmented controls
--radius-md:  12px    cards, list rows, tiles
--radius-lg:  16px    desktop modals, large panels
--radius-xl:  24px    bottom sheets (top corners only)
--radius-full        avatars, pills only
```

**Elevation** — rare and meaningful. The default separator is a hairline border, not a shadow.
```
e0: none                                  — cards, rows, tiles (use border-subtle)
e1: 0 1px 2px rgba(0,0,0,.04)             — dropdowns, popovers, menus
e2: 0 4px 12px rgba(0,0,0,.08)            — bottom sheets, FAB, tab bar
e3: 0 8px 28px rgba(0,0,0,.12)            — full-screen modal scrim content only
```
In dark mode, prefer a **lighter surface** (`surface-raised`) over a shadow — shadows are nearly invisible on `#0C0A09` and just add noise.

**Motion** — fast, functional, never decorative:
```
--motion-micro:    150ms ease-out        hover, focus, toggle
--motion-standard: 200ms ease-out        expand, fade, tab change
--motion-sheet:    250ms cubic-bezier(0.2, 0, 0, 1)   sheet in/out
```
Wrap all of it in `@media (prefers-reduced-motion: reduce)` to disable transforms and keep opacity only. Delete the existing `.animate-float` bounce from `globals.css` unless the landing hero genuinely still uses it — decorative float is exactly the "AI vibe" being removed.

### 1.5 Icons — the emoji purge

**All 373 emoji occurrences outside `EmojiPicker.tsx` and user-generated content must be replaced with Lucide React icons.** lucide-react is already a dependency.

Rules:
- No emoji in headings, buttons, nav labels, empty states, toasts, admin UI, seeders, or notification copy.
- Emoji are acceptable **only** in content a user typed themselves (a post body, message, bio) and inside the emoji picker that lets them type it.
- Backend seeders and DB records that store an emoji as an "icon" (e.g. `fitness_goals.emoji`, `badges`) must migrate to storing a **Lucide icon name string** (e.g. `"dumbbell"`) resolved through a central `<Icon name="..."/>` map on the frontend. Add a migration to convert existing emoji values to icon names; do not leave a mixed column.
- Icon sizing: 16px inline with body text, 20px in buttons/nav, 24px section headers. Stroke width 1.75 as default (Lucide default 2 reads heavy at small sizes). Set this once in the icon wrapper.

Files with the highest emoji density, in order: `app/page.tsx` (45), `lib/mockData.ts` (27, deleting), `admin/emails` (18), `admin/notifications` (15), `onboarding` (15), `auth/onboarding` (12), `fitness/goals` (12), `social` (11), `auth/register` (9), `social/[username]` (9), `auth/layout` (8), `fitness/streak` (8).

### 1.6 Component primitives to build/rebuild

Create `src/components/ui/` primitives that every page consumes. Where one already exists, rebuild it against the tokens rather than adding a parallel one.

**Rebuild:** `Button`, `Card`, `Input`, `Badge`, `Avatar`, `ProgressBar`, `ProgressRing`, `RingChart`, `MacroBar`, `LoadingSpinner`.

**Create new:**

| Component | Notes |
|---|---|
| `Sheet` | Bottom sheet. Drag-to-dismiss, snap points, scrim, focus trap, `Esc`, safe-area padding. **The default overlay on mobile.** |
| `Modal` | Desktop-only centered dialog. On mobile it renders as `Sheet` automatically. |
| `Skeleton` | Shape-matched loaders. `SkeletonText`, `SkeletonCard`, `SkeletonRow`, `SkeletonChart`. |
| `EmptyState` | Lucide icon + one-line title + one sentence + optional single action. One pattern used everywhere. |
| `ErrorState` | Same shape, `--error` accent, always with a retry action. |
| `PageHeader` | Title, optional back button, max 2 icon actions. Collapses on scroll. |
| `Field` | Label + control + hint + error, wired for a11y (`aria-describedby`, `aria-invalid`). All forms use this. |
| `NumericField` | **Wraps the three-layer guard from Rule 3.** Props: `min`, `max`, `step`, `allowDecimal`. Every numeric input in the app must migrate to this — that is how the negative-number bug class gets permanently closed instead of re-fixed per field. |
| `Select` / `SegmentedControl` | Native-feeling; on mobile `Select` opens a `Sheet`. |
| `Switch` | 44px touch target minimum. |
| `Tabs` | Underline style, scrollable when overflowing. |
| `ListRow` | The workhorse. Leading icon/avatar, title, subtitle, trailing value/chevron, optional swipe actions. |
| `SwipeableRow` | Wraps `ListRow` with swipe-to-action. |
| `StatTile` | Label + tabular number + optional delta + optional sparkline. |
| `Toast` | Configure existing `react-hot-toast` position to sit **above** the tab bar and FAB. |
| `Chip` | Filter/category only — never decorative. |
| `Icon` | Central Lucide resolver mapping stored icon-name strings to components. |
| `PullToRefresh` | Wrapper providing native-feeling pull gesture. |

**Stage 1 gate additionally requires:** a `/design-system` route (dev-only, excluded from prod nav) rendering every primitive in every state — default/hover/focus/disabled/error, light and dark. This is how the consistency audit in Stage 3 gets verified instead of eyeballed.

---

## STAGE 2 — MOBILE APP SHELL & PWA

The client's members use this on phones, standing in a gym or a kitchen. It must feel like an installed app, not a website.

### 2.1 App shell

Replace the current `AppSidebarLayout` / `MobileBottomNav` / `Navbar` / `DashboardShell` arrangement with one coherent shell. On mobile it is a native-style app frame; at `lg:` and up it becomes a sidebar layout for admin/desktop use.

**Bottom tab bar** — fixed, always visible on authenticated pages, exactly 5 destinations:

| Tab | Route | Badge |
|---|---|---|
| Home | `/dashboard` | — |
| Food | `/food-journal` | — |
| Fitness | `/fitness` | — |
| Social | `/social` | unread feed activity |
| More | opens a `Sheet` | sum of unread messages + notifications |

The **More** sheet contains: Calendar, Recipes, Videos, Live, Vibe Thread, Messages, Resources, Notifications, Membership, Profile, Settings, and (admin only) Admin. Group them with `overline` section labels.

Requirements: active state is unmistakable (accent icon + accent label + weight change, not color alone), icons 24px, labels 11px, minimum 44×44px targets, `e2` elevation, and `padding-bottom: env(safe-area-inset-bottom)`.

**Floating action button** — bottom-right, anchored above the tab bar, contextual per section:

| Section | Action |
|---|---|
| `/dashboard` | Quick-action sheet: Log food / Log workout / Log water / Log weight |
| `/food-journal` | Log food |
| `/fitness` | Log workout |
| `/social` | Create post |
| `/calendar` | Add event |
| `/messages` | New message |
| Elsewhere | Hidden |

Single action opens it directly; multiple relevant actions open a quick-action `Sheet`.

**Top app bar** — screen title, back affordance on nested routes, max 2 icon actions. Shrinks on scroll (title scales down into a compact bar) rather than permanently occupying vertical space. Respects `env(safe-area-inset-top)`.

### 2.2 Native interaction patterns

Replace web patterns throughout:

- **Bottom sheets, not centered modals**, for anything triggered from the lower half of the screen: add food, log water, filters, quick actions, confirmations, pickers.
- **Pull-to-refresh** on dashboard, social feed, notifications, messages, vibe thread.
- **Swipe actions** on list rows: food log entries (delete), todos (complete/delete), shopping list items (check/delete), notifications (dismiss), messages (delete). Destructive swipes require confirmation or provide undo.
- **Sticky section headers** on long lists (food journal by meal, history by date, messages by day).
- **Skeleton loaders everywhere** — never a blank screen, never a bare centered spinner.
- **Optimistic UI** on: like/react to post, check todo, check shopping item, log water glass, follow/unfollow, pin member. Reconcile with the server after; roll back visibly on failure.

  ⚠️ The messaging pages previously had a duplicate-React-key crash from a race between an optimistic send and the 3-second poll. It was fixed with `Set`-based dedup. **Preserve that dedup pattern** and apply the same guard to every new optimistic list you add.
- **Toasts** positioned so they never cover the tab bar or FAB.
- **Keyboard handling:** focused inputs must never be hidden behind the on-screen keyboard. Use `scrollIntoView` on focus and dynamic viewport units (`100dvh`, not `100vh`).

### 2.3 PWA / home-screen install

`public/manifest.json` exists but is incomplete, and **no service worker exists.**

- Complete the manifest: name, short_name, description, `start_url: "/dashboard"`, `display: "standalone"`, `theme_color: "#F87404"`, `background_color` matching `--surface-base`, `orientation: "portrait"`, scope, and a full icon set — **192, 384, 512, plus a 512 `maskable`** and an Apple touch icon. Only `icon-192.png` and `icon-512.png` currently exist in `public/images/`; generate the missing sizes.
- Add iOS meta tags (`apple-mobile-web-app-capable`, status bar style, apple-touch-icon) — iOS ignores much of the manifest.
- Add a service worker: cache the app shell and static assets, network-first for API calls, and a **graceful offline fallback screen** (branded, explains what happened, offers retry). Do **not** cache authenticated API responses to disk.
- Add a dismissible "Add to Home Screen" prompt (`beforeinstallprompt` on Android; a short instructional sheet on iOS, which has no programmatic prompt).
- Verify: launched from the home screen there is **zero browser chrome**.

### 2.4 Responsive coverage

Primary targets **375px and 390px**. Then verify 768px and 1280px.

Non-negotiable: no horizontal page scroll anywhere (wide content — tables, charts, code — scrolls inside its own `overflow-x:auto` container); no truncated or overlapping text; all touch targets ≥44×44px; charts resize and stay legible; **data tables reflow into stacked cards on mobile** rather than scrolling sideways (this applies to every admin table).

---

## STAGE 3 — RETROFIT PHASES 1–7

Apply Stages 1 and 2 to all 64 existing pages. **Presentation changes; behavior does not.**

Work section by section, in this order. After each section, verify its features still work.

| Order | Section | Pages | Watch for |
|---|---|---|---|
| 1 | Auth | login, register, forgot/reset-password, verify-email, oauth-callback, onboarding ×2 | Resolve `/onboarding` vs `/auth/onboarding` duplicate. Verify-email resend must still work (it hits real SMTP, 8–25s — keep the loading state honest). |
| 2 | Dashboard | dashboard | Highest-traffic screen. Rebuild information density for a phone. |
| 3 | Food | food-journal + barcode/history/photo-log/voice-log, food-log ×2 | Resolve `/food-log` vs `/food-journal` duplicate. Custom meal slots must stay consistent across barcode, voice, photo, recipe logging. |
| 4 | Fitness | fitness, body-stats, goals, history, log-workout, streak | All numeric fields migrate to `NumericField`. |
| 5 | Social | social, [username], explore, friends | Keep the small reaction picker and the full composer `EmojiPicker` **separate** — they are two different components and must stay that way. |
| 6 | Recipes | recipes, [recipeId], create, saved | Nutrition fields → `NumericField`; keep the validated max bounds. |
| 7 | Calendar | calendar, meal-planner, shopping-list, todo | Per-category color system. |
| 8 | Messages | messages, [conversationId] | **Preserve the `Set`-based dedup fix.** |
| 9 | Media | videos, [videoId], live | |
| 10 | Profile/Settings | profile, edit, settings ×2, notifications | Consolidate the two settings pages if they overlap. |
| 11 | Membership | membership, subscribe, trial-expired | Stage 4 replaces the internals; make the shell correct now. |
| 12 | Admin | 12 admin pages | Tables → stacked cards on mobile. |
| 13 | Landing | `/` | 45 emoji to remove. The one permitted gradient may live here. |
| 14 | AI Trainer | 4 pages | **Presentation only. Build no AI functionality.** |

**Per-page checklist** — every page must end with: one `PageHeader`; consistent `Card`/`ListRow` usage; all forms on `Field`/`NumericField`; `Skeleton` while loading; `EmptyState` when empty; `ErrorState` with retry on failure; zero emoji; zero hardcoded hex; zero gradient; shadows only where §1.4 permits; verified at 375px; dark mode correct; no `mockData` import.

**Copy rewrite:** replace AI-sounding marketing copy ("Unlock your potential", "Elevate your fitness journey", "Seamlessly track everything") with short, plain, specific sentences. Buttons state exactly what happens ("Log workout", then a toast saying "Workout logged"). Errors say what went wrong and how to fix it.

---

# PART II — PHASES 8, 9, 10

---

## STAGE 4 — PHASE 8: MEMBERSHIP, PAYMENTS, ENGAGEMENT

### 4.0 Queue reality — read before building any scheduled feature

`QUEUE_CONNECTION=database` is configured but **no queue worker is running.** Anything dispatched to the queue right now silently never executes.

Therefore:
- Build jobs as proper queued `ShouldQueue` classes (correct architecture).
- **Also** create `app/Console/Commands/` entries and register them in `routes/console.php` alongside the existing `ProcessTrials` schedule, so scheduled work runs via the scheduler rather than depending on a worker.
- Write `QUEUE_SETUP.md` documenting exactly what must run in production: `php artisan queue:work --tries=3` under a supervisor, and the cron entry `* * * * * php artisan schedule:run`.
- **Never** move a user-facing synchronous action to the queue as a "performance fix" without a running worker — it converts a slow-but-working feature into a silently broken one. (Email verification resend is currently synchronous and slow for exactly this reason. Leave it synchronous until a worker is confirmed running.)
- Flag in your stage report that scheduled features are **untestable end-to-end** until a worker/cron exists locally, and say precisely which ones.

### 4.1 Stripe subscriptions

Install `stripe/stripe-php` (backend) and `@stripe/stripe-js` + `@stripe/react-stripe-js` (frontend). Use **Stripe Elements** so card data never touches the server. Do not use Cashier unless you justify it — direct SDK gives cleaner control over this schema.

**Three tiers:** Basic monthly, Premium monthly, Annual VIP (with a visible savings callout vs monthly). Pricing page has a monthly/annual toggle that recalculates live and one visually highlighted recommended plan.

**Schema:**

```
subscription_plans
  id, key ENUM(basic,premium,annual_vip) UNIQUE, name, description,
  stripe_price_id, amount_cents INT UNSIGNED, currency CHAR(3) DEFAULT 'USD',
  interval ENUM(month,year), features JSON, is_active BOOL DEFAULT 1,
  sort_order SMALLINT, timestamps

subscriptions
  id, user_id FK->users CASCADE, plan_id FK->subscription_plans RESTRICT,
  stripe_subscription_id VARCHAR UNIQUE, stripe_customer_id VARCHAR,
  status ENUM(trialing,active,past_due,canceled,incomplete,incomplete_expired,unpaid),
  current_period_start TIMESTAMP NULL, current_period_end TIMESTAMP NULL,
  cancel_at_period_end BOOL DEFAULT 0, canceled_at, ended_at, timestamps
  INDEX (user_id, status), INDEX (current_period_end)

payments
  id, user_id FK CASCADE, subscription_id FK NULLABLE SET NULL,
  stripe_invoice_id VARCHAR UNIQUE NULL, stripe_payment_intent_id VARCHAR NULL,
  amount_cents INT UNSIGNED, currency CHAR(3),
  status ENUM(succeeded,failed,refunded,pending),
  failure_reason VARCHAR NULL, paid_at TIMESTAMP NULL, timestamps
  INDEX (user_id, created_at)

stripe_webhook_events                    -- idempotency ledger
  id, stripe_event_id VARCHAR UNIQUE,    -- the idempotency key
  type VARCHAR, payload JSON, status ENUM(pending,processed,failed),
  processed_at, attempts TINYINT DEFAULT 0, last_error TEXT NULL, timestamps
  INDEX (type, status)
```

Add to `users`: `stripe_customer_id VARCHAR NULL INDEX`.

**Webhooks** — handle `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.

Idempotency is mandatory: on receipt, `INSERT` into `stripe_webhook_events` on `stripe_event_id`; if it already exists as `processed`, return 200 immediately and do nothing. Duplicate Stripe deliveries must never double-apply. Verify the webhook signature with `STRIPE_WEBHOOK_SECRET`. The webhook route is **outside** `auth:sanctum` and **outside** `verified.email`, and must be CSRF-exempt (`api/*` already is).

### 4.2 Trial lifecycle

Four states: `trial`, `subscriber`, `grace` (expired, limited), `deactivated`.

**Trial length must be admin-configurable via `system_settings`, not hardcoded** — default 14 days (client is deciding between 14 and 21). Changing it affects only new signups; never retroactively shorten an existing trial.

Extend the existing `ProcessTrials` command (do not duplicate it):
- Trials past `trial_ends_at` without an active subscription → `grace`, set `deactivated_at`.
- Accounts in `grace`/`deactivated` for 90 days with no payment → soft-delete (`users.deleted_at` already exists), then hard-delete after a further retention window. **Log every deletion to an audit table.** Never silently destroy user data.
- Deactivated users **can still log in** but every feature is gated behind a clear subscribe prompt. Handle this in `EnsureEmailIsVerified`'s sibling — add a new `EnsureSubscriptionActive` middleware with an `ALLOWED_PATHS` allowlist (auth, membership, billing, logout, profile-read) following the exact pattern of the existing middleware.

Add to `users`: `deactivated_at TIMESTAMP NULL`, `scheduled_deletion_at TIMESTAMP NULL`, `account_state ENUM(trial,subscriber,grace,deactivated) DEFAULT 'trial' INDEX`. Keep `subscription_status` in sync or migrate it — do not leave two competing sources of truth. State transitions live in one place: a `UserAccountState` service.

### 4.3 Trial conversion coupon funnel

Two stages: **Offer 1** sends day 7, expires day 10, strongest incentive. **Offer 2** sends day 18, expires day 21, weaker than Offer 1. Both fully admin-editable — copy, discount amount, and send timing — with no developer involvement.

```
coupon_offers
  id, key UNIQUE, name, stage TINYINT,           -- 1 or 2
  trigger_day_offset SMALLINT,                   -- day 7 / day 18
  expires_after_days SMALLINT,                   -- 3
  discount_type ENUM(percent,fixed), discount_value DECIMAL(8,2),
  stripe_coupon_id VARCHAR NULL,
  email_subject VARCHAR, email_body_html TEXT,
  is_active BOOL DEFAULT 1, timestamps

coupon_grants
  id, user_id FK CASCADE, coupon_offer_id FK CASCADE,
  code VARCHAR UNIQUE,                           -- unique trackable per user
  stripe_promotion_code_id VARCHAR NULL,
  sent_at, expires_at, redeemed_at NULL, redeemed_payment_id NULL, timestamps
  UNIQUE (user_id, coupon_offer_id)              -- never send the same offer twice
  INDEX (expires_at, redeemed_at)
```

Validate `discount_value` against `discount_type` (percent ≤ 100; fixed ≤ plan price). Admin must not be able to create a 200% coupon.

### 4.4 Scheduled motivational notifications

Admin manages a pool of **8–10 seeded messages** with full add/edit/delete, and configures which days and times they fire. A real scheduled command selects a message **not recently used** (least-recently-sent, not pure random — pure random repeats) and sends to all active members.

```
motivational_messages
  id, title NULL, body VARCHAR(500), is_active BOOL DEFAULT 1,
  last_sent_at NULL, send_count INT DEFAULT 0, created_by FK NULL, timestamps
  INDEX (is_active, last_sent_at)

notification_schedules
  id, name, days_of_week JSON,                   -- [1,3,5]
  send_time TIME, timezone VARCHAR DEFAULT 'UTC',
  is_active BOOL, last_run_at NULL, timestamps
```

Must be genuinely functional, not a UI mock. Delivery goes through the existing `Notification` model (in-app). Web push is out of scope unless you wire it fully — if you skip it, say so explicitly.

### 4.5 Streaks, badges, auto-featuring

**Extensible schema — adding a badge type later must require no migration.**

```
badges
  id, key UNIQUE, name, description,
  icon_name VARCHAR,                             -- Lucide name, NEVER an emoji
  tier ENUM(bronze,silver,gold,platinum) NULL,
  criteria_type VARCHAR,                         -- 'consecutive_days' | 'count_in_period' | ...
  criteria JSON,                                 -- {"activity":"workout","days":7}
  is_active BOOL, sort_order, timestamps

user_badges
  id, user_id FK CASCADE, badge_id FK CASCADE,
  awarded_at, period_start DATE NULL, period_end DATE NULL, meta JSON NULL, timestamps
  UNIQUE (user_id, badge_id, period_start)       -- idempotent re-runs
  INDEX (user_id, awarded_at)

activity_streaks
  id, user_id FK CASCADE,
  streak_type ENUM(workout,meal_log,engagement,overall),
  current_count INT DEFAULT 0, longest_count INT DEFAULT 0,
  last_activity_date DATE NULL, started_on DATE NULL, timestamps
  UNIQUE (user_id, streak_type)

feed_features
  id, user_id FK CASCADE, feature_type ENUM(week_streak,month_streak),
  period_start DATE, period_end DATE, expires_at TIMESTAMP,
  dismissed_at NULL, timestamps
  INDEX (expires_at), UNIQUE (user_id, feature_type, period_start)
```

Three initial badge types: workout consistency, meal-logging consistency, community engagement. Weekly badge at 7 consecutive consistent days. A **distinct, prominent celebration state on the member's profile at a full consecutive month** — this should be the single most visually rewarding moment in the app; give it real design attention, not a bigger badge.

**Auto-featuring** (driven by real activity data via the scheduled job, never manual admin action): 7 consecutive active days surfaces that member's card in the social feed as a highlighted "crushing it this week" item; 4 consecutive weeks surfaces a larger celebration. Featured cards must be visually distinct from normal posts but must not dominate the feed — cap how many appear per feed load.

All streak/badge computation is **idempotent** — running the job twice must never double-award.

---

## STAGE 5 — PHASE 9: COMMUNITY, RESOURCES, i18n

### 5.1 Vibe Thread

A single platform-wide open channel, distinct from private messaging and the social feed. Any member posts short messages; everyone sees and replies in near real time.

```
vibe_thread_messages
  id, user_id FK CASCADE, body TEXT, is_admin_post BOOL DEFAULT 0,
  reply_to_id FK->vibe_thread_messages NULL SET NULL,
  edited_at NULL, deleted_at NULL (soft), timestamps
  INDEX (created_at), INDEX (reply_to_id)

vibe_thread_mutes
  id, user_id FK CASCADE UNIQUE, muted_until TIMESTAMP NULL, timestamps
```

- **Cannot be hidden entirely** — but a mute-notifications toggle stops the pings while the member can still open and read it.
- **Admin posts render visually distinct** from member posts.
- "Near real time" = polling on a sensible interval (match the existing messages pattern), paginated backwards, newest at bottom. Apply the `Set`-based dedup guard. If you implement websockets instead, say so and justify the added infrastructure.
- Rate-limit posting to prevent flooding.

### 5.2 Vibe Call

Extend the **existing Phase 7 `live_sessions` infrastructure** — do not build a parallel system. Reuse existing live viewing, commenting, and replay.

Add to `live_sessions`: `is_vibe_call BOOL DEFAULT 0`, `schedule_id FK NULL`.

```
vibe_call_schedules
  id, title, days_of_week JSON, time_of_day TIME, duration_minutes SMALLINT,
  timezone VARCHAR, auto_create_days_ahead TINYINT DEFAULT 7,
  is_active BOOL, last_generated_through DATE NULL, timestamps
```

A scheduled command materializes upcoming sessions from each schedule. These **automatically appear on the platform calendar** (reuse `calendar_events`). Members join optionally.

### 5.3 Resources library

New top-level section. Admin uploads and organizes PDFs and videos into admin-defined categories. Members browse, filter by category, view/download PDFs, watch videos. **Reuse the existing recipe/video library architectural patterns** for consistency.

```
resource_categories
  id, name, slug UNIQUE, description NULL, icon_name VARCHAR,
  sort_order SMALLINT, is_active BOOL, timestamps

resources
  id, category_id FK->resource_categories RESTRICT,
  title, description TEXT NULL, type ENUM(pdf,video,link),
  file_path VARCHAR NULL, file_size_bytes BIGINT UNSIGNED NULL, mime_type VARCHAR NULL,
  external_url VARCHAR NULL, thumbnail_path VARCHAR NULL, duration_seconds INT NULL,
  view_count INT UNSIGNED DEFAULT 0, download_count INT UNSIGNED DEFAULT 0,
  is_published BOOL DEFAULT 0, published_at NULL,
  created_by FK->users NULL, timestamps
  INDEX (category_id, is_published), INDEX (published_at)

resource_views
  id, resource_id FK CASCADE, user_id FK CASCADE,
  action ENUM(view,download), created_at
  INDEX (resource_id, action)
```

Validate uploads strictly: MIME type allowlist, size cap, and **serve files through an authenticated controller route, never a public directory listing.** A resource must not be reachable by guessing a path.

### 5.4 Internationalization

`src/store/i18nStore.ts` already exists with a working en/es/fr key map. **Extend that structure — do not rip it out and install a heavy i18n framework** unless you justify the migration cost in your report.

- Extract **every** hardcoded UI string across all pages into translation files (`src/locales/en.json`, `es.json`, `fr.json`).
- English fully implemented. Spanish and French selectable in settings, structured and wired, with untranslated keys falling back to English visibly-but-gracefully (never a raw key like `nav.dashboard` on screen).
- Adding a language later must require **only a new file** — no restructuring.
- The locale flags currently in `i18nStore` are emoji. Per §1.5 these are UI, not user content — replace with proper labels or SVG flags.
- Dates, numbers, and units must localize too (`Intl.DateTimeFormat` / `Intl.NumberFormat`), not just strings.

### 5.5 Message search and filtering

Inside the private messaging inbox: keyword search across message content, plus date-range filters — last 30 days, last 90 days, last year, custom range.

Add a **FULLTEXT index on `messages.body`** and use `MATCH ... AGAINST` (or a well-indexed `LIKE` with a documented performance caveat). Paginate results. Debounce the search input at ~300ms. Search must be scoped to conversations the requesting user is actually a participant in — verify server-side.

### 5.6 Names, nicknames, usernames

Members list maiden names, previous names, and nicknames — **all searchable, all resolving to the same profile.** `username` already exists on `users` and is distinct from display name; keep that and make it searchable too.

Add to `users`: `nickname VARCHAR(60) NULL`, `alternate_names JSON NULL`.

For search performance, denormalize into a searchable table rather than doing JSON scans:
```
user_name_aliases
  id, user_id FK CASCADE, alias VARCHAR(120),
  type ENUM(maiden,previous,nickname,alternate), created_at
  INDEX (alias), INDEX (user_id)
```
Keep it in sync via model events. Member search queries name, username, nickname, and aliases in one indexed query.

### 5.7 Notification personalization

- Members **pin/highlight specific other members** so that person's activity renders visually distinct in their notification feed.
- The **platform owner's own posts and comments always render in a consistent unique accent color** across every member's notification feed — naturally standing out **without being force-pinned to the top.** Sort order is unchanged; only styling differs.

```
pinned_members
  id, user_id FK CASCADE, pinned_user_id FK CASCADE, created_at
  UNIQUE (user_id, pinned_user_id), INDEX (user_id)
```

The owner accent must be a token (`--owner-accent`), distinct from both the section accent and every semantic color, and must pass contrast in both themes.

---

## STAGE 6 — PHASE 10: ADMIN, COACHING PORTAL, LAUNCH

### 6.1 Complete the admin panel

Twelve admin pages already exist as routes; `AdminController` currently has only 11 methods (settings ×5, stats, moderation, users, users/recent, updateUser, deleteUser). Fill the gaps:

- **User management:** search + filter by status (trial, subscriber, expired, deactivated); view, edit, deactivate, delete any user. Paginated, server-side filtered.
- **Subscription & revenue dashboard:** active subscriber count, MRR, trial conversion rate, churn rate, revenue over time. Every figure computed from real `subscriptions`/`payments` data with the SQL stated in your report — no invented numbers.
- **Content moderation queue** for reported posts and comments.
- **Platform statistics:** total users, subscribers, posts, meals logged, workouts logged, each with growth over time.
- **Recipe, video, and resource management.**
- **Bulk email campaigns** targetable to: all users, trial only, subscribers only, or inactive for N days.

```
email_campaigns
  id, subject, body_html LONGTEXT,
  audience ENUM(all,trial,subscribers,inactive_days), audience_params JSON NULL,
  status ENUM(draft,scheduled,sending,sent,failed),
  scheduled_at NULL, sent_at NULL, recipient_count INT DEFAULT 0,
  created_by FK->users, timestamps

email_campaign_recipients
  id, campaign_id FK CASCADE, user_id FK CASCADE,
  sent_at NULL, error VARCHAR NULL
  UNIQUE (campaign_id, user_id)                  -- never double-send
```

Sending must be chunked and resumable — a failure at recipient 400 of 1000 must not re-send to the first 399.

Admin routes must be protected by a real admin gate (`is_admin` + Spatie role), enforced **server-side on every endpoint**, not by hiding UI.

### 6.2 New user monitoring

A dedicated admin tab showing only recently registered users and their activity, separate from general moderation, so the owner can watch onboarding behavior specifically. `recentUsers` exists as a starting point — extend it with per-user activity signals (onboarding completed, first food log, first workout, days active).

### 6.3 Undercover admin accounts

Admin can create secondary accounts flagged internally as admin-controlled, which browse and behave exactly like normal member accounts.

```
admin_shadow_accounts
  id, user_id FK CASCADE UNIQUE,        -- the member-looking account
  created_by_admin_id FK->users, label VARCHAR, is_active BOOL, timestamps
```

The flag is **internal only** — it must never be exposed in any member-facing API response, profile, or feed. Audit every user serializer to confirm it does not leak.

### 6.4 Content flagging queue (structure only)

Build the admin UI and backend data model, backed **for now by simple keyword matching.**

```
flag_keywords
  id, term VARCHAR, severity ENUM(low,medium,high), is_active BOOL, timestamps

content_flags
  id, flaggable_type VARCHAR, flaggable_id BIGINT UNSIGNED,   -- polymorphic
  reason ENUM(keyword,user_report), matched_terms JSON NULL,
  reported_by FK->users NULL, severity ENUM(low,medium,high),
  status ENUM(pending,reviewed,dismissed,actioned) DEFAULT 'pending',
  reviewed_by FK->users NULL, reviewed_at NULL, notes TEXT NULL, timestamps
  INDEX (status, created_at), INDEX (flaggable_type, flaggable_id)
```

**Never auto-delete, auto-lock, or auto-moderate. Flag and notify only.** Admin sees a notification badge with the pending count.

Architect the detection behind a `ContentScanner` interface with a `KeywordScanner` implementation, so Phase 11 can swap in AI detection by adding one class and changing one binding — no restructuring, no schema change.

### 6.5 Coaching portal for medical professionals

**This is the most security-critical work in the entire brief. Treat it accordingly.**

#### 6.5.1 Separation

Physicians authenticate through a **completely separate system** from members. A physician must never see the social feed, member messaging, recipes, videos, or anything outside the portal. Their entire session is scoped to the portal.

- Separate table `physicians` (not a role on `users`).
- Separate Sanctum guard `physician` with its own provider, configured in `config/auth.php`.
- Separate route group `/api/coaching/*` using `auth:physician` — **never** `auth:sanctum`.
- Separate frontend route tree `/coaching/*` with its own layout, its own login page, and **no member app shell** — no bottom tab bar, no FAB, no member nav.
- Deliberately institutional visual treatment: neutral surfaces, `--info` accent, **no brand orange**. It should be immediately obvious this is a different product surface.

```
physicians
  id, name, email UNIQUE, password, practice_name, practice_phone,
  is_active BOOL DEFAULT 1, last_login_at NULL, timestamps, deleted_at

coaching_authorizations
  id, member_id FK->users CASCADE,
  physician_name, practice_name, practice_address, practice_phone,
  representative_name, representative_email,
  status ENUM(pending,approved,rejected,revoked) DEFAULT 'pending',
  reviewed_by FK->users NULL, reviewed_at NULL, rejection_reason VARCHAR NULL,
  physician_id FK->physicians NULL SET NULL,
  invite_token_hash VARCHAR NULL,          -- store a HASH, never the raw token
  invite_expires_at NULL, authorized_at NULL, revoked_at NULL, timestamps
  INDEX (member_id, status), INDEX (physician_id, status)

physician_messages
  id, coaching_authorization_id FK CASCADE,
  sender_type ENUM(physician,admin), sender_id BIGINT UNSIGNED,
  body TEXT, read_at NULL, timestamps
  INDEX (coaching_authorization_id, created_at)

coaching_access_log                        -- audit trail; write on every data access
  id, physician_id, coaching_authorization_id, member_id,
  endpoint VARCHAR, ip VARCHAR, created_at
  INDEX (physician_id, created_at)
```

#### 6.5.2 Authorization flow

1. **Only a PAYING member can initiate.** Free-trial members cannot. Enforce server-side against `account_state = subscriber` with an active subscription — not against a UI flag.
2. Request form collects: physician name, practice name, practice address, practice phone, named representative contact.
3. Request routes to admin for **MANUAL approval. Never auto-approve.** No code path may set `status = approved` without an authenticated admin action.
4. On approval the physician receives a **secure, expiring invite link** to create a limited-access account. Generate a cryptographically random token, email the raw token, store only its hash, expire it (72h), and single-use it (null the hash on redemption).
5. Member can **revoke** authorization at any time; revocation takes effect immediately on the next request.

#### 6.5.3 Access control — write these checks defensively

Once authenticated, a physician can view **only the specific authorized patient's coaching data, read-only**: workout history, nutrition adherence, body-stat trends. Plus messaging the platform owner about that patient. **Scope strictly to coaching data — explicitly not clinical health records.**

Mandatory implementation rules:

- **Never** read a member ID from a URL, query string, or body and trust it. Resolve the accessible member(s) **from the authenticated physician's approved authorizations**, then intersect.
- Every single coaching endpoint independently verifies: physician authenticated → authorization exists → `status = approved` → not revoked → `member_id` matches. **No endpoint may rely on a previous endpoint having checked.**
- Centralize in a `PhysicianCanAccessMember` policy/middleware, and **still** assert inside each controller method. Defense in depth.
- All coaching endpoints are **read-only** except physician→owner messaging. No write path to member data exists.
- Write to `coaching_access_log` on every data access.
- Rate-limit the portal.

**Verification required in your stage report** — do not claim this works without showing these tests:
1. Physician A requests Physician B's patient by ID → **403**.
2. Physician requests a member with `status = pending` → **403**.
3. Physician requests a member after revocation → **403**.
4. Physician hits any member-app endpoint (`/api/dashboard`, `/api/social/posts`) with a physician token → **401/403**.
5. A member token hitting `/api/coaching/*` → **401/403**.
6. An expired or reused invite token → rejected.
7. A free-trial member attempting to initiate authorization → **403**.

Paste the actual curl output for each.

### 6.6 Beta launch tooling

Invite-only mode the admin toggles on, plus an admin-managed email allowlist. While invite-only is on, only allowlisted emails can register; everyone else is refused with a clear, non-technical message.

```
beta_allowlist
  id, email VARCHAR UNIQUE, note VARCHAR NULL,
  invited_by FK->users NULL, used_at TIMESTAMP NULL, timestamps
```

`invite_only_mode` lives in `system_settings`. Enforce in the **registration endpoint server-side** — hiding the signup form is not enforcement. Include Google OAuth registration in the check; it is a second registration path and is easy to miss.

---

# PART III — PERFORMANCE, DATABASE, QA

---

## STAGE 7 — PERFORMANCE & DATABASE QUALITY

### 7.1 Database audit

- Review the complete schema across all phases for normalization and correct FK constraints with appropriate cascade behavior. A `CASCADE` that silently destroys history is a bug; prefer `RESTRICT` or `SET NULL` where data should survive.
- **Index every column used in `WHERE`, `JOIN`, or `ORDER BY`.** Add composite indexes matching real query patterns (column order matters — most selective first, matching the query's leading predicates).
- **Audit every numeric column for overflow.** This project has already hit `SQLSTATE[22003]` twice in production paths (`recipes.fat`, `fitness_goals.target_value`). For each numeric column, confirm: DB precision ≥ validation max, and validation max exists at all. Produce a table in your report: column | type | max value | validation rule | OK/FIXED.
- Every migration reversible — verify by actually running `php artisan migrate:rollback` on your new migrations and re-migrating.

### 7.2 Query performance

- **Eliminate N+1 queries**, particularly in: social feed, notifications, messages, vibe thread, admin user lists, and any list rendering related records. Use eager loading (`with()`), and `withCount()` instead of loading relations to count them.
- Install Laravel Telescope or use `DB::listen` temporarily to **measure** query counts on the heaviest endpoints. Report before/after counts for at least: `/api/social/posts`, `/api/notifications`, `/api/messages`, `/api/dashboard`, `/api/admin/users`. Measured numbers, not assertions.
- Paginate every unbounded list endpoint.
- Return only fields the frontend needs — use API Resources rather than dumping whole models. Several controllers currently return full model objects.

### 7.3 Frontend performance

- Lazy-load images (`next/image` where possible, `loading="lazy"` otherwise) and below-the-fold content.
- Code-split by route; dynamic-import heavy components (Recharts, EmojiPicker, video player, Stripe Elements).
- Memoize expensive computation; eliminate unnecessary re-renders (audit Zustand selectors — subscribing to a whole store re-renders on every change).
- Debounce every search input (~300ms).
- **Compress and resize uploaded images server-side.** `intervention/image` is already installed and already used for avatars — extend that treatment to post images, food photos, recipe images, and resource thumbnails. Store a reasonable max dimension and generate thumbnails.
- Target: usable on a mid-range Android over mobile data. State your production bundle sizes before and after.

---

## STAGE 8 — FINAL QA PASS

Verify across Phases 1–10. Report each item with evidence.

**Design & mobile**
- [ ] Every page verified at 375px, then 768px and 1280px.
- [ ] Zero horizontal page scroll anywhere.
- [ ] All touch targets ≥44×44px.
- [ ] Emoji count outside `EmojiPicker.tsx` + user content: **0** (re-run the audit script and paste the number).
- [ ] Heavy shadows ≤8, all justified.
- [ ] Gradients ≤1.
- [ ] Dark mode correct on every page; manual toggle overrides OS preference both ways.
- [ ] PWA installs to home screen with zero browser chrome; offline fallback renders.

**Correctness**
- [ ] No raw SQL error, stack trace, or exception class name can reach a user. Test by deliberately triggering a DB error and showing the user-facing result.
- [ ] Every form validates with **field-level** error messages, never a vague count.
- [ ] **Every** numeric input rejects negatives where nonsensical — audit all of them, not just previously fixed ones. Paste the list of fields checked.
- [ ] Every growable list paginated.

**Cross-phase integration** (each must be traced end to end, not assumed)
- [ ] Workouts and food logs appear on the calendar.
- [ ] Recipes log to the food journal with correctly scaled macros.
- [ ] Adding a recipe to the meal plan populates the shopping list.
- [ ] Billboard shares post to the feed.
- [ ] Profile message buttons open the correct conversation.
- [ ] Custom meal slots stay consistent across barcode, voice, photo, and recipe logging.
- [ ] Streak/badge jobs award correctly and are idempotent on re-run.
- [ ] Stripe webhook replay does not double-apply.
- [ ] Physician cannot reach an unauthorized patient (all 7 tests in §6.5.3).

**Build health**
- [ ] `npx tsc --noEmit` — zero errors.
- [ ] `npm run build` — succeeds.
- [ ] `php -l` — clean on every touched file.
- [ ] `php artisan migrate:status` — zero pending.
- [ ] `php artisan migrate:fresh --seed` — completes on a clean DB.
- [ ] No Phase 1–7 regressions — walk each section's primary flow and report what you actually exercised.

---

## APPENDIX A — BLOCKED ON CLIENT INPUT

Build all surrounding code fully functional so each needs only a credential or file dropped in. **Flag these in your final report; do not block on them.**

| Item | What to build | Activation |
|---|---|---|
| **Stripe live keys** | Full integration against test keys; all env-driven | Swap `STRIPE_KEY`/`STRIPE_SECRET`/`STRIPE_WEBHOOK_SECRET` |
| **Posey Textured font** | `@font-face` already wired to `/fonts/Posey-Textured-Regular.woff2`; `public/fonts/` is empty | Drop the `.woff2` in — zero code changes |
| **Video streaming provider** | Abstract behind a `VideoProvider` interface; current player stays | Implement one adapter (Mux/Vimeo/Agora) + keys |
| **Google OAuth credentials** | Socialite flow already built (`redirectToGoogle`/`handleGoogleCallback`) | Set `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT` |
| **Nutritionix keys** | USDA FoodData Central is the confirmed primary; Nutritionix optional behind the same interface | Set keys in admin settings (UI exists) |

Also flag: **no queue worker or cron is running locally** (§4.0), so every scheduled feature is architecturally complete but unverifiable end-to-end until `queue:work` and `schedule:run` are set up. Document this in `QUEUE_SETUP.md`.

---

## APPENDIX B — WHAT "DONE" MEANS

For every item in this brief, "done" means: implemented, gate-passing, **and personally verified by you against the running app or database** with the evidence pasted into your stage report.

The owner of this project manually tests every claim. Work reported as complete that turns out to be untested costs more trust than work reported as incomplete. When in doubt, say what you actually did and what you did not.

Do not write "everything works." Write what you ran and what it returned.
