# AI food logging — setup and operation

Snap · Say · Type lets a member photograph a meal, speak it, or type it, and
get a draft list of foods to check before anything is saved.

Written for whoever runs this server. It covers what to set, how to switch it
on for one person, what it costs, and how to turn it off in a hurry.

---

## The one-minute version

1. Put an OpenAI key in `.env` as `OPENAI_API_KEY`.
2. Put a real USDA key in `.env` as `USDA_API_KEY` (see the warning below).
3. `php artisan config:clear`
4. Admin → **AI Usage** → check "API key: Set".
5. Admin → **Manage Users** → click the **camera icon** on that member's row.
   It turns orange when the feature is on.
6. That member opens Food Journal, taps **Add with camera, voice or text**,
   reads the notice once, and uses it.

To stop everything: Admin → AI Usage → **AI logging enabled** → off. Manual
logging is unaffected.

---

## Environment variables

Only the first two are required. Everything else has a working default and
exists so the feature can be tuned without a code change.

| Variable | Default | What it does |
|---|---|---|
| `OPENAI_API_KEY` | *(none)* | **Required.** Server-side only. Never sent to the browser. With no key the feature reports "not set up" and stays off. |
| `USDA_API_KEY` | *(none)* | Free, from <https://api.data.gov/signup>. Needed for **branded products and barcodes only** — everyday foods come from the local tables (see below). Without it, generic food search still works. |
| `AI_VISION_MODEL` | `gpt-6-luna` | Reads photos. Needs image input **and** structured outputs. |
| `AI_TEXT_MODEL` | `gpt-6-luna` | Reads typed and transcribed text. |
| `AI_TRANSCRIBE_MODEL` | `gpt-transcribe` | Speech to text. |
| `AI_IMAGE_MAX_EDGE` | `1024` | Longest edge sent to the model. Drives cost; see "Why 1024". |
| `AI_MAX_OUTPUT_TOKENS` | `1500` | Ceiling per call. Output costs 5× input. |
| `AI_TEMPERATURE` | *(unset)* | **Leave unset.** See "Things that will bite you". |
| `AI_CONSENT_VERSION` | `1` | Bump when the consent wording materially changes; everyone is asked again. |
| `AI_VISION_TIMEOUT` | `45` | Seconds. |
| `AI_TEXT_TIMEOUT` | `25` | Seconds. |
| `AI_TRANSCRIBE_TIMEOUT` | `45` | Seconds. |
| `AI_CONNECT_TIMEOUT` | `8` | Seconds to establish the connection. |
| `AI_RETRY_BACKOFF_MS` | `1200` | Pause before the single retry. |
| `AI_MAX_IMAGE_BYTES` | `5242880` | 5 MB upload ceiling. |
| `AI_MAX_AUDIO_BYTES` | `10485760` | 10 MB upload ceiling. |
| `AI_MAX_AUDIO_SECONDS` | `60` | Longest clip, and what an unmeasurable clip is billed as. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Only change this to point at a compatible proxy. |

After editing `.env`, always:

```bash
php artisan config:clear
```

### ⚠️ The admin panel overrides `.env` for the USDA key

`Admin → API Keys` writes `usda_api_key` into `system_settings`, and that
value **wins over `.env`**. If you edit the file and nothing changes, that row
is why. There is no such override for the OpenAI key — it is `.env` only, on
purpose.

---

## Switching it on for people

Two gates, both of which must be open.

**Testing mode** (Admin → AI Usage) is ON by default. While it is on, only
members individually switched on can use the feature. That is what lets you
try it on your own account without the whole member base spending money.

**Per member** is switched in either of two places, whichever you have open:

- **Admin → Manage Users** — a camera icon in each row's Actions column.
  Orange means on, grey means off; hover it to read the current state.
- **Admin → Manage Users → (eye icon) → Manage account** — a labelled
  switch, *"Photo, voice and text food logging"*.

Both call the same endpoint and either will do.

**Admin accounts cannot be switched on.** An admin has no personal food
journal, so there is nothing for the feature to write to; the control is
disabled in both screens and the server refuses it with a 422 regardless. If
you want to try the feature yourself, use a member account.

Everything here is done in the browser. No shell, no `artisan`, no database
access is needed to operate this feature.

Turn testing mode OFF and every member gets it, with the monthly budget as the
only thing limiting total spend. Do that deliberately.

