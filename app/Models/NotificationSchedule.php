<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class NotificationSchedule extends Model
{
    protected $fillable = ['name', 'days_of_week', 'send_time', 'timezone', 'is_active'];

    protected $casts = [
        'days_of_week' => 'array',
        'is_active'    => 'boolean',
        'last_run_at'  => 'datetime',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** "Now" in this schedule's own timezone. */
    public function localNow(): Carbon
    {
        return now()->setTimezone($this->timezone ?: 'UTC');
    }

    /**
     * Is this schedule due to run?
     *
     * Three conditions, all evaluated in the schedule's timezone:
     *   - today is one of its configured days
     *   - its send time has passed today
     *   - it has not already run today
     *
     * The last check is what makes the sender safe to call every minute: the
     * scheduler ticks constantly, and without it every tick after the send time
     * would fire another round of notifications.
     */
    public function isDue(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $local = $this->localNow();

        $days = array_map('intval', $this->days_of_week ?? []);
        if (!in_array($local->dayOfWeekIso, $days, true)) {
            return false;
        }

        if ($local->format('H:i:s') < $this->sendTimeString()) {
            return false;
        }

        if ($this->last_run_at) {
            $lastLocal = $this->last_run_at->copy()->setTimezone($this->timezone ?: 'UTC');
            if ($lastLocal->isSameDay($local)) {
                return false;
            }
        }

        return true;
    }

    /**
     * `send_time` comes back as either H:i:s or a full datetime depending on the
     * driver, so normalise before comparing.
     */
    public function sendTimeString(): string
    {
        $raw = (string) $this->send_time;

        if (preg_match('/(\d{2}:\d{2}:\d{2})/', $raw, $m)) {
            return $m[1];
        }

        return str_pad($raw, 8, '0', STR_PAD_LEFT);
    }

    /** Human-readable day list, e.g. "Mon, Wed, Fri". */
    public function getDayLabelsAttribute(): string
    {
        $names = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
        $days  = array_map('intval', $this->days_of_week ?? []);
        sort($days);

        return implode(', ', array_map(fn ($d) => $names[$d] ?? '?', $days));
    }
}
