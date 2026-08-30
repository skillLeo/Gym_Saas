# My EXtreme Trainer — Manual Testing Guide

This guide walks through every page and every interactive element across all 7 completed phases. Follow it top to bottom before showing the client. Every section ends with a Yes/No sign-off checklist.

---

## Before You Start

### Start the servers

**Backend (Laravel API) — must be running on port 8000:**
```
cd c:\xampp\htdocs\Gym_Saas
php artisan serve
```
(Or, if using XAMPP Apache/MySQL instead of `artisan serve`, just start Apache + MySQL from the XAMPP control panel — the API is already configured to serve from this directory.)

**Frontend (Next.js) — must be running on port 3000, production mode:**
```
cd c:\xampp\htdocs\Gym_Saas\frontend
npm run build
npm run start
```
Do **not** use `npm run dev` for client testing — always test the production build (`build` + `start`), since that's what the client will actually see.

Once both are running:
- App: **http://localhost:3000**
- API: **http://localhost:8000/api**

### Test accounts

| Role | Email | Password |
|---|---|---|
| Member (regular user, has sample data already logged) | `claudeone052@gmail.com` | `TestPass123!` |
| Admin (for Groups approval, video upload, live sessions) | `kelvin@myextremetrainer.com` | `AdminPass123!` |

You'll need **both** accounts — some checks (messaging another user, admin approval of a group) require switching between them. Consider using two different browsers (or one regular + one incognito window) so you can be logged into both at once.

### General notes before testing
- Test on both **light and dark mode** (toggle is in the sidebar/nav) at least once per phase.
- Test on **desktop width** and **mobile width** (use browser dev tools device toolbar, or resize to ~375px wide) — each phase section below has a dedicated mobile checklist.
- Whenever a checklist says "confirm persistence," it means: do the action, then **log out completely** (Settings → Sign Out), **log back in**, navigate back to the same page, and confirm the data is still there. Don't just refresh the page — a logout/login cycle is the real test.

---

## PHASE 1 — Public Homepage

**URL:** `http://localhost:3000/` (log out first, or use an incognito window — this is the public marketing page)

### Elements to test

1. **Top banner** — orange strip at the very top ("🔥 Limited Offer..."). Click "Claim Your Spot →" → should go to `/auth/register`.
2. **Sticky navbar**
   - Logo (top-left "MX" badge + "My EXtreme Trainer") → click it → returns to `/`.
   - Nav links: About, Features, Results, Pricing → each should smooth-scroll to that section on the same page.
   - Dark/light toggle icon → toggles theme immediately.
   - "Sign In" → goes to `/auth/login`.
   - "Start Free Trial" → goes to `/auth/register`.
   - Resize to mobile width → nav links disappear, hamburger icon (☰) appears. Click it → mobile menu slides open with all links + Sign In + Start Free Trial. Click ✕ → closes.
3. **Hero section** — headline, background image, "Start Your Free Trial" button (→ register), "See How It Works" button (→ scrolls to Features).
4. **Stats strip** — orange bar with 4 numbers (10,247+ Active Members, etc.) — just visual, no interaction needed.
5. **About section** — Kelvin Silas bio, photo, "Join Team Extreme Today" button → register.
6. **Lifestyle photo grid section** — purely visual, confirm images load (no broken image icons).
7. **"A Day in Your Life" strip** — 6 small cards, visual only.
8. **Features section** (dark background) — 6 feature cards (Food Journal, Workout Tracker, Social Community, AI Trainer, Recipe Library, Smart Planner) + the orange "Premium Power Features" strip below it with 8 icons.
9. **Community faces strip** — avatar row + "Join the Community" button → register.
10. **Results/Testimonials section** — 3 testimonial cards with star ratings, "I'm Ready to Transform" button → register.
11. **Photo gallery** — 6-image grid, hover shows captions.
12. **App preview section** — phone mockup graphic, visual only.
13. **Free Fitness Videos section** — 4 video preview cards. **Click any card** → a modal should open showing "Video Coming Soon" with a "Get Full Access" button (→ register) and a "Close" button. Confirm the modal opens and closes correctly.
14. **Pricing section** — 3 plan cards (Basic, Premium, Annual VIP). Toggle "Monthly"/"Annual" switch → prices should recalculate. Each card's "Start Free Trial" button → register.
15. **Final CTA section** — "Start My Free Trial" → register.
16. **Footer** — 4 columns (brand, Platform links, Company links, Contact). All links under "Platform" go to register. Social icons (F/IG/YT/TW) are placeholders — clicking does nothing harmful (href="#"), that's expected.

