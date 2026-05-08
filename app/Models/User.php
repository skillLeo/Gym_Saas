<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'password', 'avatar', 'bio', 'date_of_birth', 'gender',
        'height_cm', 'current_weight_kg', 'goal_weight_kg', 'activity_level',
        'primary_goal', 'daily_calorie_goal', 'daily_protein_goal_g',
        'daily_carbs_goal_g', 'daily_fat_goal_g', 'daily_water_goal_glasses',
        'trial_starts_at', 'trial_ends_at', 'trial_reminder_sent',
        'subscription_status', 'onboarding_completed', 'is_admin',
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

    public function customFoodItems()
    {
        return $this->hasMany(FoodItem::class, 'created_by_user_id');
    }

    public function isOnTrial(): bool
    {
        return $this->subscription_status === 'trial'
            && $this->trial_ends_at
            && $this->trial_ends_at->isFuture();
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

    public function getAvatarUrlAttribute(): string
    {
        if ($this->avatar) {
            return url('storage/' . $this->avatar);
        }
        $initial = strtoupper(substr($this->name, 0, 1));
        return "https://ui-avatars.com/api/?name=" . urlencode($this->name) . "&background=1E6FD9&color=fff&size=200";
    }
}
