<?php
namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class LiveSession extends Model
{
    protected $fillable = [
        'title','description','instructor_name','thumbnail_url',
        'stream_url','status','scheduled_at','viewers_count',
        'likes_count','duration_minutes','category','difficulty',
        'is_vibe_call','schedule_id',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'is_vibe_call' => 'boolean',
    ];

    public function comments() {
        return $this->hasMany(LiveSessionComment::class)->orderBy('created_at');
    }

    /** Set only when this session was materialised from a recurring rule (§5.2). */
    public function schedule() {
        return $this->belongsTo(VibeCallSchedule::class, 'schedule_id');
    }

    public function calendarEvent() {
        return $this->hasOne(CalendarEvent::class, 'live_session_id');
    }

    public function scopeVibeCalls($query) {
        return $query->where('is_vibe_call', true);
    }

    /**
     * Stored as a disk-relative path; resolved against the current APP_URL on
     * read. See App\Support\MediaUrl — the origin used to be baked into the
     * column, which broke every image whenever the host or port changed.
     */
    protected function thumbnailUrl(): Attribute
    {
        return MediaUrl::cast();
    }
}
