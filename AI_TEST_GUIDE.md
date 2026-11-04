# Snap · Say · Type — manual test sheet (localhost)

Everything below was run on this machine on 2 November 2026 before it was
written down. Where something is **not** verified, it says so in that step.

Nothing here touches the live site.

---

## 0. Already done — the branches are merged

`pre-phase-11-deploy-work` is merged into `phase-11-ai`, so the USDA key is
readable and the feature works. Nothing to do; this note is here because the
earlier version of this sheet told you to run the merge yourself.

If you want to confirm:

```bash
cd C:/xampp/htdocs/Gym_Saas
php artisan config:clear
php artisan tinker --execute='echo app(\App\Services\UsdaFoodData::class)->configured() ? "USDA OK" : "USDA NOT CONFIGURED";'
```

You want `USDA OK`.

---

## 1. Start everything

Three processes. Open three terminals and leave them running.

**MySQL** — XAMPP Control Panel → Start MySQL. It must be on **port 3307**
(not the default 3306). Or from a terminal:

```bash
C:/xampp/mysql/bin/mysqld.exe --defaults-file=C:/xampp/mysql/bin/my.ini --standalone
```

**Laravel API:**

```bash
cd C:/xampp/htdocs/Gym_Saas
php artisan serve --port=8001
```

**Next.js app:**

```bash
cd C:/xampp/htdocs/Gym_Saas/frontend
npm run dev
```

| What | URL |
|---|---|
| The app (use this one) | **http://localhost:3000** |
| API | http://localhost:8001 |
| Database | 127.0.0.1:**3307**, schema `gym_saas` |

> **Use `localhost`, never `127.0.0.1`, in the browser.** CORS is configured for
> `localhost:3000`; the numeric form is a different origin and every API call
> fails.

Quick check that both are up:

```bash
curl -s -o /dev/null -w "api %{http_code}\n" http://127.0.0.1:8001/api/ai/status   # expect 401
curl -s -o /dev/null -w "app %{http_code}\n" http://localhost:3000/auth/login      # expect 200
```

`401` from the API is correct — that endpoint needs a login.

---

## 2. Logins, and switching AI on for a member

### The accounts (all verified against the current database)

| Role | Email |
|---|---|
| Admin | `kelvin@myextremetrainer.com` |
| **Member — use this one** | `member@myextremetrainer.com` |
| Spare member | `test@myextremetrainer.com` |

All three use the seeded development password, which is set in
`database/seeders/AdminUserSeeder.php` — look there rather than here.

> It is not written in this file on purpose. This repository is public, and a
> table of working logins is a great deal more useful to someone scanning it
> than the same string buried in a seeder. The password is in that seeder
> either way, so the right fix is to change it on any host that is reachable
> from the internet, not to hide it better.

The login page in dev shows two grey **Admin** / **Member** buttons under the
form that log you straight in. They only render when `NODE_ENV=development`
and are stripped from production builds.

### Switching AI on for the member — in the browser

Sign in as **admin**, then either:

- **Admin → Manage Users** → search `member@` → click the **camera icon** in
  that row's Actions column. Grey means off, orange means on, and hovering it
  says which. A toast confirms: *"Photo, voice and text logging switched on for
  Alex Rivera."*
- or **Admin → Manage Users → (eye icon) → Manage account** → the switch
  labelled **"Photo, voice and text food logging"**.

Both call the same endpoint; use whichever you have open. **Switch it off the
same way** — you will need that for test 12.

No shell and no `artisan` is needed for any of this, which matters because the
production host has no SSH.

> Admin accounts are rejected on purpose (`member_only`, HTTP 422): an admin
> has no personal food journal, so there is nothing for the feature to write
> to. The control is disabled on Kelvin's row, and the detail page says why
> instead of showing a dead switch.

### Check the master switches

Sign in as **admin** → sidebar **ADMIN → AI Usage**
(`http://localhost:3000/admin/ai-usage`).

