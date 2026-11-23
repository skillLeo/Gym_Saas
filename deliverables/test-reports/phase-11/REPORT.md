# Phase 11 — Snap · Say · Type

**Test report, 23 November 2026.** Branch `phase-11-ai`. Everything below was
run on localhost against the real OpenAI and USDA keys, in a real browser
driven by real mouse and keyboard events.

Written for: Saif, to pass on to Hassam and Kelvin.

---

## Verdict

**Ready for Kelvin to test: yes** — with one thing he should know before he
starts, and two things nobody has tested yet because they need a human.

The feature does what it says. Photographs, speech and typed descriptions all
reach a review screen with real foods and real numbers from the USDA database;
nothing is ever saved without him seeing it first; and every way it can fail
that we could produce — the provider down, the budget gone, the network lost,
a slow phone connection, the page refreshed half way — ends with a sentence
explaining what happened and a button to log the meal by hand.

**The one thing to know:** the calorie figures beside each food come from a
public food database, matched to what the model thought it saw. The match is
right far more often than it was — 37 of 37 common foods now land inside a
sensible calorie band, where it was 19 of 37 — but it is still a guess about
which of 8,262 entries he meant. The **"Which food"** dropdown on every row is
what makes a wrong guess harmless. If he ignores it, he will eventually log
the wrong thing.

**The two things nobody has tested:** no human being has ever spoken into the
voice path (every recording was a computer voice), and nobody has pressed
"Take photo" on an actual phone camera — every photograph was chosen from a
file. Those two are what his first session is for.

---

## What was run

| | |
|---|---|
| Backend test suite | `php artisan test` — 300 tests, 1,189 assertions, all passing |
| Frontend type check | `npx tsc --noEmit` — clean |
| Frontend production build | `npx next build` — exit 0 |
| Browser scenarios | `node tests/browser/phase11/run.mjs` — 140 checks, 139 passed, 0 failed |
| Match quality | `php artisan foods:match-report --fresh` — 37/37 |
| Deploy rehearsal | fresh migrate → drop → import both SQL files → migrate again — *Nothing to migrate* |

The browser scenarios use **real mouse and keyboard events** — `page.mouse`
moved to the element's measured position, `page.mouse.down()`, `page.keyboard`
— never `locator.click()` and never direct state injection. A test that sets
React state proves the state machine works and proves nothing about whether a
person can reach it.

That decision found a bug in the harness worth mentioning, because a person
can have the same one: the language switcher is three small buttons in a row
whose labels only appear at the `sm` breakpoint, so the row widens once styles
settle — and a press aimed at Spanish landed on French. The harness now checks
that the point it is about to press really resolves to the element it meant.

**Three things are simulated**, and all three are the *environment* rather than
the app:

- **"No microphone on this machine"** — `getUserMedia` rejects with
  `NotFoundError`. A headless Chromium on a machine with a sound card cannot
  be made to have no sound card.
- **"The microphone delivered nothing"** — `MediaRecorder` emits no data chunk,
  which is what a muted microphone, or one taken by another application, does.
- **Provider failures in the browser** — 429, 503, 500 and a request that never
  answers are injected at our own API's edge. The mapping from a provider
  429/500/timeout to our status and code is covered exhaustively by the
  backend suite with `Http::fake`; what those tests cannot show is what is on
  the screen afterwards, which is what these do.

The click, the handler and everything the member sees are real in all three.

---

## Results

| Area | What it covers | Checks | Result |
|---|---|---|---|
| `a11y` | Keyboard only, focus order, accessible names | 5 | 5 passed |
| `admin` | Admin switches AI on and off; an admin cannot use it themselves | 5 | 5 passed |
| `consent` | First-use notice, its four promises, remembering, withdrawing, re-asking | 13 | 13 passed |
| `consent-version` | A reworded notice re-asks a member who already agreed | 1 | 1 passed |
| `custom-food` | Adding the member's own food, priced per serving, to a reviewed meal | 6 | 6 passed |
| `empty` | An empty, one-character or whitespace-only description is refused before sending | 3 | 3 passed |
| `failure-api` | Budget gone, rate limited, provider down, server error, a request that never answers | 15 | 15 passed |
| `failure-ui` | Double click, back button, refresh mid-review, slow connection, offline | 8 | 8 passed |
| `lang-es` | The whole journey in Spanish | 7 | 7 passed |
| `lang-fr` | The whole journey in French | 7 | 7 passed |
| `phone` | The whole journey at 390×844 | 5 | 5 passed |
| `snap` | Ten real photographs, including a non-food one and one carrying an instruction to the model | 23 | 23 passed |
| `type` | Ten typed meals: ordinary, brands, misspellings, plurals, grams, cups, nonsense, 5,000 characters | 20 | 19 passed, 1 other |
| `voice` | Five recordings through the microphone: sentence, weights, brands, no food, silence | 16 | 16 passed |
| `voice-denied` | Microphone permission refused, and no microphone on the machine | 4 | 4 passed |
| `voice-empty` | A recording that captured nothing | 2 | 2 passed |
| **Total** | | **140** | **139 passed, 0 failed, 1 informational** |

