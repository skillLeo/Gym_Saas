<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class VibeCallSchedule extends Model
{
    protected $fillable = [
        'title', 'description', 'days_of_week', 'time_of_day', 'duration_minutes',
        'timezone', 'auto_create_days_ahead', 'is_active',
    ];

    protected $casts = [
        'days_of_week'           => 'array',
        'is_active'              => 'boolean',
        'duration_minutes'       => 'integer',
        'auto_create_days_ahead' => 'integer',
        'last_generated_through' => 'date',
    ];

    public function sessions()
    {
        return $this->hasMany(LiveSession::class, 'schedule_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * `time_of_day` comes back as either H:i:s or a full datetime depending on
     * the driver, so normalise before use. Same reasoning as
     * NotificationSchedule::sendTimeString().
     */
    public function timeString(): string
    {
        $raw = (string) $this->time_of_day;

        return preg_match('/(\d{2}:\d{2}:\d{2})/', $raw, $m)
            ? $m[1]
            : str_pad($raw, 8, '0', STR_PAD_LEFT);
    }

    /**
     * Occurrence datetimes between two dates, in UTC.
     *
     * Each occurrence is built in the schedule's own timezone and then
     * converted, so "7pm" means 7pm where the members are — not 7pm UTC — and
     * daylight-saving shifts are handled by the conversion rather than by
     * arithmetic on a stored offset.
     *
     * @return array<Carbon>
     */
    public function occurrencesBetween(Carbon $fromUtc, Carbon $toUtc): array
    {
        $tz   = $this->timezone ?: 'UTC';
        $days = array_map('intval', $this->days_of_week ?? []);

        if ($days === []) {
            return [];
        }

        $out    = [];
        $cursor = $fromUtc->copy()->setTimezone($tz)->startOfDay();
        $end    = $toUtc->copy()->setTimezone($tz)->endOfDay();

        while ($cursor->lessThanOrEqualTo($end)) {
            if (in_array($cursor->dayOfWeekIso, $days, true)) {
                [$h, $i, $s] = array_map('intval', explode(':', $this->timeString()));
                $at = $cursor->copy()->setTime($h, $i, $s)->setTimezone('UTC');

                if ($at->betweenIncluded($fromUtc, $toUtc)) {
                    $out[] = $at;
                }
            }

            $cursor->addDay();
        }

        return $out;
    }

    public function getDayLabelsAttribute(): string
    {
        $names = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
        $days  = array_map('intval', $this->days_of_week ?? []);
        sort($days);

        return implode(', ', array_map(fn ($d) => $names[$d] ?? '?', $days));
    }
}
