<?php

namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name', 'username', 'email', 'google_id', 'password', 'avatar', 'bio', 'date_of_birth', 'gender',
        'height_cm', 'current_weight_kg', 'goal_weight_kg', 'activity_level',
        'primary_goal', 'daily_calorie_goal', 'daily_protein_goal_g',
        'daily_carbs_goal_g', 'daily_fat_goal_g', 'daily_water_goal_glasses',
        'nickname', 'alternate_names',
        'email_notifications', 'billboard',
        'trial_starts_at', 'trial_ends_at', 'trial_reminder_sent',
        'onboarding_completed',
        // Deliberately NOT fillable — these decide access and money, so they must
        // never be reachable through mass assignment. Write them with forceFill()
        // so every change is explicit and greppable:
        //   is_admin              — AdminController only
        //   account_state         — UserAccountState service ONLY
        //   subscription_status   — UserAccountState service ONLY (derived mirror)
        //   deactivated_at        — UserAccountState service ONLY
        //   scheduled_deletion_at — UserAccountState service ONLY
        //   stripe_customer_id    — SubscriptionController / StripeWebhookController
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'trial_starts_at'   => 'datetime',
            'trial_ends_at'     => 'datetime',
            'date_of_birth'     => 'date',
            'password'          => 'hashed',
            'trial_reminder_sent'    => 'boolean',
            'onboarding_completed'   => 'boolean',
            'is_admin'               => 'boolean',
            'alternate_names'        => 'array',
            'email_notifications'    => 'boolean',
            'billboard'              => 'array',
            'muted_notification_categories' => 'array',
            'deactivated_at'         => 'datetime',
            'scheduled_deletion_at'  => 'datetime',
        ];
    }

    public function foodLogEntries()
    {
        return $this->hasMany(FoodLogEntry::class);
    }

    public function waterLogs()
    {
        return $this->hasMany(WaterLog::class);
    }

    public function fitnessLogs()
    {
        return $this->hasMany(FitnessLog::class);
    }

    public function posts()
    {
        return $this->hasMany(SocialPost::class);
    }

    public function followers()
    {
        return $this->hasMany(Follow::class, 'following_id');
    }

    public function following()
    {
        return $this->hasMany(Follow::class, 'follower_id');
    }

    public function customFoodItems()
    {
        return $this->hasMany(FoodItem::class, 'created_by_user_id');
    }

    public function nameAliases()
    {
        return $this->hasMany(UserNameAlias::class);
    }

    /**
     * Keep the searchable alias projection in step with the member record (§5.6).
     *
     * Rebuilt wholesale rather than diffed: the list is small, and a full
     * rebuild cannot leave a stale row behind the way an incremental update can
     * when an entry is removed.
     */
    public function syncNameAliases(): void
    {
        $rows = [];

        if (filled($this->nickname)) {
            $rows[] = ['alias' => trim($this->nickname), 'type' => 'nickname'];
        }

        foreach (($this->alternate_names ?? []) as $entry) {
            // Accepts either a bare string or {name, type}, so the column can
            // hold a simple list without forcing callers into a shape.
            $alias = is_array($entry) ? ($entry['name'] ?? null) : $entry;
            $type  = is_array($entry) ? ($entry['type'] ?? 'alternate') : 'alternate';

            if (!is_string($alias) || trim($alias) === '') continue;
            if (!in_array($type, ['maiden', 'previous', 'nickname', 'alternate'], true)) {
                $type = 'alternate';
            }

            $rows[] = ['alias' => mb_substr(trim($alias), 0, 120), 'type' => $type];
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($rows) {
            UserNameAlias::where('user_id', $this->id)->delete();

            if ($rows === []) return;

            UserNameAlias::insert(array_map(fn ($r) => $r + [
                'user_id'    => $this->id,
                'created_at' => now(),
            ], $rows));
        });
    }

    /**
     * Members matching a search term across every name they go by.
     *
     * One indexed query: display name, username and nickname on `users`, plus
     * the flattened alias table. A maiden name and a nickname both resolve to
     * the same profile, which is the whole point of §5.6.
     */
    public function scopeSearchByAnyName($query, string $term)
    {
        $like = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($term)) . '%';

        return $query->where(function ($q) use ($like) {
            $q->where('name', 'like', $like)
              ->orWhere('username', 'like', $like)
              ->orWhere('nickname', 'like', $like)
              ->orWhereHas('nameAliases', fn ($a) => $a->where('alias', 'like', $like));
        });
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * The subscription that currently entitles this user, if any.
     *
     * A user can accumulate several rows over time (upgrades, cancel-then-
     * resubscribe), so this picks the newest entitling one rather than assuming
     * there is only ever one.
     */
    public function activeSubscription()
    {
        return $this->subscriptions()
            ->whereIn('status', Subscription::ENTITLED_STATUSES)
            ->latest('id')
            ->first();
    }

    /**
     * Has this member silenced a whole category of notifications?
     *
     * Muting stops the notification being CREATED at all, which is what a
     * member means by "stop telling me about likes" — not "keep telling me but
     * hide the number".
     */
    public function hasMutedCategory(string $category): bool
    {
        return in_array($category, $this->muted_notification_categories ?? [], true);
    }

    public function isOnTrial(): bool
    {
        // Paying beats the calendar. The trial dates stay on the record after
        // someone subscribes, so judging on dates alone told a paying member
        // they had "21 days left on your trial" — on the dashboard, in settings
        // and on their profile — while their card had just been charged.
        //
        // Same precedence as UserAccountState::derive(), which already ranks a
        // live subscription above an unexpired trial.
        if ($this->activeSubscription()) {
            return false;
        }

        // Staff are never on a trial of their own product. `hasAccess()` has
        // always exempted admins, but the trial DATES were still set at
        // registration, so the owner's dashboard counted down to the expiry of a
        // trial he was never on and his membership page invited him to buy the
        // software he sells.
        if ($this->is_admin) {
            return false;
        }

        // Otherwise read the dates directly rather than a status column, so a
        // user whose state has not been recomputed yet is still judged on facts.
        return $this->trial_ends_at !== null && $this->trial_ends_at->isFuture();
    }

    public function isInGrace(): bool
    {
        return $this->account_state === \App\Services\UserAccountState::GRACE;
    }

    public function isDeactivated(): bool
    {
        return $this->account_state === \App\Services\UserAccountState::DEACTIVATED;
    }

    /**
     * May this user use paid features?
     *
     * True for staff, an unexpired trial, or a live subscription. This is the
     * single question feature gating should ask — never inspect
     * `subscription_status` directly at a call site.
     *
     * Admins are exempt: staff run the product and must reach the admin panel
     * without holding a paid plan. Without this the owner's own account is
     * locked out of the software they sell.
     *
     * An admin-forced deactivation always wins, even for an admin account or
     * a still-unexpired trial — `isOnTrial()` otherwise judges on the trial
     * dates, so without this check here first, deactivating a user mid-trial
     * (the most common reason to deactivate someone) silently did nothing.
     */
    public function hasAccess(): bool
    {
        if ($this->account_state === \App\Services\UserAccountState::DEACTIVATED) {
            return false;
        }

        return (bool) $this->is_admin
            || $this->isOnTrial()
            || $this->activeSubscription() !== null;
    }

    public function trialDaysRemaining(): int
    {
        if (!$this->trial_ends_at) return 0;
        return max(0, (int) now()->diffInDays($this->trial_ends_at, false));
    }

    public function calculateDailyCalories(): int
    {
        if (!$this->height_cm || !$this->current_weight_kg || !$this->date_of_birth) {
            return 2000;
        }

        $age = $this->date_of_birth->age;
        $weight = (float) $this->current_weight_kg;
        $height = (float) $this->height_cm;

        if ($this->gender === 'female') {
            $bmr = 447.593 + (9.247 * $weight) + (3.098 * $height) - (4.330 * $age);
        } else {
            $bmr = 88.362 + (13.397 * $weight) + (4.799 * $height) - (5.677 * $age);
        }

        $multipliers = [
            'sedentary'          => 1.2,
            'lightly_active'     => 1.375,
            'moderately_active'  => 1.55,
            'very_active'        => 1.725,
            'extra_active'       => 1.9,
        ];

        $multiplier = $multipliers[$this->activity_level ?? 'sedentary'] ?? 1.2;
        $tdee = $bmr * $multiplier;

        $adjustments = [
            'lose_weight'      => -500,
            'maintain_weight'  => 0,
            'gain_muscle'      => 300,
            'improve_fitness'  => 0,
            'eat_healthier'    => 0,
        ];

        $adjustment = $adjustments[$this->primary_goal ?? 'maintain_weight'] ?? 0;

        return max(1200, (int) round($tdee + $adjustment));
    }

    /**
     * A unique, URL-safe username derived from a display name.
     *
     * Public profiles are addressed by username: the API route is
     * `/social/users/{username}` and the frontend links to `/social/{username}`.
     * A user with a NULL username therefore has an unreachable profile, and
     * every list that links to them renders `/social/null`, which lands on
     * "User not found". `AdminUserSeeder` and `TestUserSeeder` set no username,
     * so a seeded deployment shipped with exactly that: clicking the client's
     * own name in Find Members went nowhere.
     *
     * Registration had its own copy of this logic. One implementation now, used
     * by registration, the seeders and the backfill migration alike.
     */
    public static function generateUsername(?string $displayName): string
    {
        $base = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', (string) $displayName)) ?: 'user';
        $username = $base . rand(100, 9999);

        while (static::withTrashed()->where('username', $username)->exists()) {
            $username = $base . rand(1000, 99999);
        }

        return $username;
    }

    public function getAvatarUrlAttribute(): string
    {
        // Avatars were already stored as a bare path rather than a full URL, so
        // this column never had the origin baked into it. Routed through the
        // shared resolver anyway so a value that arrives absolute — a future
        // social-login picture, say — is passed through instead of being
        // mangled into "storage/https://...".
        if ($this->avatar) {
            return MediaUrl::resolve($this->avatar);
        }
        $initial = strtoupper(substr($this->name, 0, 1));
        return "https://ui-avatars.com/api/?name=" . urlencode($this->name) . "&background=1E6FD9&color=fff&size=200";
    }
}
