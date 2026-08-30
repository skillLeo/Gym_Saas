<?php

use App\Http\Controllers\Api\AchievementController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BodyStatController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CustomFoodController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FitnessGoalController;
use App\Http\Controllers\Api\FitnessLogController;
use App\Http\Controllers\Api\FoodLogController;
use App\Http\Controllers\Api\FoodSearchController;
use App\Http\Controllers\Api\LiveController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\SocialCommentController;
use App\Http\Controllers\Api\SocialFollowController;
use App\Http\Controllers\Api\SocialPostController;
use App\Http\Controllers\Api\VideoController;
use App\Http\Controllers\Api\WaterLogController;
use Illuminate\Support\Facades\Route;

// Public auth routes — throttled to prevent brute force and spam
Route::prefix('auth')->group(function () {
    Route::post('/register',       [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/login',          [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/forgot-password',[AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
    Route::get('/google/redirect', [AuthController::class, 'redirectToGoogle']);
    Route::get('/google/callback', [AuthController::class, 'handleGoogleCallback']);
});

// Signed email verification link — no auth header on a clicked email link, validated by signature instead.
//
// The `signed` middleware is deliberately NOT applied. It aborts with a raw 403
// JSON body before the controller runs, which is what a member saw whenever they
// clicked a link after the 60-minute expiry — a common, entirely normal case.
// `verifyEmail()` performs the same `hasValidSignature()` check itself and then
// redirects to the frontend's `?status=invalid` screen, so security is identical
// and the failure mode is a readable page instead of a JSON error.
Route::get('/auth/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->name('verification.verify');

// Stripe webhook — deliberately outside auth:sanctum and verified.email.
// Stripe is not a logged-in user; the request is authenticated by its
// signature (see StripeWebhookController). Not throttled: rate-limiting
// Stripe's retries would drop payment events.
Route::post('/stripe/webhook', [\App\Http\Controllers\Api\StripeWebhookController::class, 'handle'])
    ->name('stripe.webhook');

// Public pricing — the pricing page is reachable before signing in.
Route::get('/plans', [\App\Http\Controllers\Api\SubscriptionController::class, 'plans']);

// Public video preview for the marketing homepage. Metadata only — no
// `video_url`, so this advertises the library without giving it away.
Route::get('/videos/public', [VideoController::class, 'publicIndex']);

// Protected routes.
// `subscribed` gates feature endpoints behind an active trial or subscription;
// it allowlists auth, plans, subscription and onboarding internally so a lapsed
// user can still sign in, see pricing and pay.
Route::middleware(['auth:sanctum', 'verified.email', 'subscribed'])->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout',          [AuthController::class, 'logout']);
        Route::get('/user',             [AuthController::class, 'user']);
        Route::post('/email/resend',    [AuthController::class, 'resendVerification']);
        Route::put('/user',             [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
        Route::post('/avatar',          [AuthController::class, 'uploadAvatar']);
    });

    // Onboarding
    Route::post('/onboarding', [OnboardingController::class, 'store']);

    // Billing. These must stay reachable to lapsed users so they can resubscribe —
    // when EnsureSubscriptionActive lands in §4.2, add them to its allowlist.
    Route::prefix('subscription')->group(function () {
        Route::get('/',       [\App\Http\Controllers\Api\SubscriptionController::class, 'show']);
        Route::post('/',      [\App\Http\Controllers\Api\SubscriptionController::class, 'store'])->middleware('throttle:10,1');
        // Move between tiers on the existing subscription rather than creating a
        // second one. Throttled like checkout, because it moves money.
        Route::post('/change-plan',[\App\Http\Controllers\Api\SubscriptionController::class, 'changePlan'])->middleware('throttle:10,1');
        Route::post('/cancel',[\App\Http\Controllers\Api\SubscriptionController::class, 'cancel']);
        Route::post('/resume',[\App\Http\Controllers\Api\SubscriptionController::class, 'resume']);
    });

    // Generic image upload (posts, food, videos, messages)
    Route::post('/uploads/image', [\App\Http\Controllers\Api\UploadController::class, 'store'])->middleware('throttle:20,1');

    // Dashboard
    // `member` to match every sibling member endpoint. This was the one route in
    // the group without it, so an admin token got 200 here and 403 on
    // /food-log, /fitness-logs, /water-log, /meal-slots and /body-stats. It
    // leaked nothing — it returns the caller's own (empty) totals — but a guard
    // that is on five routes out of six is a guard someone will assume is there.
    // Only src/app/dashboard/page.tsx calls this, and admins are redirected off
    // that page to /admin already.
    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('member');

    // Food search
    Route::prefix('food')->middleware('member')->group(function () {
        Route::get('/search',           [FoodSearchController::class, 'search']);
        Route::get('/barcode/{barcode}',[FoodSearchController::class, 'barcode']);
        Route::post('/nlp',             [FoodSearchController::class, 'nlp']);
        // Lets Barcode / Photo Log / Voice Log say up front that the food
        // database is not connected, instead of promising "AI Powered"
        // nutrition and only failing once the member has taken a photo and
        // typed a description.
        Route::get('/integration-status', [FoodSearchController::class, 'integrationStatus']);
        Route::get('/recent',           [FoodLogController::class,    'recent']);
        Route::post('/custom',          [CustomFoodController::class,  'store']);
        Route::get('/custom',           [CustomFoodController::class,  'index']);
    });

    // Meal slots (customizable meal sections)
    Route::prefix('meal-slots')->middleware('member')->group(function () {
        Route::get('/',              [\App\Http\Controllers\Api\MealSlotController::class, 'index']);
        Route::post('/',             [\App\Http\Controllers\Api\MealSlotController::class, 'store']);
        Route::put('/{mealSlot}',    [\App\Http\Controllers\Api\MealSlotController::class, 'update']);
        Route::delete('/{mealSlot}', [\App\Http\Controllers\Api\MealSlotController::class, 'destroy']);
    });

    // Daily steps
    Route::prefix('daily-steps')->middleware('member')->group(function () {
        Route::get('/',  [\App\Http\Controllers\Api\DailyStepController::class, 'show']);
        Route::put('/',  [\App\Http\Controllers\Api\DailyStepController::class, 'update']);
    });

    // Food log
    Route::prefix('food-log')->middleware('member')->group(function () {
        Route::get('/',          [FoodLogController::class, 'index']);
        Route::post('/',         [FoodLogController::class, 'store']);
        Route::post('/from-api', [FoodLogController::class, 'storeFromApi']);
        Route::get('/summary',   [FoodLogController::class, 'summary']);
        Route::get('/history',   [FoodLogController::class, 'history']);
        Route::put('/{foodLog}', [FoodLogController::class, 'update']);
        Route::delete('/{foodLog}', [FoodLogController::class, 'destroy']);
    });

    // Water log
    Route::prefix('water-log')->middleware('member')->group(function () {
        Route::get('/',          [WaterLogController::class, 'show']);
        Route::post('/increment',[WaterLogController::class, 'increment']);
        Route::post('/decrement',[WaterLogController::class, 'decrement']);
        Route::put('/',          [WaterLogController::class, 'update']);
    });

    // Fitness logs
    Route::prefix('fitness-logs')->middleware('member')->group(function () {
        Route::get('/',          [FitnessLogController::class, 'index']);
        Route::post('/',         [FitnessLogController::class, 'store']);
        Route::delete('/{fitnessLog}', [FitnessLogController::class, 'destroy']);
        Route::get('/summary',   [FitnessLogController::class, 'summary']);
        Route::get('/history',   [FitnessLogController::class, 'history']);
        Route::get('/streak',    [FitnessLogController::class, 'streak']);
    });

    // Body stats
    Route::prefix('body-stats')->middleware('member')->group(function () {
        Route::get('/',  [BodyStatController::class, 'index']);
        Route::post('/', [BodyStatController::class, 'store']);
    });

    // Fitness goals
    Route::prefix('fitness-goals')->middleware('member')->group(function () {
        Route::get('/',                    [FitnessGoalController::class, 'index']);
        Route::post('/',                   [FitnessGoalController::class, 'store']);
        Route::put('/{fitnessGoal}',       [FitnessGoalController::class, 'update']);
        Route::delete('/{fitnessGoal}',    [FitnessGoalController::class, 'destroy']);
    });

    // Social — posts, reactions, comments, follows
    Route::prefix('social')->group(function () {
        Route::get('/feed',             [SocialPostController::class, 'index']);
        // Bookmarked posts. Static path before the /posts/{socialPost} wildcards.
        Route::get('/posts/saved',      [SocialPostController::class, 'saved']);
        Route::post('/posts/{socialPost}/save', [SocialPostController::class, 'toggleSave']);
        Route::post('/posts',           [SocialPostController::class, 'store'])->middleware('throttle:10,1');
        Route::delete('/posts/{socialPost}', [SocialPostController::class, 'destroy']);
        Route::post('/posts/{socialPost}/react', [SocialPostController::class, 'react'])->middleware('throttle:30,1');
        Route::get('/posts/{socialPost}/comments',  [SocialCommentController::class, 'index']);
        Route::post('/posts/{socialPost}/comments', [SocialCommentController::class, 'store'])->middleware('throttle:30,1');
        Route::delete('/comments/{postComment}',    [SocialCommentController::class, 'destroy']);
        Route::post('/follow/{userId}',    [SocialFollowController::class, 'toggle']);
        Route::get('/following',           [SocialFollowController::class, 'following']);
        Route::get('/followers',           [SocialFollowController::class, 'followers']);
        Route::get('/suggestions',         [SocialFollowController::class, 'suggestions']);
        Route::get('/search',              [SocialFollowController::class, 'search']);
        Route::get('/users/{username}',    [SocialFollowController::class, 'profile']);
        Route::get('/users/{username}/posts', [SocialPostController::class, 'userPosts']);
    });

    // Groups
    Route::prefix('groups')->group(function () {
        Route::get('/',              [\App\Http\Controllers\Api\GroupController::class, 'index']);
        Route::get('/mine',          [\App\Http\Controllers\Api\GroupController::class, 'mine']);
        Route::post('/',             [\App\Http\Controllers\Api\GroupController::class, 'store'])->middleware('throttle:5,1');
        Route::post('/{group}/join', [\App\Http\Controllers\Api\GroupController::class, 'join']);
        Route::post('/{group}/leave',[\App\Http\Controllers\Api\GroupController::class, 'leave']);
    });

    // Recipes
    Route::prefix('recipes')->middleware('member')->group(function () {
        Route::get('/',                           [RecipeController::class, 'index']);
        Route::get('/saved',                      [RecipeController::class, 'saved']);
        Route::post('/',                          [RecipeController::class, 'store']);
        Route::get('/{recipe}',                   [RecipeController::class, 'show']);
        Route::post('/{recipe}/save',             [RecipeController::class, 'toggleSave']);
        Route::post('/{recipe}/log-journal',      [RecipeController::class, 'logToJournal']);
        Route::post('/{recipe}/meal-plan',        [RecipeController::class, 'addToMealPlan']);
        // Members may edit and delete only what they wrote themselves; the
        // controller enforces that, and a seeded library recipe (user_id null)
        // belongs to nobody so it is refused too.
        Route::put('/{recipe}',                   [RecipeController::class, 'update']);
        Route::delete('/{recipe}',                [RecipeController::class, 'destroy']);
        // Ask an admin to move your own recipe into the shared library.
        Route::post('/{recipe}/submit',           [RecipeController::class, 'submit']);

    });

    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/',                          [NotificationController::class, 'index']);
        Route::get('/unread-count',              [NotificationController::class, 'unreadCount']);
        // Per-category mute (5.7). Static paths stay above the /{notification}
        // wildcard or 'preferences' resolves as a notification id.
        Route::get('/preferences',               [NotificationController::class, 'preferences']);
        Route::put('/preferences',               [NotificationController::class, 'updatePreferences']);
        // Pinned members (§5.7). Static paths before the /{notification} wildcard.
        Route::get('/pinned',                    [NotificationController::class, 'pinned']);
        Route::post('/pinned',                   [NotificationController::class, 'togglePin']);
        Route::post('/mark-all-read',            [NotificationController::class, 'markAllRead']);
        Route::post('/{notification}/read',      [NotificationController::class, 'markRead']);
        Route::delete('/{notification}',         [NotificationController::class, 'destroy']);
    });

    // Videos
    Route::prefix('videos')->group(function () {
        Route::get('/',             [VideoController::class, 'index']);
        Route::get('/saved',        [VideoController::class, 'saved']);
        Route::post('/',            [VideoController::class, 'store']);
        Route::get('/{video}',      [VideoController::class, 'show']);
        Route::post('/{video}/save',[VideoController::class, 'toggleSave']);
        Route::put('/{video}',      [VideoController::class, 'update']);
        Route::delete('/{video}',   [VideoController::class, 'destroy']);
    });

    // Calendar
    Route::prefix('calendar')->middleware('member')->group(function () {
        Route::get('/events',                    [CalendarController::class, 'events']);
        Route::post('/events',                   [CalendarController::class, 'storeEvent']);
        Route::put('/events/{event}',            [CalendarController::class, 'updateEvent']);
        Route::delete('/events/{event}',         [CalendarController::class, 'destroyEvent']);
        Route::get('/meal-plans',                [CalendarController::class, 'mealPlans']);
        Route::delete('/meal-plans/{mealPlan}',  [CalendarController::class, 'destroyMealPlan']);
        Route::get('/shopping-list',             [CalendarController::class, 'shoppingList']);
        Route::post('/shopping-list',            [CalendarController::class, 'storeShoppingItem']);
        Route::post('/shopping-list/generate',   [CalendarController::class, 'generateShoppingList']);
        Route::delete('/shopping-list/clear-checked', [CalendarController::class, 'clearCheckedItems']);
        Route::post('/shopping-list/{item}/toggle', [CalendarController::class, 'toggleShoppingItem']);
        Route::delete('/shopping-list/{item}',   [CalendarController::class, 'destroyShoppingItem']);
        Route::get('/todos',                     [CalendarController::class, 'todos']);
        Route::post('/todos',                    [CalendarController::class, 'storeTodo']);
        Route::post('/todos/{todo}/toggle',      [CalendarController::class, 'toggleTodo']);
        Route::delete('/todos/{todo}',           [CalendarController::class, 'destroyTodo']);
    });

    // Messages — send throttled to prevent spam (60 messages per minute per user)
    Route::prefix('messages')->group(function () {
        Route::get('/',                                  [MessageController::class, 'conversations']);
        // Static path before the /{conversation} wildcard, or "search" would be
        // resolved as a conversation id.
        Route::get('/search',                            [\App\Http\Controllers\Api\MessageSearchController::class, 'search']);
        Route::post('/start',                            [MessageController::class, 'startConversation'])->middleware('throttle:20,1');
        Route::get('/{conversation}',                    [MessageController::class, 'show']);
        Route::get('/{conversation}/messages',           [MessageController::class, 'messages']);
        Route::post('/{conversation}/messages',          [MessageController::class, 'send'])->middleware('throttle:60,1');
    });

    // Live sessions
    Route::prefix('live')->group(function () {
        // Static/admin routes MUST come before wildcard /{session}
        Route::get('/current',                [LiveController::class, 'current']);
        Route::get('/replays',                [LiveController::class, 'replays']);
        Route::get('/admin/all',              [LiveController::class, 'adminIndex']);
        Route::post('/admin/sessions',        [LiveController::class, 'store']);
        Route::put('/admin/sessions/{session}', [LiveController::class, 'update']);
        // Wildcard routes last
        Route::get('/{session}',              [LiveController::class, 'show']);
        Route::get('/{session}/comments',     [LiveController::class, 'comments']);
        Route::post('/{session}/comments',    [LiveController::class, 'addComment']);
        Route::post('/{session}/like',        [LiveController::class, 'like']);
    });

    // Achievements
    Route::get('/achievements', [AchievementController::class, 'index']);

    // Coaching authorization requests (§6.5.2) — member-initiated only.
    // Approval lives exclusively under admin/coaching-authorizations below.
    Route::prefix('coaching-authorizations')->group(function () {
        $ca = \App\Http\Controllers\Api\CoachingAuthorizationController::class;
        Route::get('/',                [$ca, 'index']);
        Route::post('/',               [$ca, 'store'])->middleware('throttle:5,1');
        Route::post('/{authorization}/revoke', [$ca, 'revoke']);
    });

    // Resources library (§5.3). Files are streamed by the controller from a
    // private disk — there is no public path to them at all.
    Route::prefix('resources')->group(function () {
        $c = \App\Http\Controllers\Api\ResourceController::class;
        Route::get('/categories',        [$c, 'categories']);
        Route::get('/',                  [$c, 'index']);
        Route::get('/{resource}',        [$c, 'show']);
        Route::get('/{resource}/stream', [$c, 'stream']);
        Route::get('/{resource}/download', [$c, 'download']);
    });

    // Vibe Thread — one platform-wide channel (§5.1).
    // Posting is rate-limited to stop one member flooding a room everyone
    // shares; reads are not, because polling is the read path.
    Route::prefix('vibe-thread')->group(function () {
        $c = \App\Http\Controllers\Api\VibeThreadController::class;
        Route::get('/',   [$c, 'index']);
        Route::post('/',  [$c, 'store'])->middleware('throttle:20,1');
        Route::post('/mute', [$c, 'mute']);
        Route::put('/{vibeThreadMessage}',    [$c, 'update'])->middleware('throttle:30,1');
        Route::delete('/{vibeThreadMessage}', [$c, 'destroy']);
    });

    // Streaks, badges and feed featuring (§4.5).
    Route::prefix('streaks')->group(function () {
        $c = \App\Http\Controllers\Api\AchievementApiController::class;
        Route::get('/me',                    [$c, 'mine']);
        Route::get('/feed-features',         [$c, 'feedFeatures']);
        Route::post('/feed-features/{feedFeature}/dismiss', [$c, 'dismissFeature']);
        // Wildcard last, so /me and /feed-features are not swallowed by it.
        Route::get('/user/{user}',           [$c, 'forMember']);
    });

    // Super Admin — API key management + stats + users
    // Static routes MUST come before wildcard /{user}
    Route::prefix('admin')->group(function () {
        // Conversion coupon offers (§4.3). Guarded by the `admin` middleware
        // rather than a per-method call, so a new action cannot ship unguarded.
        Route::middleware('admin')->prefix('coupon-offers')->group(function () {
            Route::get('/',        [\App\Http\Controllers\Api\Admin\CouponOfferController::class, 'index']);
            Route::get('/stats',   [\App\Http\Controllers\Api\Admin\CouponOfferController::class, 'stats']);
            Route::post('/',       [\App\Http\Controllers\Api\Admin\CouponOfferController::class, 'store']);
            Route::put('/{couponOffer}',    [\App\Http\Controllers\Api\Admin\CouponOfferController::class, 'update']);
            Route::delete('/{couponOffer}', [\App\Http\Controllers\Api\Admin\CouponOfferController::class, 'destroy']);
            Route::post('/{couponOffer}/preview', [\App\Http\Controllers\Api\Admin\CouponOfferController::class, 'preview'])
                ->middleware('throttle:6,1');
        });

        // Vibe Call schedules (§5.2). Sessions are materialised into the
        // existing live_sessions table — no parallel live system.
        Route::middleware('admin')->prefix('vibe-calls')->group(function () {
            $vc = \App\Http\Controllers\Api\Admin\VibeCallController::class;
            Route::get('/',          [$vc, 'index']);
            Route::get('/upcoming',  [$vc, 'upcoming']);
            Route::post('/',         [$vc, 'store']);
            Route::put('/{vibeCallSchedule}',    [$vc, 'update']);
            Route::delete('/{vibeCallSchedule}', [$vc, 'destroy']);
        });

        // Resources library management (§5.3).
        Route::middleware('admin')->group(function () {
            $ra = \App\Http\Controllers\Api\Admin\ResourceAdminController::class;
            Route::get('/resource-categories',    [$ra, 'categories']);
            Route::post('/resource-categories',   [$ra, 'storeCategory']);
            Route::put('/resource-categories/{resourceCategory}',    [$ra, 'updateCategory']);
            Route::delete('/resource-categories/{resourceCategory}', [$ra, 'destroyCategory']);

            Route::get('/resources',              [$ra, 'index']);
            Route::post('/resources',             [$ra, 'store'])->middleware('throttle:30,1');
            Route::post('/resources/{resource}',  [$ra, 'update'])->middleware('throttle:30,1');
            Route::delete('/resources/{resource}', [$ra, 'destroy']);
        });

        // Motivational notifications (§4.4). In-app delivery only — web push is
        // explicitly out of scope, see BUILD_PROGRESS.
        Route::middleware('admin')->prefix('motivational')->group(function () {
            $c = \App\Http\Controllers\Api\Admin\MotivationalController::class;
            Route::get('/',                       [$c, 'index']);
            Route::post('/',                      [$c, 'store']);
            Route::put('/{motivationalMessage}',  [$c, 'update']);
            Route::delete('/{motivationalMessage}', [$c, 'destroy']);
            Route::post('/{motivationalMessage}/send', [$c, 'sendNow'])->middleware('throttle:6,1');

            Route::post('/schedules',                        [$c, 'storeSchedule']);
            Route::put('/schedules/{notificationSchedule}',   [$c, 'updateSchedule']);
            Route::delete('/schedules/{notificationSchedule}', [$c, 'destroySchedule']);
        });

        Route::get('/settings',              [AdminController::class, 'getSettings']);
        Route::post('/settings/smtp',        [AdminController::class, 'updateSmtp']);
        Route::post('/settings/nutritionix', [AdminController::class, 'updateNutritionix']);
        Route::post('/settings/test-smtp',   [AdminController::class, 'testSmtp']);
        Route::post('/settings/test-nutritionix', [AdminController::class, 'testNutritionix']);
        Route::get('/stats',                 [AdminController::class, 'stats']);
        Route::get('/moderation',            [AdminController::class, 'moderation']);
        Route::get('/users',                 [AdminController::class, 'users']);
        Route::get('/users/recent',          [AdminController::class, 'recentUsers']);
        Route::get('/users/{user}',          [AdminController::class, 'show']);
        Route::put('/users/{user}',          [AdminController::class, 'updateUser']);
        Route::delete('/users/{user}',       [AdminController::class, 'deleteUser']);

        // Subscription & revenue dashboard (§E1) — real SQL, see RevenueController.
        // `admin` middleware — RevenueController has no internal assertAdmin().
        Route::middleware('admin')->get('/revenue', [\App\Http\Controllers\Api\Admin\RevenueController::class, 'index']);

        // Recipe management (§E1) — feature/unfeature/remove, real persistence.
        // `admin` middleware here, not an internal assertAdmin() call — these
        // are new Admin\* controllers, which use route-level gating (the
        // CouponOffer/VibeCall/Resource pattern above), not AdminController's
        // older per-method check. Missing this would leave any authenticated
        // member able to feature or delete any recipe.
        Route::middleware('admin')->prefix('recipes')->group(function () {
            $ra = \App\Http\Controllers\Api\Admin\RecipeAdminController::class;
            // Every recipe including submissions. The member endpoint only
            // returns approved ones now, so the review queue needs its own.
            Route::get('/',            [$ra, 'index']);
            Route::put('/{recipe}',    [$ra, 'update']);
            // Review queue, mirroring the Groups approval flow: only an admin
            // moves a member's recipe into the shared library, and a rejection
            // carries a reason the author is notified with.
            Route::post('/{recipe}/approve', [$ra, 'approve']);
            Route::post('/{recipe}/reject',  [$ra, 'reject']);
            Route::delete('/{recipe}', [$ra, 'destroy']);
        });

        // Bulk email campaigns (§E1).
        Route::middleware('admin')->prefix('email-campaigns')->group(function () {
            $ec = \App\Http\Controllers\Api\Admin\EmailCampaignController::class;
            Route::get('/',              [$ec, 'index']);
            Route::post('/',             [$ec, 'store']);
            Route::post('/{campaign}/send', [$ec, 'send'])->middleware('throttle:5,1');
        });

        // New user monitoring (§E2).
        Route::middleware('admin')->get('/new-users', [\App\Http\Controllers\Api\Admin\NewUserController::class, 'index']);

        // Undercover admin accounts (§E3).
        Route::middleware('admin')->prefix('undercover')->group(function () {
            $u = \App\Http\Controllers\Api\Admin\UndercoverController::class;
            Route::get('/',        [$u, 'index']);
            Route::post('/',       [$u, 'store']);
            Route::put('/{account}',    [$u, 'update']);
            Route::delete('/{account}', [$u, 'destroy']);
        });

        // Content flagging queue (§E4).
        Route::middleware('admin')->prefix('content-flags')->group(function () {
            $cf = \App\Http\Controllers\Api\Admin\ContentFlagController::class;
            Route::get('/',                 [$cf, 'index']);
            Route::get('/pending-count',    [$cf, 'pendingCount']);
            Route::post('/{contentFlag}/dismiss',  [$cf, 'dismiss']);
            Route::post('/{contentFlag}/escalate', [$cf, 'escalate']);

            Route::get('/keywords',              [$cf, 'keywords']);
            Route::post('/keywords',             [$cf, 'storeKeyword']);
            Route::put('/keywords/{flagKeyword}',    [$cf, 'updateKeyword']);
            Route::delete('/keywords/{flagKeyword}', [$cf, 'destroyKeyword']);
        });

        // Beta launch tooling (§E6).
        Route::middleware('admin')->prefix('beta')->group(function () {
            $b = \App\Http\Controllers\Api\Admin\BetaController::class;
            Route::get('/status',        [$b, 'status']);
            Route::post('/toggle',       [$b, 'toggle']);
            Route::get('/allowlist',     [$b, 'index']);
            Route::post('/allowlist',    [$b, 'store']);
            Route::delete('/allowlist/{betaAllowlist}', [$b, 'destroy']);
        });
        Route::get('/groups/pending',        [\App\Http\Controllers\Api\GroupController::class, 'pending']);
        Route::post('/groups/{group}/approve', [\App\Http\Controllers\Api\GroupController::class, 'approve']);
        Route::post('/groups/{group}/reject',  [\App\Http\Controllers\Api\GroupController::class, 'reject']);

        // Coaching portal admin (§6.5.2) — the only place `approve()` can run.
        Route::middleware('admin')->prefix('coaching-authorizations')->group(function () {
            $c = \App\Http\Controllers\Api\Admin\CoachingAdminController::class;
            Route::get('/',                       [$c, 'index']);
            Route::post('/{authorization}/approve', [$c, 'approve']);
            Route::post('/{authorization}/reject',  [$c, 'reject']);
            Route::post('/{authorization}/revoke',  [$c, 'revoke']);
            Route::get('/{authorization}/messages', [$c, 'messages']);
            Route::post('/{authorization}/messages',[$c, 'reply']);
        });
    });
});