Every check above was produced by one run against commit `a660e71`, plus the
consent-version scenario, which needs the notice version bumped in `.env` and
so runs on its own. Results files carry the commit they were produced against
and the summariser refuses to merge files whose stamps differ — a report that
quotes a pass from one build beside a failure from another is worse than one
with a gap in it.

The single informational row is the count of analyse calls the typed scenarios
made (10, all HTTP 200), which is a number rather than a pass or a fail.

Screenshots for every scenario are in `screenshots/`, by group. They are not
committed: they are regenerated by re-running the suite, and some carry a
member's journal.

---

## Bugs found, and what changed

Sixteen were found and fixed on this branch during the pass, each with a test.
Ordered by what they would have cost.

### 1. One member's claimed calories became everyone else's

`/ai/food-log/confirm` accepted a whole food object from the browser — name,
brand and all seven nutrient figures — and wrote it into `food_items`. For a
food carrying an external id that row is **shared**: keyed on
`(external_food_id, food_source, is_custom=false)`, so the next member to log
the same real USDA food inherited whatever the first member's browser had said
it contained. `calories` was validated `numeric|min:0`, with no upper bound.

So member A could post a genuine FoodData Central id with calories of 9,000.
Member B later logs that ordinary food, honestly, and their journal, daily
totals and goal tracking are computed from A's number. A never touches B's
account, and nothing in either journal looks wrong.

**Before:** the browser's figures were written to the shared row.
**After:** a food we hold locally is written from our own copy; a food we
already have a shared record for is reused unchanged; anything we cannot
verify becomes the member's own `is_custom` record, so a wrong number can only
reach the person who entered it. `AiConfirmTrustTest` pins all four cases.

### 2. The deploy had no path onto the actual server

`AI_SETUP.md` said to run `php artisan migrate`. The test host is a cPanel
account with **no SSH**, so artisan cannot be run there at all — and unlike the
food data these migrations are not optional: without `ai_usage_logs` every AI
request fails at the spend check, and without the three `ai_*` columns on
`users` nobody can be given access or asked for consent. The food dump had a
phpMyAdmin path; the schema it depends on did not.

**After:** `deliverables/ai/ai_phase11_schema.sql`, imported through the same
Import tab. Proven by migrating a fresh database, dropping the three Phase 11
migrations to imitate a server that never ran them, importing both SQL files
as phpMyAdmin would, and confirming `php artisan migrate` then answers
*Nothing to migrate* with 8,262 foods and the three columns in place. Both
files import twice with no error and no duplicate row.

The food dump also used to fail on its very last statement when imported into
an **empty** database — after all 8,262 foods had been written — because it
recorded its migration in a `migrations` table that did not exist yet. An
error at that point looks like the whole import failed when only the
bookkeeping did.

### 3. A double click threw away an analysis that had already been paid for

Found by double-clicking "Find these foods" in a real browser, which is what
the harness is for. The member ended up with the sheet closed and nothing
logged — and OpenAI had already been called and would still be billed.

The loading view is shorter than the chooser, so once the first press sent the
request and the view swapped, the second press 120 ms later landed **below the
sheet**, on the scrim, which closes it. The same thing happens to anyone who
taps beside the sheet while waiting, which is a natural thing to do when a
screen has been busy for ten seconds.

**After:** `Sheet` takes a `dismissible` flag, defaulting to today's behaviour
so no other sheet changes. The AI sheet turns it off while a call is in
flight, which disables the three casual dismissals — scrim click, Escape, drag
down — and leaves the Cancel button that is already sitting there, which
aborts the request as well as closing the view. `run()` also now refuses to
start a second analysis while one is running: two calls would otherwise orphan
the first request's abort controller.

A `locator.click()` would have been retargeted onto the button and never
landed on the scrim, so this is a bug a conventional browser test cannot see.

### 4. A failed save deleted every correction the member had made

`save()` caught every error by moving to the error screen, whose only way
forward is "Try again" — which returns to the chooser. One refused save threw
away every portion adjusted and every food re-picked, with no route back.
Nothing is written when this happens: `/confirm` runs in one transaction, so a
failure means no entries at all and the rows on screen are still exactly what
they were.