Under **Controls**, confirm:

- **AI logging enabled** — ON
- **Testing mode** — ON *(only members you switch on individually can use it)*
- **Monthly budget** `$8.00`, **Per member, per day** `20`, **Per member, per
  minute** `4`

---

## 3. The checklist

Sign in as the **member** for tests 1–15. The entry point is on **Food Journal**
(`/food-journal`) and reads **"Add with camera, voice or text"** with the
subtitle *"Photograph your meal, say it, or type it"*.

To re-run the consent test, clear it first:

```bash
php artisan tinker --execute='\App\Models\User::where("email","member@myextremetrainer.com")->first()->forceFill(["ai_consent_at"=>null,"ai_consent_version"=>null])->save(); echo "consent cleared";'
```

| # | Test | Do this | You should see |
|---|---|---|---|
| **1** | **Consent** | Tap **Add with camera, voice or text** | A sheet titled **"Before you start"** with three bullets: recordings aren't kept · calories come from a food database, never the AI · you check everything before saving. Plus *"You can turn this off again at any time in Settings."* and one button, **"I understand — continue"**. ✅ *verified* |
| **2** | **Consent sticks** | Close the sheet, tap the entry point again | The consent sheet does **not** reappear. You land straight on the chooser. ✅ *verified* |
| **3** | **Text** | Chooser → type into *"Or describe your meal"* → **Find these foods** | ~5–10s loading, then **"Check before saving"**. See §4 for what the numbers should look like. ✅ *verified* |
| **4** | **Photo** | **Take photo** or **Choose photo**, pick a photo of a real plate of food | Same review screen, one row per food it sees. Takes longer than text (~10–12s). ⚠️ *buttons verified present; I did not upload a photo in this pass* |
| **5** | **Voice** | **Speak** → say *"two eggs and a slice of toast"* → **Stop recording** | Hint reads *"Listening. Say what you ate, then stop."* Then the review screen, with a **"We heard"** line showing the transcript. ⚠️ *not verified — no human speech has ever been through this path* |
| **6** | **Menu photo** | Photograph a **menu or a food packet**, not a meal | It will list the menu items as if you ate them. **This is expected, not a bug.** The grey line under the title — *"Check each item. Menus, labels and packaging can be read as food."* — is there for exactly this. Nothing is saved until you press save. |
| **7** | **No food** | Photograph something with no food in it (a keyboard, a wall) | **"No food found"** — *"We could not see any food there. Try another photo, or describe your meal instead."* No error, no charge to your daily count. |
| **8** | **Provider error** | Stop your internet, then try to analyse | *"You are offline, so your meal cannot be read right now. You can still log it by hand."* with a **Log manually instead** button. Your journal is untouched. |
| **9** | **Cancel** | Start an analysis and press **Cancel** while it runs | The sheet closes, nothing is saved. After **12 seconds** the wording changes to *"Still going. You can cancel and log this meal by hand instead."* ✅ *timings verified in code: 12s slow notice, 30s give-up* |
| **10** | **Timeout** | Let a very slow request run past 30s | It gives up on its own: *"This is taking longer than it should. Nothing was saved — log this meal by hand and carry on."* |
| **11** | **Daily cap reached** | Set the daily limit to 1 (below), analyse twice | The second attempt is refused before any AI call is made. **There is no "Try again" button** in this state — that is correct, retrying cannot help. Manual logging still works. |
| **12** | **Flag off** | Admin → Manage Users → click the orange camera icon to turn it off, then reload Food Journal as the member | **"Add with camera, voice or text" disappears**, and the old **Photo Log** and **Voice Log** tiles come back. **Scan Barcode** and **Create food** are there in both states. ✅ *verified* |
| **12b** | **Admin cannot be enabled** | On Manage Users, hover the camera icon on **Kelvin's** row | It is greyed out and says *"Admins have no food journal, so AI logging does not apply"*. Open his detail page: a sentence where the switch would be, not a dead control. ✅ *verified* |
| **12c** | **Members cannot reach it** | Sign in as the member and open `/admin/users` | Redirected away. The API refuses with **403**, so nothing is exposed by typing the URL. ✅ *verified at the API* |
| **13** | **Consent withdrawal** | **Settings** → **"Photo, voice and text logging"** → toggle off | Toast: *"Switched off. Manual logging is unchanged."* Go back to Food Journal — the entry point is gone. Toggle it back on and it returns. ✅ *verified present* |
| **14** | **Dark mode** | Moon icon, top right | Every sheet (consent, chooser, loading, review, error) readable. Check the grey caution line and the *"Nutrition from USDA FoodData Central"* captions — low-contrast text is where this usually breaks. |
| **15** | **375 / 1280** | DevTools → iPhone SE (375px), then back to 1280 | At 375 the sheet is a bottom sheet you can scroll; **Save to journal** stays reachable without zooming. Nothing clipped, no sideways scroll. |
| **16** | **Spanish / French** | Settings → language → Español, then Français | Consent title becomes **"Antes de empezar"** / **"Avant de commencer"**. The caution line becomes *"Revisa cada elemento…"* / *"Vérifiez chaque élément…"*. ✅ *all 64 AI strings verified present in en, es and fr* |
| **17** | **Admin usage page** | Sign in as admin → **ADMIN → AI Usage** | Your test calls appear under **By feature** as `food_analyze_text` / `_image` / `_audio`, with token counts, estimated cost and latency. **Heaviest users** lists the member. ✅ *verified* |