### Font check
The site uses a fallback serif font for headings right now (Playfair Display) instead of the final "Posey Textured" brand font — **this is expected and pending** until the licensed font file is provided. Not a bug to report.

### Mobile responsiveness checklist (resize browser to ~375px wide)
- [ ] Hamburger menu appears and works
- [ ] Hero headline doesn't overflow or get cut off
- [ ] Feature cards stack to 1 column
- [ ] Pricing cards stack to 1 column, all 3 fully readable
- [ ] Photo gallery grid still displays without horizontal scroll
- [ ] Footer columns stack cleanly

### Phase 1 Sign-Off
- [ ] Navbar, hero, about, features, pricing, testimonials, gallery, footer all render correctly — **YES / NO**
- [ ] Every button/link on the page navigates correctly — **YES / NO**
- [ ] Free Fitness Videos section shows cards and modal opens/closes — **YES / NO**
- [ ] Mobile view passes the checklist above — **YES / NO**
- [ ] Dark mode toggle works and looks correct — **YES / NO**

---

## PHASE 2 — User Accounts & Food Journal

### 2A. Registration & Login

**URL:** `/auth/register`
1. Fill in name, email (use a fresh email you haven't used before), password, confirm password. Submit.
2. Expected: account created, 30-day trial starts automatically, redirected into onboarding.
3. Log out. Go to `/auth/login`, log back in with the same new account — should land on dashboard (onboarding already done) or onboarding (if you skipped it).

**URL:** `/auth/login`
4. Try logging in with an intentionally wrong password. Expected: a clear inline error message appears above the form (not a toast that vanishes instantly), and your email stays filled in while only the password clears.
5. Log in correctly with the test member account: `claudeone052@gmail.com` / `TestPass123!`.

**URL:** `/auth/forgot-password`
6. Enter a real email you can check, submit. Expected: confirmation message on screen, and (if SMTP is configured) an actual email arrives with a reset link.

**URL:** `/auth/reset-password` (via the emailed link)
7. Set a new password, submit. Expected: success message, redirected to login, new password works.

### 2B. Onboarding

**URL:** `/auth/onboarding` (only shown to new accounts, or navigate here directly to re-test)
1. **Step 1 — Profile photo**: click the circular camera icon → file picker opens → select an image → confirm it uploads and displays as your new profile photo (a spinner shows briefly during upload).
2. **Step 2 — Goals**: click 1+ goal tiles (they highlight when selected). Click Continue.
3. **Step 3 — Stats**: fill in weight, height, age, gender, activity level, drag the calorie slider. Click Finish Setup.
4. **Step 4 — Done**: click "Go to My Dashboard" → lands on `/dashboard`.
5. **Persistence check**: log out, log back in, go to `/profile` → confirm your goal/stats from onboarding are saved.

### 2C. Dashboard

**URL:** `/dashboard`
1. **4 navigation tiles** at the top (Exercise & Fitness, Diet & Meal Plans, Cooking & Recipes, Calendar) — click each, confirm it navigates to `/fitness`, `/food-journal`, `/recipes`, `/calendar` respectively.
2. **Today's Nutrition card** — ring chart + macro bars. Click "View Log" → goes to `/food-journal`.
3. **Food Log preview** — shows today's logged meals (or "No food logged today"). "Add Food" button → `/food-journal`.
4. **Today's Fitness card** — shows workout count/calories burned, or empty state. "Log Workout" → `/fitness`.
5. **Water Intake card** — click "+ Glass" a few times, confirm the counter and glass icons fill in. Click "−" to remove one.
6. **Free Trial card** (if on trial) — shows days remaining ring, "Upgrade" button → `/membership`.
7. **Quick Stats card** — weight/goal weight/daily calorie goal. "Update Stats" → `/profile`.
8. **Today's Calendar preview** — shows any events logged for today (workouts/meals auto-populate here — see Phase 6 for the full test). "View" → `/calendar`.
9. **From Your Feed preview** — shows your latest 1-3 followed posts, or an empty state with "Explore Community" button. "View" → `/social`.
10. If logged in as the **admin** account, confirm the blue "Super Admin Access" banner appears with Admin Panel / Manage Users / API Keys shortcuts.

### 2D. Food Journal — the core feature, test thoroughly

**URL:** `/food-journal`
1. **Date navigator** — click ◀ to go to yesterday, confirm the food log for that date loads (should differ from today's). Click ▶ to return; ▶ should be disabled/greyed out once you're back on today (can't log future days).
2. **Daily Summary card** — ring chart + macro bars should reflect whatever is logged for the selected date.
3. **Manage Meals** — click "Manage Meals" (top right of the Meals section).
   - Confirm you see 6 default slots: **Meal 1, Snack 1, Meal 2, Snack 2, Meal 3, Snack 3** (not "Breakfast/Lunch/Dinner/Snacks").
   - **Rename**: click the pencil icon next to any slot, type a new name (e.g. "Post-Workout"), press the checkmark. Confirm it saves and the modal shows the new name.
   - **Add**: type a new slot name in the bottom input (e.g. "Late Night Snack"), click Add. Confirm a new slot appears in the food journal list.
   - **Delete**: click the trash icon on a slot you don't need. Confirm it disappears. Try deleting slots down to just one — the last remaining slot's delete button should be disabled (can't delete the only slot).
   - Close the modal.
4. **Add food to a meal slot**: expand any meal slot (click its row), click "Add Food", type a search term (e.g. "chicken"). Confirm results appear. Click a result.
   - In the picker that opens: confirm a **photo** section is visible with a suggested image and an "Upload your own" option. Try uploading your own photo — confirm it replaces the suggested one.
   - Adjust servings with +/− buttons, confirm the macro numbers at the top recalculate live.
   - Click "Add to Meal". Confirm it appears in the slot's entry list with calories, macros, and the photo you picked.
5. **Search "zzzzzznotreal"** (nonsense text) — confirm "No foods found" appears, not a stale list of unrelated foods.
6. **Delete a logged entry** — click the trash icon on any entry in the list, confirm it disappears and the daily totals update downward.
7. **Water tracker** (bottom of page):
   - Confirm it shows **ounces**, not glasses, with a goal like "0 / 64oz".
   - Try the amount presets (4oz / 8oz / 12oz / 16oz) — click a couple, confirm the "+ Add Xoz" button label updates to match.
   - Type a custom amount into the number box (e.g. 10), confirm the Add button updates to "+ Add 10oz".
   - Click "+ Add", confirm the running total increases by that amount and the progress bar fills.
   - Click "−" to subtract.
8. **Quick Log buttons** — Scan Barcode, Photo Log, Voice Log (see below).

**URL:** `/food-journal/barcode`
9. Enter any barcode number manually (Nutritionix isn't configured, so this is a mock/sample data path — confirm it doesn't crash, either shows "Product not found" or sample results).
10. If a result appears: pick a meal slot from the pills shown (should match your actual custom slot names from step 3), adjust servings, click "Add to [slot name]". Confirm success message names the correct slot.

**URL:** `/food-journal/voice-log`
11. Type a phrase like "I had two eggs and toast" into the text box (voice recognition may not work in all browsers — typing is the fallback). Click "Parse Food Items".
12. If results appear, confirm the meal-slot pills match your real custom slots, pick one, log an item, confirm success.

**URL:** `/food-journal/photo-log`
13. Select any image file as a "photo", then type a description like "grilled chicken and rice". Click "Calculate Nutrition".
14. If results appear, confirm meal-slot pills match your real slots, log an item.

**URL:** `/food-journal/history`
15. Confirm a chart renders (not blank) and shows non-zero data for days where you actually logged food. Switch between 7D / 14D / 30D and Calories / Macros tabs.

**Persistence check for all of Phase 2D:**
- [ ] Log out, log back in, revisit `/food-journal` — confirm your renamed/added/deleted meal slots are still exactly as you left them.
- [ ] Confirm the food entries you added are still there with the correct photos.
- [ ] Confirm the water ounces total for today is unchanged.

### 2E. Account Settings

**URL:** `/profile/settings`
1. **Accent Color** — click a different color swatch. Confirm the "Sample Button" preview above the list immediately changes to that color.
2. Toggle Dark Mode, Navigation Layout (Top/Sidebar), notification toggles, privacy toggles — confirm each responds visually.
3. **Persistence check**: log out, log back in, revisit Settings — confirm your accent color choice and toggle states are still set as you left them.
4. Sign Out button — confirm it actually logs you out and redirects to login.

**URL:** `/profile/edit`
5. Update your name, bio, password. Confirm each saves with a success toast.

### Mobile responsiveness checklist (Phase 2)
- [ ] Dashboard tiles stack to 2 columns, remain tappable
- [ ] Food journal meal slot cards are fully readable, "Add Food" search modal usable on small screen
- [ ] Manage Meals modal doesn't overflow the screen
- [ ] Water tracker buttons remain tappable and not cramped
- [ ] Onboarding steps are fully visible without horizontal scrolling

### Phase 2 Sign-Off
- [ ] Registration, login (with correct inline error handling), logout, forgot/reset password all work — **YES / NO**
- [ ] Onboarding 4 steps complete including real photo upload — **YES / NO**
- [ ] Dashboard shows 4 tiles + real calendar preview + real social feed preview — **YES / NO**
- [ ] Meal slots default to Meal 1/Snack 1/etc. and can be renamed, added, deleted — **YES / NO**
- [ ] Food search, custom logging, and macro/calorie tracking all work — **YES / NO**
- [ ] Water tracker uses adjustable ounces (8oz default, 16oz max per entry) — **YES / NO**
- [ ] Food photo picker (suggested + upload) works and saves with the entry — **YES / NO**
- [ ] Barcode/voice/photo logging all use your real custom meal slots — **YES / NO**
- [ ] Nutrition history chart shows real data — **YES / NO**
- [ ] Account settings incl. new accent color picker work and persist — **YES / NO**
- [ ] All of the above survives a full logout/login cycle — **YES / NO**

---

## PHASE 3 — Social Feed & Community

### 3A. Main Feed

**URL:** `/social`
1. **Post composer** at the top — type text, click the "Photo" button, select an image file from your computer. Confirm a real preview thumbnail appears (not a URL text box). Click ✕ on the preview to remove it, or click "Share" to post.
2. Confirm your new post appears at the top of the feed immediately with your avatar, name, timestamp, content, and photo.
3. **Reactions** — hover/click the Like button on any post, confirm the emoji reaction picker pops up (👍❤️🔥😍💪🎉), pick one, confirm it registers and the count updates.
4. **Comments** — click the comment icon, type a reply, submit, confirm it appears threaded under the post.
5. **Tabs** — switch between "For You" and "Following" — confirm the feed changes (Following should only show posts from people you follow).
6. Delete one of your own posts (trash icon) — confirm it's removed.

### 3B. Explore & Friends

**URL:** `/social/explore`
1. Search for a member by name. Confirm results show photo, name, mutual connections, and a Follow button.
2. Follow someone — button should change to "Following".

**URL:** `/social/friends`
1. Confirm this shows people you follow, with unfollow option.

### 3C. Profile Page (the big one)

**URL:** `/social/[your-username]` (click your own avatar/name anywhere, or go to `/profile` and it should route you here — or find your username in Settings)
1. Confirm **cover photo banner** with your **circular avatar overlapping** it (PeepSo-style layout).
2. Confirm 5 tabs: **Stream, About, Friends, Followers, Groups**.
   - **Stream** — your posts.
   - **About** — bio, goal, stat cards (followers/following/posts/workouts).
   - **Friends** — people you follow.
   - **Followers** — people following you.
   - **Groups** — see 3D below.
3. Click "Edit Profile" (only visible on your own profile) → goes to `/profile/edit`.

**Now open a second browser/incognito window, log in as the admin account, and visit the member's profile** (`/social/clude249` or whatever the member's username is):
4. Confirm you see **Follow** and **Message** buttons (not Edit Profile, since it's not your own profile).
5. Click **Follow** — confirm it toggles to "Following".
6. Click **Friends** tab — confirm it shows *that member's* following list, not your own (this was a bug that's now fixed — double-check it's really showing their list).
7. Click **Followers** tab — same check, should show *their* followers, not yours.
8. Click **Message** — see Phase 5, this should open a real conversation with that specific person.

### 3D. Groups

**On the member account**, go to your own profile → **Groups** tab:
1. Click "Create a Group". Fill in a name and description. Submit.
2. Confirm you immediately see this exact toast message pop up (word for word):
   > "We will review your group request as soon as possible. Please be patient. If we have any questions or concerns regarding your group we will send you a direct message. 🙂 Thank you!"
3. Confirm your new group now appears in the Groups tab list with a **"Pending Approval"** badge.

**Switch to the admin account**, go to `/admin/moderation`:
4. Confirm a "Pending Group Approvals" section is visible at the top, listing the group you just created with its name, creator, and description.
5. Click **Approve**. Confirm it disappears from the pending list.

**Back on the member account**, refresh the Groups tab:
6. Confirm the group's badge changed from "Pending Approval" to showing a real member count (no longer pending).

*(Optional: repeat creating a second test group and click Reject instead, to confirm the reject flow also works and shows a rejection reason if one is given.)*

### 3E. Achievement / Billboard Sharing

**URL:** `/profile` (your own account settings/edit page — look for the "Digital Billboard" section)
1. Type a custom message, pick a font, text color, and background color — confirm the live preview box updates as you change each.
2. Click **"Share as Post"**. Confirm a success toast appears ("Shared to your community feed!").
3. Go to `/social` — confirm your billboard message now appears as an actual photo post in the feed (it renders your text/colors as an image).

**URL:** `/ai-trainer/achievements`
4. Browse your achievement badges (earned vs locked). This page itself doesn't have a direct share button today — achievement-style sharing is done through the Digital Billboard feature you just tested above, which is the mechanism used for posting any achievement-style graphic to the feed.

### Mobile responsiveness checklist (Phase 3)
- [ ] Profile cover/avatar layout doesn't break on narrow screens
- [ ] All 5 profile tabs are reachable (scroll if needed) and readable
- [ ] Post composer and image upload work on mobile
- [ ] Reaction picker popup doesn't get cut off at screen edges
- [ ] Create Group modal fits on screen

### Phase 3 Sign-Off
- [ ] Feed posting with real photo upload works — **YES / NO**
- [ ] Reactions, comments, follow/unfollow all work — **YES / NO**
- [ ] Explore/search finds members correctly — **YES / NO**
- [ ] Profile page shows cover+avatar layout and all 5 tabs — **YES / NO**
- [ ] Friends/Followers tabs show the *correct person's* lists when viewing someone else's profile — **YES / NO**
- [ ] Group creation shows the exact client-approved popup text — **YES / NO**
- [ ] Admin can see and approve/reject pending groups — **YES / NO**
- [ ] Billboard "Share as Post" creates a real post visible in the feed — **YES / NO**
- [ ] Everything survives logout/login — **YES / NO**

---

## PHASE 4 — Fitness Tracker

**URL:** `/fitness`
1. **This Week strip** — 7 day circles, today's should be highlighted/checked if you've logged a workout today. Workouts/Minutes/Calories stats below should be non-zero after logging.
2. **Daily Steps** — click "Update", type a step count (e.g. 8500), Save. Confirm the number, progress bar, and "Remaining" stat all update.
3. Quick nav cards: Goals, History, Body Stats, Streak — confirm each navigates correctly.

**URL:** `/fitness/log-workout`
4. Enter a workout name, pick a type (Strength).
5. Add an exercise, add 2-3 sets with reps and weight filled in, mark one "done".
6. Fill in Duration and/or Calories Burned.
7. Click "Save Workout". Confirm success message and redirect to `/fitness`.
8. **Now test Cardio**: log another workout, pick type "Cardio", fill in Distance (miles), Duration. Save.

**URL:** `/fitness/history`
9. Confirm the stats cards (Workouts, Avg Cal, Total Cal, Minutes) show real non-zero numbers matching what you just logged.
10. Switch the chart between Calories / Duration / Workouts. Switch date range 7D/30D/3M.
11. Scroll to the workout list below — confirm your logged workouts appear with correct type badges. Delete one, confirm it's removed and stats adjust.

**URL:** `/fitness/body-stats`
12. Click "Log Stats". Fill in Weight, Body Fat %, and **all 5 measurements** (Chest, Waist, Hips, Thighs, Arms). Save.
13. Confirm the 3 top stat cards (Weight/Body Fat/Waist) update.
14. Confirm the "Body Measurements" card at the bottom shows real numbers (not "—") for all 5 measurements.
15. Confirm the Progress Chart renders with a readable date on the X-axis (e.g. "07-26", not a long timestamp string).
16. Log stats again on a later date (or wait a day) — confirm the change indicators (▲/▼ with color) appear once there are 2+ entries.

**URL:** `/fitness/goals`
17. **Quick Add** section — click each preset (Target Weight, Target Body Fat, Daily Calorie Goal, Weekly Workout Frequency, Daily Steps Goal). Confirm each opens the Add Goal modal pre-filled with a sensible title/unit — fill in a target value and save.
18. Click "Custom Goal" — create a free-text goal with your own title.
19. Confirm all goals appear in the list with progress bars. Mark one complete (checkmark), confirm it moves to completed state.
20. **BMI Calculator** — enter height/weight, click Calculate BMI, confirm a result with category (Underweight/Normal/Overweight/Obese) appears.

**URL:** `/fitness/streak`
21. Confirm "Current Streak" shows at least 1 day (since you logged a workout today).
22. Confirm "Best Streak", "Total Workouts", "This Month" all show real numbers.
23. Confirm the Activity heatmap grid shows highlighted cells for days you've worked out.

**Persistence check:**
- [ ] Log out, log back in, revisit `/fitness/history` and `/fitness/body-stats` — confirm every workout and measurement you logged is still there.

### Mobile responsiveness checklist (Phase 4)
- [ ] Log Workout exercise/set rows remain usable on narrow screens
- [ ] Body stats measurement grid doesn't overflow
- [ ] Goals quick-add tiles wrap to 2 columns cleanly
- [ ] Streak heatmap grid is scrollable/visible without breaking layout

### Phase 4 Sign-Off
- [ ] Strength workouts save sets/reps/weight (not just a summary) — **YES / NO**
- [ ] Cardio workouts save distance — **YES / NO**
- [ ] Daily steps tracker persists real numbers — **YES / NO**
- [ ] Body stats save all 5 measurements (not just weight/fat/waist) — **YES / NO**
- [ ] Goals support both quick-add typed presets and custom free-text goals — **YES / NO**
- [ ] BMI calculator works — **YES / NO**
- [ ] Workout history and streak show accurate real numbers — **YES / NO**
- [ ] Everything survives logout/login — **YES / NO**

---

## PHASE 5 — Private Messaging

**URL:** `/messages`
1. Click the "New Message" (person+) icon, search for the admin account by name, click them to start a conversation.
2. Type a message, send it — confirm it appears on the **right** in an orange bubble.
3. **Photo attachment**: click the paperclip icon, select an image, confirm a small preview appears above the input before sending. Send it — confirm the image renders inline in the chat bubble.
4. **From the other account** (admin, logged in separately), open `/messages` — confirm the new conversation appears in the inbox with an unread badge, correct last-message preview, and timestamp. Open it, confirm the same message/image appears on the **left** in a white bubble.
5. Reply from the admin account. Switch back to the member account — within a few seconds (polling), confirm the reply appears without manually refreshing.
6. Go back to `/social/[admin-username]` on the member account, click the **Message** button on their profile. Confirm it opens the *same existing conversation* with that specific person (not a blank new one, not the generic inbox).

**Persistence check:**
- [ ] Log out, log back in, open `/messages` — confirm the conversation and all messages (including the photo) are still there.

### Mobile responsiveness checklist (Phase 5)
- [ ] Inbox list and chat view both usable on narrow screens (may switch to single-column mobile layout)
- [ ] Photo attachment picker and preview work on mobile
- [ ] Message bubbles wrap correctly and don't overflow screen width

### Phase 5 Sign-Off
- [ ] Can start a new conversation via search — **YES / NO**
- [ ] Messages show correctly on left/right based on sender — **YES / NO**
- [ ] Near-real-time updates work without manual refresh — **YES / NO**
- [ ] Photo attachments send and display correctly — **YES / NO**
- [ ] Profile "Message" button opens the correct specific conversation — **YES / NO**
- [ ] Unread badges and inbox previews are accurate — **YES / NO**
- [ ] Everything survives logout/login — **YES / NO**

*(Known limitation — not a bug: there is no date-range search/filter inside the inbox yet. Don't test for this; it was never built.)*

---

## PHASE 6 — Calendar & Recipes

### 6A. Calendar

**URL:** `/calendar`
1. Confirm the **workout(s) and food entries you logged in Phases 2 and 4 today already appear automatically** on today's date in Month view (look for 🏋️ and 🍽️ prefixed entries) — this proves the auto-populate feature works.
2. Switch between **Month / Week / Agenda** views (top toggle) — confirm all three actually render real data, not placeholders.
3. Click "Add Event" — fill in a title, date, time, pick a **type** (Workout/Meal/Appointment/Personal/Other), and pick a **custom color** from the swatches. Save. Confirm the event appears on the calendar in the color you picked (not just the default type color).
4. Click into a day with events — confirm the detail panel below the calendar lists them, and you can delete a *manually created* event (the trash icon should **not** appear on the auto-populated workout/food entries, since those aren't editable here — they're a live mirror of your logs).
5. Click the 3 quick-nav cards: Meal Plan, Shopping, To-Do — confirm each switches to that tab within the same page.

**URL:** `/calendar/meal-planner`
6. Pick an empty meal slot for any day, click it, search for a real recipe by name, select one. Confirm it now shows in that day/slot with the recipe name.
7. Remove it with the ✕.

**URL:** `/calendar/shopping-list`
8. Manually add an item (name + quantity + category). Confirm it appears grouped under the right category.
9. Check off an item, confirm strikethrough. Click "Clear checked items", confirm it's removed.
10. Click **"Generate"** (in the "Auto-generate your list" banner) — this pulls ingredients from your current week's meal plan. Confirm new items appear, grouped into Produce/Dairy/Meat/Pantry categories automatically.

**URL:** `/calendar/todo`
11. Add a task with a priority and due date. Confirm it appears in the list with the correct priority color and date.
12. Check it off, confirm strikethrough + progress bar updates. Delete it.

**Persistence check:**
- [ ] Log out, log back in, revisit `/calendar`, `/calendar/shopping-list`, `/calendar/todo` — confirm everything you added is still there.

### 6B. Recipes

**URL:** `/recipes`
1. Browse the library, confirm images, categories, calories, and **difficulty** (Easy/Medium/Hard) all show on each card.
2. Search by name. Click "More Filters" — confirm you can search by **ingredient**, filter by **difficulty**, and set a **calorie range**. Try filtering by ingredient "chicken" and confirm only matching recipes show.
3. Click a recipe card — a quick-view modal opens. Adjust servings, confirm it's respected when you click "Log to Food Journal" (pick one of your real meal slots first).
4. Save a recipe (bookmark icon) — confirm the icon fills in.
5. Click "Add to Meal Plan" on a recipe from this modal — pick a day/slot, confirm success message mentions ingredients were also added to your shopping list. Check `/calendar/shopping-list` to confirm.

**URL:** `/recipes/[recipeId]` (click through to a full recipe page from the library)
6. Confirm ingredients list, step-by-step instructions, and full nutrition are shown.
7. Use the serving-size +/− stepper — confirm every ingredient quantity recalculates live.
8. "Log to Food Journal" — pick a meal slot, confirm it logs with macros scaled to your chosen serving size (check `/food-journal` afterward to confirm the calories match).
9. "Add to Meal Plan" — pick day/slot, confirm the same shopping-list side effect as above.

**URL:** `/recipes/create`
10. Fill in name, category, **difficulty**, description, prep/cook time, servings, nutrition, at least one ingredient, at least one instruction step. Toggle "Public" on/off. Save.
11. Confirm it now appears in `/recipes` (if public) or only in your own list (if private).

**URL:** `/recipes/saved`
12. Confirm your bookmarked recipes appear here.

**Persistence check:**
- [ ] Log out, log back in, check `/recipes/saved` and `/food-journal` — confirm saved recipes and any recipe-logged food entries are still there.

### Mobile responsiveness checklist (Phase 6)
- [ ] Calendar month grid remains legible on narrow screens (may need horizontal scroll for month view, that's acceptable)
- [ ] Recipe cards stack to 1 column
- [ ] Recipe detail ingredient list and serving stepper remain usable
- [ ] Shopping list category groups don't overflow

### Phase 6 Sign-Off
- [ ] Workouts and food logs auto-appear on the calendar — **YES / NO**
- [ ] All 3 calendar views work, custom event colors work — **YES / NO**
- [ ] Meal planner, shopping list, and to-do all use real saved data — **YES / NO**
- [ ] Shopping list "Generate" pulls real ingredients from the meal plan, categorized — **YES / NO**
- [ ] Recipes show difficulty and support ingredient/calorie-range search — **YES / NO**
- [ ] Recipe serving adjuster recalculates ingredients live — **YES / NO**
- [ ] Logging a recipe updates the food journal with correctly scaled macros — **YES / NO**
- [ ] Adding a recipe to the meal plan also adds ingredients to the shopping list — **YES / NO**
- [ ] Custom recipe creation and saved recipes work — **YES / NO**
- [ ] Everything survives logout/login — **YES / NO**

---

## PHASE 7 — Video Library & Live Classes

### 7A. Video Library (member view)

**URL:** `/videos`
1. Confirm videos display with title, category, difficulty.
2. Use the search box, the Difficulty dropdown, and the new **Muscle Group** dropdown — confirm each filters the list correctly, including combinations of filters together.
3. Click a video to open its detail page — confirm title, description, and targeted muscle groups are shown.
4. Save/bookmark a video, confirm it appears under your saved videos.

### 7B. Admin Video Management

**Log in as admin.** **URL:** `/admin/videos`
1. Click to add a new video. Fill in title, category, difficulty, description, muscle groups.
2. **Upload a real thumbnail image file** (this previously crashed with an error — confirm it now uploads successfully and shows a preview before you save).
3. Save. Confirm the new video appears in the list and is visible on the member-facing `/videos` page.
4. Delete a video, confirm it's removed (soft-deleted / hidden from members).

### 7C. Live Classes

**Log in as admin.** **URL:** `/admin/live`
1. Create/schedule a live session with a title.
2. Click "Go Live" (transition status to live).
3. **Switch to the member account**, check `/notifications` — confirm a new notification appears announcing the live session (🔴 Live now: [title]).

**URL:** `/live` (member view)
4. Confirm the live session shows as currently live.
5. Post a comment during the "live" session — confirm it appears in the comment feed within a few seconds (polling), and confirm the like button works.

**Back on admin**, end the session (status → ended):
6. Confirm it now appears in the Replays list on `/live`.

*(Known limitation — not a bug: there's no real video/audio streaming yet — "Going Live" is a status flag with real chat/notifications/replay listing behind it, but no actual video feed. This requires a streaming provider (Mux/Vimeo/Agora) to be chosen and configured, which is a separate scope decision, not a bug.)*

### Mobile responsiveness checklist (Phase 7)
- [ ] Video grid stacks to 1-2 columns on mobile
- [ ] Video filter dropdowns remain usable on small screens
- [ ] Live chat/comment box usable on mobile
- [ ] Admin video/live forms don't overflow on mobile (admin is typically used on desktop, but should still not be broken)

### Phase 7 Sign-Off
- [ ] Video library filters (search, difficulty, muscle group) all work — **YES / NO**
- [ ] Admin can upload a video with a real thumbnail image without errors — **YES / NO**
- [ ] Going live triggers a real notification to members — **YES / NO**
- [ ] Live comments and likes work in near real-time — **YES / NO**
- [ ] Ended sessions appear in the replay list — **YES / NO**
- [ ] Everything survives logout/login — **YES / NO**

---

## Final Project Sign-Off

| Phase | Sign-off |
|---|---|
| 1 — Public Homepage | ☐ Pass ☐ Fail |
| 2 — Accounts & Food Journal | ☐ Pass ☐ Fail |
| 3 — Social Feed & Community | ☐ Pass ☐ Fail |
| 4 — Fitness Tracker | ☐ Pass ☐ Fail |
| 5 — Private Messaging | ☐ Pass ☐ Fail |
| 6 — Calendar & Recipes | ☐ Pass ☐ Fail |
| 7 — Video Library & Live Classes | ☐ Pass ☐ Fail |

### Known limitations to mention to the client (not bugs — disclosed scope gaps)
1. **Posey Textured font** isn't active yet — needs the licensed font file added to the project.
2. **Real live video/audio streaming** isn't built — "Going Live" currently drives real chat, notifications, and replay history, but the video feed itself needs a streaming provider (e.g. Mux, Vimeo, Agora) selected and integrated.
3. **Message search by date range** inside the inbox hasn't been built.

If every checkbox above is Pass and you're comfortable with the 3 known limitations being communicated to the client as a "Phase 8 / next steps" item, the project is ready to hand off.