**After:** it says what went wrong and leaves the member on the review screen.

### 5. Adding one of your own foods was the easiest way to trigger it

"Search for this food" and "Add another food" both search `/food/search`,
which returns the member's own custom foods first. A custom food's nutrition
is per **serving**, and its gram weight is optional — most do not have one. The
review screen treated every food as per 100 g: it showed a 250-calorie shake
as "250 kcal per 100 g", multiplied it by a weight nobody had entered, and the
save was then refused with "has no gram weight recorded", taking the draft with
it (see 3).

**After:** such a row asks for **servings** in the food's own unit, scales by
servings, labels the list "kcal per serving", and sends the food by id — which
also stops a duplicate copy of the member's own food being created. Verified
in the browser end to end: create a 250 kcal "glass", add it to a reviewed
meal, save it.

### 6. The audio length cap capped only the estimate

`config/ai.php` describes `max_audio_seconds` as bounding the per-call cost. It
was implemented as `min($measured, 60)`, so a ten-minute clip was transcribed
in full and recorded in the ledger as one minute. That is worse than no cap:
the monthly budget is measured against the ledger, so a long clip quietly
bought itself headroom.

**After:** a file measurably over the limit is refused, with a message telling
the member to record a shorter one. The browser stops recording at 55 seconds,
so nothing from the app as built can reach this.

### 7. A forged WAV header could bill a long clip as one second

Duration is bytes ÷ byte rate, and the byte rate is four bytes in a file the
client supplied — a claim, like the duration the client reports, which was
already plausibility-checked. The header reading was not, and it is trusted
*above* the client's claim. Writing 50,000,000 into those bytes made a
20-second recording measure at 0.02 s.

**After:** a byte rate outside the plausible range reads as "unknown", which is
billed at the full allowed clip length. The expensive answer is the right one
for a file that is lying about itself.

### 8. A monthly cap of zero displayed as "$0.00 left"

Zero switches the cap **off** — that is what the limit check does and what the
setting is documented to mean. The admin usage page rendered it as "$0.00 of
$0.00, $0.00 left", which is how a screen says *you have run out*, above a
feature that was spending with no ceiling at all. The most reassuring possible
display of the least safe possible state.

**After:** "with no spending cap set", and "Nothing will stop this spending.
Set a monthly cap below."

### 9. Hitting a limit between analysing and saving discarded the draft

`/confirm` sat behind the same gate as `/analyze`. It spends nothing — the
analysis is already paid for and it only writes journal rows — but a daily
count or the shared monthly cap reached **during** the review (the member's own
second device, or another member) answered 429, and via bug 3 deleted the meal.
The refusal saved no money; the money was already gone.

**After:** the limits apply to `/analyze` only. The kill switch, the per-member
flag and consent still close `/confirm`.

### 10. A read timeout was retried as though nothing had been sent

The client's catch block treated every transport failure alike. A read timeout
is not a failure to reach the provider — the request arrived and is being
worked on — so asking again does not stop the first one. It bought a second
call and doubled the wait: 45 s + 1.2 s + 45 s = **91 seconds** of a PHP worker
on a host with few of them, for a browser that gave up at 60. DNS, TLS and
connection resets are still retried, because there nothing is in flight.

Refusing *every* timeout turned out to be too blunt, and the measurements said
so. Typed calls have a 25-second ceiling, so two attempts and the backoff come
to 51.2 seconds and fit inside the browser's 60 — and the spread on that path
is a median of 5.5 s against the 25 s ceiling, which makes a timeout there a
bad moment rather than a slow model. Photos are 45 seconds, so two come to
91.2 and do not fit. The rule is now that budget, judged on the configured
timeout rather than on how long the attempt took: for a timeout those are the
same number, and using the measured one makes it untestable — a fake that
fails instantly then "fits" and retries, which is the opposite of production.

### 11. A timed-out food lookup never got the retry it was promised

The documentation and the code both describe the food lookup as 6 seconds then
one retry at 2. `Http::pool` puts a thrown `ConnectionException` in the slot
where a response would be, and the retry filter opened with
`instanceof Response` — so every timed-out lookup was silently excluded from
the one retry it was designed to get. That is the failure this path is most
likely to see, and the one a retry is most likely to fix.

### 12. "The food database could not be reached" above a screen of matches

The flag is set for the whole batch if any single lookup fails. Four foods
matched, a fifth timed out, and the member was told there were no matches to
choose from while looking at four of them.

**After:** the banner appears only when some row really is empty. The empty row
already said so itself, with its own "Try again" and search box.

