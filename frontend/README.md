# My EXtreme Trainer

> A full-featured SaaS fitness and health platform combining nutrition tracking, workout logging, AI coaching, social community, and membership management — all in one responsive web application.

---

## Overview

**My EXtreme Trainer** is a comprehensive SaaS fitness platform built with **Laravel (PHP)** and **MySQL**, designed to run as a single responsive web application across desktop, tablet, and mobile. Users can save the platform to their phone home screen and experience it exactly like a native app — full screen, no browser bar — without the cost or complexity of separate iOS and Android builds.

The platform is operated under the **Team Extreme** fitness brand and combines the core experiences of six industry-leading products into one unified system:

| Inspiration | Feature Area |
|---|---|
| MyFitnessPal + SparkPeople | Food journal and nutrition tracking |
| Fitbod + Female fitness apps | Workout logging and fitness tracking |
| Cozi | Calendar, meal planning, and organization |
| CookedPro + AllRecipes | Recipe library and meal prep |
| Facebook + Instagram + PeepSo | Social community and private messaging |
| ChatGPT + DALL-E | AI coaching and image generation |

Everything on the platform is deeply interconnected. A recipe saved in the library links to the meal planner. The meal planner links to the calendar. The calendar links to the shopping list. A workout logged in the fitness tracker appears on the calendar. When a milestone is reached, a personalized achievement poster is auto-generated and shared to the social feed. Every module works as part of one cohesive system.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Core Features](#core-features)
  - [Public Homepage](#1-public-homepage)
  - [User Accounts and Dashboard](#2-user-accounts-and-dashboard)
  - [Food Journal and Nutrition Tracker](#3-food-journal-and-nutrition-tracker)
  - [Fitness Tracker](#4-fitness-tracker)
  - [Social Feed and Community](#5-social-feed-and-community)
  - [Private Messaging System](#6-private-messaging-system)
  - [Calendar and Organization Tools](#7-calendar-and-organization-tools)
  - [Recipes Section](#8-recipes-section)
  - [Membership and Subscription System](#9-membership-and-subscription-system)
  - [AI Fitness and Diet Planner](#10-ai-fitness-and-diet-planner)
  - [AI Image Generation Features](#11-ai-image-generation-features)
  - [Admin Panel](#12-admin-panel)
- [External API Integrations](#external-api-integrations)
- [Membership and Pricing Model](#membership-and-pricing-model)
- [Mobile Experience](#mobile-experience)
- [Development Phases](#development-phases)
- [Project Structure](#project-structure)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Framework | Laravel (PHP) |
| Database | MySQL |
| Frontend | Blade Templates, HTML, CSS, JavaScript |
| Payment Processing | Stripe |
| Email Service | Mailgun / SendGrid |
| AI / NLP | OpenAI ChatGPT API (GPT-4), OpenAI Whisper |
| AI Image Generation | OpenAI DALL-E API, OpenAI Vision API |
| Nutrition Data | Nutritionix API / USDA FoodData Central API |
| Barcode Scanning | Open Food Facts API / Barcode Lookup API + QuaggaJS / ZXing |
| Grocery Sync | Instacart API (or clipboard/PDF export fallback) |
| Voice Input | Browser Speech Recognition API |
| Typography | Posey Textured Regular |
| Brand Colors | `#0000FF` Blue · `#F87404` Orange · `#FF5C04` Dark Orange · `#FF0404` Red · `#FFC000` Yellow · `#004AAD` Light Blue |

---

## Core Features

### 1. Public Homepage

The public-facing homepage serves as the primary sales and conversion page. It is fully responsive, fast-loading, and visually designed to convert visitors into registered users.

**Sections included:**
- **Sticky Navigation Bar** — Logo on the left, navigation links in the center, Login and Get Started buttons on the right. Collapses into a hamburger menu on mobile.
- **Hero Section** — Full-screen height on desktop with a dark-overlaid group fitness photo as background, bold headline in Posey Textured font, and a prominent call-to-action button.
- **About Section** — Introduction to the coach and brand story.
- **Services and Features Section** — Icon grid layout showcasing all platform modules: Food Journal, Fitness Tracker, Social Community, AI Trainer, Recipes, and Calendar.
- **Dashboard Preview** — A visual mockup of the member dashboard to show visitors what the inside of the platform looks like.
- **Pricing Section** — Three membership tier cards styled similarly to the MyFitnessPal Premium page, with a 30-day free trial badge.
- **Testimonials Section** — Member reviews with photo, name, and quote.
- **Photo Gallery** — Grid or masonry layout of fitness photography.
- **Free Fitness Videos** — Embedded or linked YouTube videos providing a pre-signup content preview.
- **Footer** — Complete navigation links, social media icons, contact email, copyright notice, and legal links.

---

### 2. User Accounts and Dashboard

**Registration and Onboarding**

New users register with first name, last name, email, and password only. No credit card is required. Upon registration, a 30-day free trial begins automatically and the user is redirected through a personalized onboarding flow where they:

- Upload a profile photo (optional)
- Select their fitness goals (weight loss, muscle building, improved stamina, healthier eating, or a combination)
- Enter current weight, height, age, and activity level
- Set a daily calorie goal or accept a system-suggested one

**Authentication**

Standard email and password login with a Remember Me option and a Forgot Password flow handled via Mailgun or SendGrid.

**User Dashboard**

The dashboard is the personal control center for every logged-in user. It features:

- **Icon Tile Navigation** — Four large tiles at the top for Exercise and Fitness, Diet and Meal Plans, Cooking and Recipes, and Calendar. One tap navigates directly into each section.
- **Daily Summary View** — Today's food log with calorie total vs. goal, today's logged fitness activity, the next upcoming calendar event, and a preview of recent social feed activity.

**User Profile Page**

Each user has a public profile page following the PeepSo layout pattern:
- Full-width cover image at the top
- Circular profile photo overlapping the cover image
- Name, verified/active status badge
- Stats row: Friends count, Followers count, Following count
- Follow and Message action buttons
- Tab navigation: Stream (posts), About, Friends, Followers

**Account States**

Every account exists in one of four states managed automatically:

| State | Description |
|---|---|
| Active Trial | Full access. 30-day window from registration date. |
| Active Subscriber | Full access. Payment confirmed via Stripe. |
| Deactivated | Login allowed but all features locked. Subscribe prompt shown. |
| Deleted | Account and all data permanently removed after 90 days of non-payment. |

Automated reminder emails are dispatched at 7 days, 3 days, and 0 days before trial expiry. A daily background job manages state transitions with no manual intervention required.

---

### 3. Food Journal and Nutrition Tracker

Inspired by MyFitnessPal and SparkPeople. This is one of the highest-engagement sections of the platform.

**Daily Food Log**

Each day is divided into four meal sections: Breakfast, Lunch, Dinner, and Snacks. Each section displays all logged items with individual calorie and macro breakdowns. A full daily summary at the bottom shows total calories vs. goal and total protein, carbs, and fat vs. macro goals, visualized using progress bars or ring charts.

**Food Search**

Users search for any food item. The system queries the Nutritionix API or USDA FoodData Central API and returns matching results with full nutritional data. The user selects a result, adjusts serving size, and logs it instantly.

**Custom Foods**

Users can manually create food entries with a custom name, serving size, and nutritional values. Custom foods are saved to their personal food library and appear in future searches.

**Water Tracker**

A tap-based water intake tracker on the daily food log page. A visual indicator shows progress toward the daily water goal.

**Barcode Scanner**

Users tap a Scan Barcode button, point their phone camera at any food package barcode, and the system automatically identifies the product via the Open Food Facts API or Barcode Lookup API and pre-fills all nutritional data for confirmation.

**Photo Meal Logging** *(AI-Powered)*

The user photographs their meal. The image is sent to the OpenAI Vision API which identifies the foods, estimates portion sizes, and returns a calorie and macro estimate. The result is pre-filled into a food entry for user confirmation. Zero manual typing required.

**Voice Meal Logging** *(AI-Powered)*

The user speaks naturally — for example, "I had oatmeal, a banana, and orange juice for breakfast." The browser Speech Recognition API or OpenAI Whisper converts the audio to text. The system then identifies the food items and quantities, queries the nutrition database, and logs them to the appropriate meal section automatically.

**Nutrition History and Charts**

Users can navigate backward and forward through dates, view weekly and monthly summaries, and view charts for calorie intake over time, macro breakdowns over time, and water intake trends.

---

### 4. Fitness Tracker

Inspired by Fitbod and leading female fitness apps.

**Workout Logging**

Users log workouts by selecting a type: Strength Training, Cardio, Yoga, Pilates, HIIT, Sports, or Custom. For strength workouts, they select exercises from the built-in library or type custom exercise names, then add sets with reps and weight per set. For cardio, they log activity type, duration, and distance. Notes and a difficulty rating can be added at the end.

**Exercise Library**

A searchable library of common exercises organized by muscle group: chest, back, legs, shoulders, arms, core, and full body.

**Steps Tracker**

A daily step counter with a visual progress indicator toward the default 10,000-step daily goal. Users can update steps manually or connect phone step data where supported.

**Body Stats Tracker**

Users log body weight, body fat percentage, and body measurements (waist, hips, chest, left arm, right arm, left thigh, right thigh) with dated entries. Charts visualize changes over time.

**My Goals Page**

A dedicated motivational page where users set and track: target weight, target body fat percentage, daily calorie goal, weekly workout frequency goal, daily steps goal, and personal free-text goals. Visual progress indicators compare current stats against each goal.

**Progress Charts and History**

Complete workout history by day, week, and month. Charts display workout frequency, total training volume for strength sessions, and cardio distance and duration over time.

---

### 5. Social Feed and Community

Directly inspired by Facebook, Instagram, and the PeepSo social network design. The social section uses a bright orange, blue, and yellow color palette.

**News Feed**

Displays posts exclusively from users the logged-in user follows, in reverse chronological order. Each post shows the poster's profile photo, name, timestamp, post text, attached photos, and engagement buttons.

**Post Creation**

A post composer at the top of the feed allows users to write text and attach one or more photos. Photos display in a clean grid layout within the post.

**Reactions and Comments**

Each post has a Like button and an expandable comment section with threaded replies, mirroring the Facebook comment structure. Notifications are sent for all engagement activity.

**Follow System**

One-directional following (Instagram model). Each profile shows follower and following counts. Follow and Unfollow buttons appear on every profile page and member card.

**Member Discovery**

A search and discovery section where users can search by name or browse suggested members based on similar fitness goals. Each result shows a profile card with photo, name, follower count, mutual connections, and a Follow button.

**Notifications**

A notification bell with badge count in the navigation bar. The notification list covers: likes on your posts, comments on your posts, new followers, and new private messages. Each notification is tappable and navigates directly to the relevant content.

**Achievement Poster Sharing**

When a user earns an AI-generated achievement poster, they can share it directly to the social feed in one tap with an auto-generated caption.

---

### 6. Private Messaging System

Modeled after Facebook Messenger and Instagram DMs.

**Inbox**

A list of all conversations showing the other person's profile photo, name, last message preview, timestamp, and an unread indicator for new messages. A badge count on the message icon in the navigation bar reflects unread conversations.

**Chat Interface**

Full message history within each conversation. The logged-in user's messages appear on the right with an accent-colored background. The other person's messages appear on the left. A text input and send button sit at the bottom. Photo attachments are supported.

**Near Real-Time Updates**

New messages appear within one to two seconds using AJAX polling, giving a real-time chat experience without requiring WebSocket infrastructure in the initial build.

**Starting Conversations**

Users can initiate a new conversation from any member's profile page via a Message button, or search for a member by name from within the inbox.

---

### 7. Calendar and Organization Tools

Directly inspired by the Cozi family organizer application.

**Calendar Views**

Three switchable views: monthly grid view with events marked on each day, weekly view with time slots per day, and agenda view showing all upcoming events as an ordered list.

**Events and Color-Coding**

Users tap any date to create an event with a title, date, time, optional notes, and a color assignment. Color-coding allows users to visually distinguish workout events, meal plan entries, and personal appointments at a glance.

**Automatic Connected Entries**

Workout logs from the fitness tracker and meal entries from the food journal automatically appear on the calendar on the relevant day. The calendar becomes a complete picture of the user's day without any duplicate manual entry.

**Meal Planner**

Within the calendar, users plan meals for the entire week by assigning recipes or custom meals to breakfast, lunch, and dinner slots on each day. The week view shows planned meals alongside scheduled workouts in one unified health overview.

**To-Do Lists**

A simple task management feature for adding, completing, and tracking pending tasks — fitness-related or otherwise.

**Shopping Lists**

Users can manually build shopping lists or auto-generate them from the weekly meal plan. The Generate Shopping List function extracts all ingredients from every planned recipe for the week, deduplicates them, groups them by category (produce, dairy, meat, pantry), and produces a complete organized list.

---

### 8. Recipes Section

Inspired by CookedPro and AllRecipes.

**Recipe Library**

A curated library of healthy fitness-focused recipes. Each recipe displays a hero photo, name, short description, prep time, cook time, difficulty level, serving size, and a full nutritional breakdown per serving covering calories, protein, carbs, fat, and fiber.

**Recipe Detail Page**

Full detail view with all nutritional data, a complete ingredient list with quantities, and numbered step-by-step cooking instructions. A serving size adjuster dynamically recalculates all ingredient quantities based on the selected number of servings.

**Search and Filters**

Search by recipe name or ingredient. Filter by meal type (breakfast, lunch, dinner, snack), calorie range, and category (high protein, vegetarian, low carb, under 30 minutes).

**Saving Recipes**

A heart or bookmark icon on every recipe saves it to the user's personal Recipe Box in one tap.

**Custom Recipes**

Users can create their own recipes with a name, photo, ingredients, cooking instructions, and nutritional values. Custom recipes can be kept private or published to the community recipes section.

**Add to Meal Planner**

An Add to Meal Plan button on every recipe page lets users assign the recipe to a specific day and meal slot. Ingredients are automatically added to the shopping list.

**Log from a Recipe**

A Log This Meal button calculates the macros for the user's selected serving size and logs the full meal to the food journal instantly — no manual searching or typing required.

---

### 9. Membership and Subscription System

The monetization layer of the platform, powered by Stripe.

**Trial Logic**

Every new account receives a 30-day free trial with full access to all features. No credit card is required at signup. Automated trial reminder emails are sent at 7 days remaining, 3 days remaining, and on the day of expiry.

**Subscription Tiers**

| Tier | Pricing |
|---|---|
| Basic Monthly | ~$7–$10 / month |
| Premium Monthly | Higher price point with additional features |
| Annual Plan | ~$79–$99 / year — clearly highlights savings vs. monthly |

The pricing page is designed as clean cards with a highlighted recommended plan, feature lists per tier, savings callouts, and prominent call-to-action buttons — modeled after the MyFitnessPal Premium pricing page.

**Stripe Integration**

All payment processing is handled through Stripe Elements or a Stripe-hosted form. The platform stores the Stripe subscription ID and customer ID in the database. Stripe manages recurring billing and fires webhooks to the platform when payments succeed, fail, or subscriptions are cancelled.

**Account Deactivation and Deletion**

A daily background job checks account statuses. Accounts that exceed the grace period after trial expiry or payment failure are deactivated automatically. Accounts that remain deactivated for 90 days are permanently deleted from the system with no manual admin intervention required.

---

### 10. AI Fitness and Diet Planner

Branded as **"My EXtreme Trainer"** — the AI personal coach built into the platform.

**Chat Interface**

A clean conversational chat screen with the My EXtreme Trainer avatar at the top, full conversation history in the center, and a text input field at the bottom.

**What the AI Does**

The OpenAI ChatGPT API (GPT-4) is called with each user message. The system prompt establishes the AI as a certified personal trainer and nutritionist. Users can request:

- Complete personalized meal and workout plans based on their stats and goals
- Custom workout routines for specific muscle groups or fitness levels
- Recipe and meal ideas that fit their calorie and macro targets
- Guidance on breaking through a weight loss or muscle-building plateau
- Supplement recommendations
- Motivational coaching and progress advice
- Answers to any health, nutrition, or fitness question

**Conversation Memory**

Within a session the AI retains the full conversation context. Long-term memory across sessions can be implemented by storing key user profile details and injecting them into the system prompt on each new session.

---

### 11. AI Image Generation Features

Three distinct DALL-E powered features integrated into the platform.

**Body Transformation Visualizer**

The user uploads a current photo of themselves and enters their current stats alongside their goal stats. The system sends this data to the OpenAI DALL-E API with a structured prompt instructing it to generate a motivational transformation visualization. The result is displayed as a before/after or transformed image — a deeply motivating tool for long-term user engagement.

**Meal Visualizer**

The user types a description of a meal they plan to eat — for example, "grilled salmon with quinoa and steamed asparagus." The system sends the description to DALL-E and generates a realistic, visually appealing food photo of that meal. Available from the food journal and recipe pages. Makes healthy eating feel aspirational.

**Achievement Poster Generator**

The platform automatically detects user milestones: losing the first 5 pounds, logging workouts for 7 consecutive days, reaching the daily calorie goal every day for a week, setting a personal record on an exercise. When a milestone is triggered, DALL-E generates a personalized motivational poster featuring the user's name, the specific achievement, a motivational message, and My EXtreme Trainer branding. The user receives a congratulations notification and can share the poster to the social feed or download it for their own social media channels.

---

### 12. Admin Panel

Accessible via a separate protected route, never visible to regular users.

**User Management**

A complete table of all registered users with name, email, signup date, trial end date, subscription status, and last active date. The admin can view any profile, edit user details, manually override subscription status, deactivate, or permanently delete an account. Filters allow sorting by trial users, active subscribers, expired accounts, and deactivated accounts.

**Subscription Tracking**

A financial overview dashboard showing subscription revenue, active subscriber count, trial-to-paid conversion rate, and churn rate.

**Content Moderation**

All social feed posts and comments are viewable and manageable from the admin panel. Posts reported by users appear in a moderation queue. The admin can delete any post or comment in violation of community guidelines.

**Platform Statistics**

A metrics dashboard showing total registered users, total active subscribers, total posts published, total meals logged, total workouts logged, total recipes saved, and daily or weekly growth charts for each metric.

**Recipe Management**

The admin can add, edit, remove, and feature recipes in the platform library.

**Announcements and Email Campaigns**

The admin can compose and send bulk emails to all users, active subscribers only, trial users only, or users who have not logged in for a specified number of days — all handled through the Mailgun or SendGrid integration.

---

## External API Integrations

| API | Purpose |
|---|---|
| OpenAI ChatGPT (GPT-4) | AI fitness and diet planner chat |
| OpenAI DALL-E | Body transformation visualizer, meal visualizer, achievement poster generator |
| OpenAI Vision API | Photo meal logging — food identification from photos |
| OpenAI Whisper | Voice meal logging — speech-to-text conversion |
| Nutritionix API / USDA FoodData Central | Food search and nutritional data for the food journal |
| Open Food Facts API / Barcode Lookup API | Barcode scanner — product identification from barcode numbers |
| Stripe | Subscription payment processing, recurring billing, webhook events |
| Mailgun / SendGrid | Transactional emails — welcome, trial reminders, deactivation notices, admin campaigns |
| Instacart API | Grocery list syncing (subject to developer access availability; fallback is PDF export or clipboard copy) |

---

## Membership and Pricing Model

This platform operates as a **subscription SaaS product**. Revenue is generated through tiered monthly and annual memberships. Key financial mechanics:

- 30-day free trial with no credit card required at signup
- Automated email sequences drive trial-to-paid conversion
- Stripe manages all recurring billing and failed payment handling
- Accounts are automatically deactivated after non-payment and permanently deleted after 90 days
- The admin panel provides real-time visibility into revenue, subscriber count, conversion rate, and churn

---

## Mobile Experience

The platform is built mobile-first. Key mobile UX requirements across the entire application:

- Every page renders and functions perfectly on phone screens
- Thumb-friendly navigation with primary actions reachable from the bottom of the screen
- A persistent bottom navigation bar when logged in: Home, Social Feed, Notifications, Messages, Profile
- Forms are optimized for mobile keyboards
- Photo uploads trigger the native device camera
- The barcode scanner uses the phone camera via the browser
- Charts resize cleanly across all screen widths
- Every server action displays a loading indicator
- The platform can be saved to the phone home screen and launches full-screen with no browser chrome — behaving identically to a native iOS or Android application

---

## Development Phases

| Phase | Scope | Timeline |
|---|---|---|
| Phase 1 | Public homepage — full frontend design | Included in Phases 1–4 |
| Phase 2 | User accounts, dashboard, profiles, trial system | Included in Phases 1–4 |
| Phase 3 | Food journal and nutrition tracker | Included in Phases 1–4 |
| Phase 4 | Fitness tracker and body stats | Phases 1–4 complete in 5–7 weeks |
| Phase 5 | Social feed and community | Post Phase 4 |
| Phase 6 | Private messaging system | Post Phase 5 |
| Phase 7 | Calendar, recipes, and organization tools | Post Phase 6 |
| Phase 8 | Membership system, Stripe, barcode scanner, voice logging | Post Phase 7 |
| Phase 9 | AI planner, DALL-E image generation, photo meal logging | Post Phase 8 |
| Phase 10 | Admin panel, full testing, beta launch preparation | Final phase |

Each phase is delivered and approved independently before the next phase begins.

---

## Project Structure

```
myextremetrainer/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/
│   │   │   ├── FoodJournalController.php
│   │   │   ├── FitnessTrackerController.php
│   │   │   ├── SocialFeedController.php
│   │   │   ├── MessagingController.php
│   │   │   ├── CalendarController.php
│   │   │   ├── RecipeController.php
│   │   │   ├── AIController.php
│   │   │   ├── SubscriptionController.php
│   │   │   └── AdminController.php
│   ├── Models/
│   ├── Services/
│   │   ├── OpenAIService.php
│   │   ├── NutritionService.php
│   │   ├── StripeService.php
│   │   └── EmailService.php
│   └── Console/
│       └── Commands/
│           └── ProcessAccountStates.php
├── database/
│   ├── migrations/
│   └── seeders/
├── resources/
│   ├── views/
│   │   ├── public/
│   │   ├── dashboard/
│   │   ├── food-journal/
│   │   ├── fitness/
│   │   ├── social/
│   │   ├── messaging/
│   │   ├── calendar/
│   │   ├── recipes/
│   │   ├── ai/
│   │   └── admin/
│   ├── css/
│   └── js/
├── routes/
│   ├── web.php
│   └── api.php
├── config/
└── public/
```

---

## License

All source code and platform assets are the exclusive property of the client. No third-party subscription plugins are used anywhere in this codebase. There are no ongoing licensing fees for the platform software itself beyond the external API services listed above (OpenAI, Stripe, Mailgun/SendGrid, Nutritionix).

---

*Built by SkillLeo for Team Extreme / My EXtreme Trainer.*