// ── Coaching portal — physicians only (§6.5.1) ──────────────────────────────
// Entirely separate from every route above: different guard (`physician`,
// config/auth.php), different provider, different controllers. A member's
// Sanctum token cannot authenticate here (Guard::hasValidProvider() rejects
// it) and a physician's token cannot authenticate against `auth:sanctum`
// above for the same reason, symmetrically.
Route::prefix('coaching')->group(function () {
    $auth = \App\Http\Controllers\Coaching\PhysicianAuthController::class;
    Route::post('/login', [$auth, 'login'])->middleware('throttle:10,1');

    // Invite acceptance is unauthenticated by necessity — the physician has no
    // account yet. The token itself (72h, single-use, hashed at rest) is the
    // only credential, so this is throttled hard.
    $invite = \App\Http\Controllers\Coaching\InviteController::class;
    Route::get('/invite/{token}',        [$invite, 'show'])->middleware('throttle:20,1');
    Route::post('/invite/{token}/accept',[$invite, 'accept'])->middleware('throttle:10,1');

    Route::middleware(['auth:physician', 'physician.active', 'throttle:120,1'])->group(function () use ($auth) {
        Route::post('/logout', [$auth, 'logout']);
        Route::get('/me',      [$auth, 'me']);

        Route::get('/patients', [\App\Http\Controllers\Coaching\PatientController::class, 'index']);

        Route::prefix('patients/{authorization}')->group(function () {
            $d = \App\Http\Controllers\Coaching\PatientDataController::class;
            Route::get('/workouts',   [$d, 'workouts']);
            Route::get('/nutrition',  [$d, 'nutrition']);
            Route::get('/body-stats', [$d, 'bodyStats']);

            $m = \App\Http\Controllers\Coaching\MessageController::class;
            Route::get('/messages',  [$m, 'index']);
            Route::post('/messages', [$m, 'store']);
        });
    });
});