### 13. "Not sure about this one — check it" never went away

Computed once against the first match and never looked at again, so it stayed
up after the member had opened the list and picked the right food — the app
asking for something that had just been done.

### 14. An empty voice recording did nothing at all

`if (blob.size > 0)` had no else. Tapping Speak and Stop quickly enough, or a
microphone muted in hardware, left the sheet unchanged: two buttons pressed,
nothing on screen to say whether it was thinking, broken, or had heard them.

### 15. A fried egg was logged as a hard-boiled one

Found by photographing a cooked breakfast. The model read the egg correctly —
label "Fried egg", preparation "fried" — and the review screen offered
`Egg, whole, cooked, hard-boiled` at 155 kcal. `Egg, whole, cooked, fried`
(196) was sitting second in the same list. The preferred-food entry for `egg`
points at the hard-boiled row and wins by +100; it was being applied because
the hard-boiled description says nothing about frying, which counted as
agreement.

**After:** a description naming a cooking method the stated preparation does
not accept no longer qualifies to be forced to the top; it can still win on
its merits. The same change fixes `chicken breast` + fried (was roasted 165,
now fried 187).

### Smaller things

- **The AI gate could be called past by omitting an argument.** Both client
  methods took `?User $user = null` in last place and the whole gate sat inside
  `if ($user !== null)`. Every caller passes one, so nothing was wrong today —
  but adding a caller and forgetting the last argument would have switched off
  the kill switch, consent, the daily limit and the spend cap at once. Now
  required.
- **The food journal's date arrows had no accessible name** — a screen reader
  read the only way to change the day as "button" and "button".
- The USDA dump claimed its tables come to 2.6 MB; they measure 3.9 MB.
- No fallback was documented for a phpMyAdmin built without zlib, which
  refuses a `.gz` with a message about the file being too large.

---

## Matching accuracy

`php artisan foods:match-report --fresh` — **37 of 37** common foods inside a
sensible calorie band (100%). It was 19/37 before the local import and 35/37
at the last report.

The four that were still wrong at the last report are right now:

| Term | Was | Now |
|---|---|---|
| potato | `Potatoes, raw, skin` 58 (the skin) | `Potatoes, flesh and skin, raw` **77** |
| bacon | `Bacon, turkey, unprepared` 226 | `Pork, cured, bacon, cooked…` **541** |
| porridge | `Cereals, WHEATENA…` 56 (wheat) | `Cereals, oats… cooked with water` **71** |
| wholemeal toast | `Bread, wheat, toasted` 313 | `Bread, whole-wheat… toasted` **306** |

Found live in this pass and fixed:

| Query | Was | Now |
|---|---|---|
| fried egg | `Egg, whole, cooked, hard-boiled` 155 | `Egg, whole, cooked, fried` **196** |
| chicken breast + fried | `…cooked, roasted` 165 | `…cooked, fried` **187** |

Unchanged and still right: `egg` + boiled, `egg` with no preparation,
`scrambled eggs`, `chicken breast` + grilled, `rice` + raw (365) and + cooked
(130), `potato` + baked, `wholemeal toast`, `bacon` + fried.

### Wrong or doubtful matches still on screen

- **A multi-food plate under-reports garnishes.** A lime wedge or a scatter of
  seeds is often not listed at all. They carry almost no calories and the
  member can add them, but the item count will not always match the plate.
- **Branded packaged food is matched to a generic equivalent.** A photograph of
  a tin of Heinz beans matches the generic baked-beans entry, not the product.
  The dropdown offers brand entries where FoodData Central has them, marked
  `· brand`.
- **Portion estimates from a photograph are the weakest number on the screen.**
  The food is usually right; the grams are a guess from apparent size. The
  weight box on every row is the fix, and it is the field most worth changing.

---

## What the AI testing cost

**$0.0415 in total, across 128 live calls.** The budget for this work was
$1.00.

| What | Calls | Estimated | Input tokens | Output tokens | Avg latency |
|---|---|---|---|---|---|
| Photos (`gpt-6-luna`) | 30 | $0.0105 | 44,283 | 12,075 | 11.9 s |
| Speech (`gpt-transcribe` + text) | 29 | $0.0193 | 8,218 | 4,392 | 4.7 s |
| Typed (`gpt-6-luna`) | 67 | $0.0117 | 41,526 | 15,161 | 5.6 s |
| Failed, billed nothing | 2 | $0.0000 | — | — | — |
| **Total** | **128** | **$0.0415** | | | |

