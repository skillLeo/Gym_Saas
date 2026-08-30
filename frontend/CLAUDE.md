# CLAUDE.MD — MY EXTREME TRAINER (FRONTEND)

## WHO YOU ARE WORKING FOR
The client is Kelvin Silas, a fitness coach who runs Team Extreme. He is not
technical. He judges everything by how it looks and feels, and his standard is
"make me say WOW." Every page must be visually strong and feel like a premium
paid app — but see **HONESTY** below: impressive is never a licence to invent.

## ARCHITECTURE — READ THIS FIRST
This is a **real, database-backed product**. Earlier versions of this file said
"no backend, no API calls, all data is mocked." That was true only during the
initial mock phase and is now wrong.

- **Backend:** Laravel 13 / PHP 8.4 REST API, MySQL (`gym_saas`) via XAMPP.
- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4.
- **API client:** `src/lib/api.ts` (axios). Base URL from `NEXT_PUBLIC_API_URL`.
- **Auth:** Laravel Sanctum bearer token. Two independent reads, and **both**
  must be set or the app misbehaves:
  - `src/proxy.ts` redirects server-side on the `auth_token` **cookie**
  - `src/lib/api.ts` builds the Authorization header from **localStorage**
- **Payments:** Stripe (`stripe/stripe-php` server side, `@stripe/react-stripe-js`
  in the browser). Card data goes straight to Stripe via Elements and must never
  touch our server or our DOM.
- **State:** Zustand stores in `src/store/`.

### No mock data
Every screen reads from the API. Do not add hardcoded arrays of users, posts,
stats, prices or activity to make a page look populated. If an endpoint does not
exist yet, either build it or render a real empty state — never fake the content.

Several pages shipped with invented data that had to be removed later: fabricated
pricing tiers that existed nowhere in Stripe, a payment form that collected card
numbers and told users they had subscribed without contacting anyone, invented
member counts and testimonials. Assume anything that looks impressive but has no
API call behind it is a bug.

## HONESTY RULES — THESE OVERRIDE "MAKE IT LOOK GOOD"
1. **Never invent numbers.** No member counts, ratings, review counts, view
   counts, or "trusted by N athletes" unless the API returns them.
2. **Never invent commitments.** No money-back guarantees, uptime promises, or
   security claims ("bank-level encryption") unless they are actually true and
   the client has agreed to them.
3. **Never fake a working feature.** A button with no handler, a form that
   `setTimeout`s and reports success, a toggle that only sets local state — these
   are worse than an honest "Not connected yet" label, because nobody finds out
   until a customer does.
4. **Prices come from `/api/plans`.** Never hardcode an amount anywhere.

## DESIGN SYSTEM
Tokens live in `src/app/globals.css` as CSS custom properties consumed through
Tailwind v4's `@theme inline`. **There is no `tailwind.config.js`.**

- Use semantic tokens (`bg-surface-raised`, `text-content-secondary`,
  `border-border-subtle`, `text-success`), never raw hexes in components.
- Brand red `#FF0404` and error red `#B91C1C` are deliberately different. Do not
  merge them.
- Per-section accents are driven by `[data-section]`.
- Light and dark must both work on every page.

### Brand colours (source values behind the tokens)
Primary Blue `#0000FF` · Primary Orange `#F87404` · Darker Orange `#FF5C04` ·
Red `#FF0404` · Yellow `#FFC000` · Light Blue `#004AAD`

### Type
Display face for headings and buttons; Inter for body. Fonts are **self-hosted**
via `next/font/local` — do not switch to `next/font/google`, which makes builds
depend on the network at deploy time.

## LAYOUT AND SHELL
- **One shell: `src/components/shell/AppShell.tsx`.** `DashboardShell` and
  `AppSidebarLayout` are thin wrappers that delegate to it. Do not build another.
- The **subscription gate lives in `AppShell`**, because all three wrappers
  funnel through it. Its `UNGATED` allowlist must stay in step with
  `ALLOWED_PREFIXES` in the backend `EnsureSubscriptionActive` middleware.
- **One header: `src/components/ui/PageHeader.tsx`.** Sticky, collapses on
  scroll using hysteresis — see the note in that file before changing the
  thresholds; a single threshold causes the header to oscillate.
- Mobile-first. Every page must work at **375px** with no horizontal scroll.

## CONVENTIONS
- `'use client'` on anything using hooks, state or browser APIs.
- Reuse `src/components/ui/` (Button, Card, Input, States, Skeleton, ListRow…)
  rather than restyling one-off elements.
- `ErrorState` takes `description`, not `message`. `Alert` takes `tone`, not
  `variant`. Check the signature before using a component.
- Numeric inputs are guarded at three layers: keydown + regex on the client,
  validation on the server, and DB precision. All three, every time.
- No emoji as UI furniture — use lucide icons.

## BEFORE YOU CALL SOMETHING DONE
- `npx tsc --noEmit` passes.
- `npx next build` passes.
- If you rebuilt, **restart `next start`** — it reads the build manifest once at
  boot and will otherwise serve the previous bundle, which looks like your change
  silently failed.
- Check the page at 375px in both light and dark mode.
