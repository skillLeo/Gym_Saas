<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CalendarEvent extends Model
{
    protected $fillable = [
        'user_id','live_session_id','title','type','date','time','end_time','notes','color',
    ];

    protected $casts = ['date' => 'date'];

    public function user() { return $this->belongsTo(User::class); }

    public function liveSession() { return $this->belongsTo(LiveSession::class, 'live_session_id'); }

    /**
     * A platform-wide event has no owner (§5.2) — it is visible to everyone and
     * editable by nobody except an admin, through the Vibe Call schedule.
     */
    public function isPlatformWide(): bool { return $this->user_id === null; }

    /** Events this member should see: their own, plus platform-wide ones. */
    public function scopeVisibleTo($query, int $userId)
    {
        return $query->where(fn ($q) => $q->where('user_id', $userId)->orWhereNull('user_id'));
    }
}