The two failures are worth naming. One was a real network timeout to OpenAI
during the accessibility run, and the log shows the new behaviour working as
designed — `timed_out: true, attempt 1`, no retry, an honest error on screen
instead of a 91-second wait. The other was an audio call during an early run.

Latency spread, which is what the timeouts have to be set against:

| Path | Median | p90 | Max | Timeout |
|---|---|---|---|---|
| Typed | 5.5 s | 10.1 s | 17.1 s | 25 s |
| Photo | 10.1 s | 18.0 s | 24.0 s | 45 s |

Every live call is recorded in `ai_usage_logs` with its model, token counts,
estimated cost and latency. The figures are estimates from the published
per-token prices in `config/ai.php`, not OpenAI's bill.

---

## Remaining problems, ranked

Nothing here is a known defect — all sixteen found in this pass are fixed and
covered. These are the gaps between what was tested and what will happen.

### 1. No human has ever spoken into the voice path

Five recordings now go through the browser end to end, but every one was
generated by a text-to-speech voice: clean, evenly paced, no accent, no
background. A kitchen with a radio on, a Nigerian accent, a phone held at
arm's length — none of that has been through it. Transcription quality is the
single largest unknown in the feature.

**What to do:** Kelvin's first session. If the "We heard" line is wrong, the
food list after it will be wrong too, and that is the fastest way to see it.

### 2. The phone camera is untested

Every photograph was chosen from a file. "Take photo" asks the phone for its
camera directly, which cannot be driven from a desktop browser, so that button
has never been pressed in anger. Phone photos also differ from the ones used
here: worse light, steeper angle, EXIF metadata, and much larger files before
the client resizes them.

### 3. Portion estimates are the weakest number on the screen

The food is usually right; the grams are a guess from apparent size in a
photograph. A chicken breast between 120 g and 220 g is a 160-calorie swing on
one row. The weight box on every row is the fix and it is the field most worth
changing, but nothing on screen says *this number is the shakiest one here*.

**Worth considering:** the review screen already marks a doubtful food match.
It does not mark a doubtful portion.

### 4. Typed calls occasionally exceed their 25-second ceiling

Measured over 67 calls: median 5.5 s, p90 10.1 s, max 17.1 s — and one real
timeout. The retry now covers that case (two text attempts fit inside the
browser's 60-second wait), so a single bad moment recovers, but two in a row
still surfaces as an honest failure.

**If it becomes common:** `AI_TEXT_TIMEOUT` is an env var, so raising it needs
no deploy. Do not raise it past 27 — beyond that two attempts stop fitting
inside what the browser waits for, and the retry silently stops happening.

### 5. Branded packaged food matches a generic equivalent

A photograph of a tin of Heinz beans matches the generic baked-beans entry
rather than the product. FoodData Central's branded half is in the local
import only where it overlaps; the dropdown offers brand entries where they
exist, marked `· brand`. For a member who eats a lot of packaged food the
generic figure will usually be close but not theirs.

### 6. Nothing has been deployed

The no-SSH import path is proven in rehearsal against a copy of the real
schema, not on the host itself. The rehearsal covers the failure that would
actually bite — importing on a server where the migrations never ran — but
cPanel's phpMyAdmin is its own build with its own limits, and the first real
import is still the first real import.

### 7. The demo password is still on 31 local accounts

22 member and 9 physician accounts on this machine hash to `password123`,
which is committed to a public repository. `php artisan demo:rotate-passwords`
replaces each with a different random one, printed once.

**Deliberately not run here:** AI_TEST_GUIDE.md signs in with that password,
and rotating it locally would break the guide the day before it is used. It is
for the host, where the exposure is real. The command refuses to run unless the
environment is local and every configured database host is loopback, and there
is no override flag.

---

## What Hassam should do next, in the browser

1. **Speak into it.** Five recordings have gone through, all computer voices.
   Press Speak, say *"two scrambled eggs and a slice of wholemeal toast"*,
   press Stop, and check the "We heard" line matches what you said.
2. **Take a photo with the phone camera.** Every photograph so far was chosen
   from a file. On a phone, press **Take photo**, not Choose photo.
3. **Photograph a fry-up** and check the egg. It should say fried, not
   hard-boiled.
4. **Open the "Which food" dropdown on every row at least once.** It is the
   feature that makes a wrong first guess harmless, and the thing most likely
   to be ignored.
5. **Add one of your own foods to a photographed meal** — "Add another food" at
   the bottom of the review screen. It should ask for servings, not grams.
6. **Turn it off in Settings and back on.** The notice should come back.

Everything in `AI_TEST_GUIDE.md` still applies; §4's table is now correct
rather than carrying warnings about foods that have since been fixed.