**For test 11**, set the daily limit to 1 and put it back afterwards:

```bash
php artisan tinker --execute='app(\App\Services\Ai\AiSettings::class)->set("ai_daily_limit_per_user", 1); echo "limit=1";'
php artisan tinker --execute='app(\App\Services\Ai\AiSettings::class)->set("ai_daily_limit_per_user", 20); echo "limit=20";'
```

The daily limit counts **successful** logs only — a provider outage is not
charged against the member. The per-minute limit (4) counts every attempt.

---

## 4. Three meals to type, and what to look for

Copy these into the **"Or describe your meal"** box.

> **The matching was rewritten after these were first measured**, so the
> "before" column below is what the three meals used to do, kept because it is
> what you are checking has stopped happening. I could not re-run the meals end
> to end afterwards: FoodData Central went down entirely (0 of 6 requests
> answered, all timeouts) while I was re-measuring. The per-term results that I
> did confirm after the change are in the second table.

### A. `two scrambled eggs and a slice of wholemeal toast`

| Drafted | Weight | Top match it picks | Verdict |
|---|---|---|---|
| scrambled eggs | 100 g | `SCRAMBLED EGGS (EGGLAND'S BEST)` — 113 kcal/100 g | branded, a bit low |
| wholemeal toast | 35 g | `Bread, egg, toasted` | ❌ **wrong food** — that's egg bread |

Total shown: **223 kcal**.

### B. `a grilled chicken breast with rice and broccoli`

| Drafted | Weight | Top match | Verdict |
|---|---|---|---|
| grilled chicken breast | 170 g | `GRILLED CHICKEN BREAST` — 135 kcal/100 g | reasonable |
| rice | 158 g | `RICE` — 139 kcal/100 g | reasonable for cooked |
| broccoli | 156 g | `BROCCOLI` — 24 kcal/100 g | reasonable |

This one comes out sensible. Use it as your "good" baseline.

### C. `a bowl of porridge with honey and a banana`

| Drafted | Weight | Top match | Verdict |
|---|---|---|---|
| Porridge | 240 g | `MULTIGRAIN PORRIDGE SLICED BREAD, TARTINE` — 260 kcal/100 g | ❌ **that's bread** |
| Honey | 21 g | `Honey` — 304 kcal/100 g | ✅ correct |
| Banana | 118 g | `BANANA` — 312 kcal/100 g | ❌ a branded banana product; raw banana is 89 |