A member must also accept the consent notice, which they see the first time
they open the feature. They can withdraw it in their own Settings, and no AI
call is possible without it — enforced server-side, not in the browser.

---

## What it costs

Measured on this build, not estimated from a price list.

| | per call | notes |
|---|---|---|
| Photo | **$0.00036** | ~1,182 input + ~450 output tokens |
| Typed text | **$0.00009** | |
| Voice | **$0.0045 per minute** | billed on the real recording length |

At the default **$8.00** monthly cap that is roughly **22,000 photos**. The cap
is not going to be what limits you; the per-member daily limit will.

Costs on the AI Usage screen are **estimates** worked out from published
per-token prices. OpenAI's invoice is the authority. The screen says so.

### The limits, and what each is for

| Setting | Default | Purpose |
|---|---|---|
| Monthly budget | `$8.00` | Total spend. `0` means no limit. |
| Per member, per day | `20` | Counts **successful** logs only — an outage is not charged against the member. |
| Per member, per minute | `4` | Counts **every attempt**. This is the one that stops abuse. |

All editable at Admin → AI Usage, live, no deploy.

---

## Turning it off

| Situation | Do this |
|---|---|
| Stop everything now | Admin → AI Usage → **AI logging enabled** off |
| Stop spending but keep it working next month | Lower the monthly budget below current spend |
| Stop one member | Admin → Manage Users → switch them off |
| Stop it permanently | Remove `OPENAI_API_KEY`, `php artisan config:clear` |

In every case manual logging, food search, barcode scanning and the rest of
the app carry on untouched. There is a test suite that does nothing but assert
this (`AiFailureIsContainedTest`), because an optional convenience being able
to take down the food journal would be the worst possible outcome.

---

## What is stored, and what is not

**Never stored:** photos, voice recordings, transcripts, prompts, food names
submitted for analysis, or the API key. Uploads are read into memory and
deleted in a `finally` block; nothing is copied under `storage/`.

**Stored:** one row per call in `ai_usage_logs` — member id, feature, model,
token counts, estimated cost, status, latency. Numbers only.

Photos are re-encoded through GD before they are sent, which drops every EXIF
block the camera wrote, **GPS included**. The browser does the same before
upload, so location data never leaves the phone.

`store: false` is sent on every request, so content does not accumulate in the
provider's dashboard either.

---

## Why 1024 px

Because it was measured. Across five real food photographs:

```
1280px : 1,644 input tokens, $0.000395/photo
1024px : 1,182 input tokens, $0.000333/photo
```

The obvious worry is that a smaller image sees less food. Label agreement
between the two sizes was 58% — which sounds bad until you run the control:
**the same photo sent twice at 1280 agreed with itself 62% of the time.** The
model's run-to-run variance is as large as the resolution effect, so the saving
is not bought with accuracy. What varies at either size is the long tail of
garnishes — a lime wedge, a scatter of sesame seeds — which carry almost no
calories and which the member can add themselves.

Raise `AI_IMAGE_MAX_EDGE` back to `1280` if that stops being true.

---

## Things that will bite you

**`AI_TEMPERATURE` must stay unset.** The current models reject the parameter
outright:

```
400 invalid_request_error
"Unsupported parameter: 'temperature' is not supported with this model."
```

It is not mentioned on the model page — it was found by making a real call.
Setting it makes *every* request fail, which the app honestly reports as the
provider being unavailable, so the feature looks broken rather than
misconfigured. Only set it if you have pointed `AI_TEXT_MODEL` at an older
model that accepts it.

**`DEMO_KEY` is not a USDA key.** It is the shared public one, rate-limited to
roughly 30 requests an hour across everyone using it. This now matters far
less than it did: with the local tables imported, ordinary foods never touch
the API, and `DEMO_KEY` only limits branded products and barcode scanning.

**FoodData Central's own reliability is the reason the local copy exists.**
Measured over twelve identical requests while this was built: the
`Survey (FNDDS)` data type failed six times out of twelve with a spurious
nginx 400, and on another day the service answered none of six requests at
all. A failed lookup is silent — no results rather than an error — so it looks
like the food does not exist. Anything that must work should not depend on it.

**A photographed menu is read as a meal.** The model will list everything on a
menu, a packet or a nutrition label as food that was eaten. The review screen
warns about it; it is not a bug, and nothing is saved until the member agrees.

