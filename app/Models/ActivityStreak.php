<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityStreak extends Model
{
    public const TYPES = ['workout', 'meal_log', 'engagement', 'overall'];

    protected $fillable = [
        'user_id', 'streak_type', 'current_count', 'longest_count',
        'last_activity_date', 'started_on',
    ];

    protected $casts = [
        'current_count'      => 'integer',
        'longest_count'      => 'integer',
        'last_activity_date' => 'date',
        'started_on'         => 'date',
    ];

    public function user() { return $this->belongsTo(User::class); }

    /**
     * A streak is only "live" if it includes today or yesterday. Anything older
     * has been broken by a missed day, even though the row still records what
     * it reached.
     */
    public function isLive(): bool
    {
        if (!$this->last_activity_date || $this->current_count < 1) {
            return false;
        }

        return $this->last_activity_date->greaterThanOrEqualTo(today()->subDay());
    }
}