Accepted as-is this totals roughly **1,056 kcal**. A real bowl of porridge with
honey and a banana is about **340 kcal**. **Three times too high.**

### What changed, and what is still not right

Across 37 common foods the top match went from **19/37 inside a sensible
calorie band to 35/37**, and the whole report now runs in under a second
because it reads the local tables rather than the API. Re-run it yourself:

```bash
php artisan foods:match-report --fresh
```

Confirmed by hand after the change:

| Term | Before | After |
|---|---|---|
| banana | `BANANA` 312 kcal | ✅ `Bananas, raw` **89** |
| apple | `Croissants, apple` 254 | ✅ `Apples, raw, without skin` **48** |
| avocado | `Oil, avocado` 884 | ✅ `Avocados, raw, California` **167** |
| potato | `Bread, potato` 266 | ✅ a potato (58–77 depending on entry) |
| carrot | `Carrot, dehydrated` 341 | ✅ `Carrots, raw` **41** |
| greek yogurt | `GREEK YOGURT` 467 | ✅ `Yogurt, Greek…` **82** |
| **porridge** | `…PORRIDGE SLICED BREAD` 260 | ⚠️ `Cereals, WHEATENA, cooked with water` **56** |
| **wholemeal toast** | `Bread, egg, toasted` 315 | ⚠️ `Bread, wheat, toasted` **313** |

**Porridge and wholemeal toast are only half fixed.** Both now land on the
right *kind* of food with a believable calorie figure — a cooked cereal and a
toasted bread — but neither is the exact food named: the cereal is wheat
rather than oats, and the bread is not wholemeal. Check them specifically, and
use the dropdown.

Two remaining failures in the 37-food set, both the same shape — the right
head word with a qualifier that changes the food:

- **potato** → `Potatoes, raw, skin` 58 (potato skin, not the potato)
- **bacon** → `Bacon, turkey, unprepared` 226 (turkey bacon, not pork)

So the thing to actually test is the **"Which food"** dropdown on each row:
open it, confirm there are three options, and confirm picking a different one
updates the calories and the total immediately. Each option is now marked
**generic** or **brand**. That dropdown is the feature that makes a wrong first
guess harmless, and it is unchanged apart from those labels.

Every row should carry **"Nutrition from USDA FoodData Central"** underneath.
If a number ever appears without that caption, stop and tell me — the model is
never allowed to supply a calorie figure.

---

## 5. When it goes wrong

### A food matched something obviously wrong

Open the **"Which food"** dropdown on that row and pick a better one. Each
option is now marked **generic** (a curated USDA food) or **brand** (a
supermarket product), and they can differ enormously for what reads as the
same thing — a branded "GREEK YOGURT" was 467 kcal/100 g against 73 for the
plain one.

When the top match barely resembles what was drafted, the row says
*"Not sure about this one — check it"* under the label. That is the signal to
open the list rather than trust the first option.

### Everyday foods now come from a local copy

Ordinary foods — banana, chicken breast, broccoli — are served from USDA's
curated datasets **imported into our own database**, so they work with the
live API completely switched off. Proven by disabling the key: all ten of
`banana, apple, chicken breast, salmon, broccoli, carrot, egg, tomato,
porridge, wholemeal toast` resolved, in **239 ms for all ten**.

The API is still used for branded supermarket products and barcodes. So if a
*branded* item fails but plain foods work, that is the expected split, not a
fault.

If plain foods find nothing, the import probably has not run:

```bash
php artisan tinker --execute='echo \App\Models\FoodItem::query()->getConnection()->table("usda_foods")->count();'
```

Zero means run `php artisan foods:import-usda` (see AI_SETUP.md).

### Lookups intermittently find nothing, or every food goes branded