**Model names change.** They are read from the environment precisely so that a
rename is an `.env` edit rather than a deploy. If calls start failing with 404s,
check the model names against OpenAI's current list first.

---

## Deploying this later

Required on the server:

```
OPENAI_API_KEY=...
USDA_API_KEY=...
```

Run the migrations:

```bash
php artisan migrate        # ai_usage_logs, plus three columns on users
php artisan config:clear
```

Nothing needs a queue worker or a cron job. AI calls happen inside the member's
own request — this host cannot fork, so there is no worker to hand them to,
which is why the timeouts are short and the output is capped.

Nothing is enabled by the migration: `ai_features_enabled` is `false` for every
existing member, testing mode is on, and the cap is `$8`.

---

## The local food database

Everyday foods are served from **our own copy of USDA's curated datasets**, not
from the live API. A lookup for "banana" is an index hit on the local tables
and makes no network request at all; FoodData Central is left for the two
things only it can answer — branded supermarket products and barcodes.

This was not optional. The live API spent days at a time timing out or
returning spurious 400s, and a failed lookup is silent, so a member saw no
nutrition for ordinary food.

### Importing it

Download two archives from <https://fdc.nal.usda.gov/download-datasets>, put
them in `storage/app/usda/`, and run:

```bash
php artisan foods:import-usda
```

| Dataset | File | Size |
|---|---|---|
| Foundation Foods | `FoodData_Central_foundation_food_csv_2026-04-30.zip` | 3.6 MB |
| SR Legacy | `FoodData_Central_sr_legacy_food_csv_2018-04.zip` | 5.8 MB |

The zips are read directly — there is nothing to unzip. The command is
idempotent, so re-running it or importing a newer release is safe. It takes
about six seconds and loads **8,262 foods and 14,636 portions**, adding roughly
**3.9 MB** to the database.

> **⚠️ Do not use the newest Foundation release.** USDA's `2026-10-29` archive
> ships with no `food.csv`, `food_nutrient.csv` or `food_portion.csv` — only
> ids and lab metadata. `2026-04-30` is the newest complete one. The importer
> checks and refuses the broken archive by name rather than importing nothing
> and reporting success.

### On a host with no shell

cPanel accounts without SSH cannot run `artisan` at all. For those there is a
one-time SQL dump of the two finished tables, imported through **phpMyAdmin**.
It creates the tables, fills them, and records the migration as run so a later
deploy does not try to create them again. See the deployment notes for the
file and the steps.

### Everyday names

`config/food_aliases.php` maps words the American database does not know onto
words it does — porridge, wholemeal, aubergine, chips. Each entry is an *extra*
search rather than a replacement, so the member's own word is always searched
too and an ambiguous alias cannot hide the right answer. Plain PHP array, edit
and save; nothing else needs changing.

### Credit

Food and nutrient data is from **USDA FoodData Central**, which is in the
public domain (CC0 1.0). The app credits it in two places a member sees
nutrition: under the food search results on the Food Journal, and under each
matched food on the AI review screen.

---

## Housekeeping

```bash
php artisan foods:report-duplicates          # readable
php artisan foods:report-duplicates --json   # machine-readable
```

Lists food records that look like the same food stored twice, with the number
of journal entries pointing at each. **Read-only** — it opens no transaction
and changes nothing. Merging a food that members' entries point at means
rewriting what they ate, so that stays a human decision.

---

## Where the code is

| Path | What it does |
|---|---|
| `config/ai.php` | Every setting, with the reasoning |
| `app/Services/Ai/AiClient.php` | The only class that talks to OpenAI |
| `app/Services/Ai/AiGate.php` | Flag, consent and limits — one implementation |
| `app/Services/Ai/FoodAnalyzer.php` | Prompt, schema, USDA matching |
| `app/Services/Ai/MediaPreparer.php` | Re-encoding, EXIF stripping, durations |
| `app/Services/FoodJournal.php` | The one place a journal row is written |
| `app/Http/Controllers/Api/AiFoodLogController.php` | `/analyze` and `/confirm` |
| `app/Http/Controllers/Api/Admin/AiUsageController.php` | The admin screen |
| `frontend/src/components/food/ai/` | The bottom-sheet flow |
| `tests/Feature/Ai/` | 147 tests: the gates, the limits, leaks, and failure containment |
| `tests/Feature/Food/` | 60 tests: the journal write, duplicates, USDA search |