**FoodData Central itself is unreliable.** Measured over twelve identical
requests while this was being built: the `Survey (FNDDS)` data type failed 6
times out of 12 with a spurious nginx 400, and plain timeouts and 500s come
and go in bursts. A failed lookup is silent — it returns no results rather
than an error — so a bad patch looks exactly like bad matching.

The app now retries once on anything that is not a rate limit, which covers
most of it. If results still look erratic:

```bash
tail -50 storage/logs/laravel.log | grep "USDA FoodData Central"
```

Repeated `"status":400` or `unreachable` lines are their end, not yours. Wait
and try again.

### "No nutrition match" on every single food

| Cause | Check | Fix |
|---|---|---|
| **The merge in §0 was skipped** — by far the most likely | `php artisan tinker --execute='echo app(\App\Services\UsdaFoodData::class)->configured() ? "OK" : "NOT CONFIGURED";'` | Do §0 |
| Config cache is stale after editing `.env` | — | `php artisan config:clear` |
| A key stored in the admin panel is overriding `.env` | `php artisan tinker --execute='echo \App\Models\SystemSetting::where("key","usda_api_key")->exists() ? "OVERRIDE SET" : "none";'` | Clear it in **Admin → API Keys**, or delete the row |
| Rate limited | Watch for several foods failing at once after heavy use | Wait an hour |

Note the app distinguishes **"we could not reach the food database"** from
**"that food isn't in it"** — the first shows *"The food database could not be
reached…"*, the second shows *"Nothing in the food database matched this."*
They are different problems; read which one you got.

### "That did not work" / the provider is unavailable

| Cause | Check | Fix |
|---|---|---|
| `AI_TEMPERATURE` is set | `grep AI_TEMPERATURE .env` | **Remove the line.** The current models reject the parameter with a 400 and *every* request fails |
| No OpenAI key | `php artisan tinker --execute='echo config("ai.api_key") ? "key present" : "NO KEY";'` | Put `OPENAI_API_KEY` in `.env`, then `config:clear` |
| Monthly budget spent | Admin → AI Usage → **This month** | Raise the budget, or wait for the month to roll over |
| Model renamed by OpenAI | 404s in `storage/logs/laravel.log` | Update `AI_VISION_MODEL` / `AI_TEXT_MODEL` in `.env` |

### Pages 404 even though the files exist

Turbopack's cache goes stale after a branch switch — this bit me while testing.

```bash
# stop npm run dev, then:
rm -rf frontend/.next
npm run dev
```

### Login succeeds but the page doesn't move

The first page load after starting `npm run dev` compiles on demand and can
take 10+ seconds. Wait, don't re-click. If the API returned `200` the login
worked.

### Where to look

```bash
tail -f storage/logs/laravel.log
```

Requests and errors are logged with status codes and error **types** only —
never prompt text, never photos, never the API key.

---

## Test 3 addendum — the review screen's new signals

While checking the text path, confirm both of these on the **"Check before
saving"** screen:

- **Every dropdown option ends in `· generic` or `· brand`.** Open the list on
  any row and look.
- **A doubtful row says so.** When the top match shares fewer than half its
  words with the drafted label, *"Not sure about this one — check it"* appears
  under the label in orange. `wholemeal toast` is the reliable way to see it.

---

## What this sheet does not cover

- **No human speech has ever gone through the voice path.** It is exercised end
  to end and bills correctly, but every clip was generated audio. Test 5 is the
  first real use.
- I did not upload a real food photograph in this pass; tests 4, 6 and 7 are
  written from the implementation and earlier runs, not from this session.
- Tests 8, 10 and 14–15 describe intended behaviour I did not re-walk today.
- **The three sample meals were not re-run end to end after the matching was
  rewritten.** FoodData Central went down mid-measurement — 0 of 6 requests
  answered — so §4's "after" column is per-term results confirmed earlier, not
  a fresh pass through the UI. Running `php artisan foods:match-report --fresh`
  when the API is healthy is the honest check.
- **Porridge and wholemeal toast still match the wrong food.** Improved, not
  fixed. See §4.
