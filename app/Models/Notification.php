<?php
namespace App\Models;

use App\Support\MediaUrl;
use App\Support\NotificationCategory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'user_id','type','title','body','data',
        'actor_name','actor_avatar','link','read_at',
    ];

    protected $casts = [
        'data'    => 'array',
        'read_at' => 'datetime',
    ];

    /**
     * Enforce category mutes at the single point every notification passes
     * through.
     *
     * There are four separate Notification::create() call sites and more will
     * follow. Checking the mute in each one means the next feature to add a
     * notification silently ignores the member's preference, so the check lives
     * here instead: a muted category is simply never written.
     *
     * NOTE: this does not cover Notification::insert(), which bypasses model
     * events by design. The one bulk caller (live sessions) filters its own
     * recipient list — see LiveController::notifyMembersLive().
     */
    protected static function booted(): void
    {
        static::creating(function (self $notification) {
            $user = User::find($notification->user_id);

            if ($user && $user->hasMutedCategory(NotificationCategory::forType($notification->type))) {
                return false; // cancels the insert
            }
        });
    }

    /** Which section of the notifications page this belongs to. */
    public function category(): string
    {
        return NotificationCategory::forType($this->type);
    }

    public function user() { return $this->belongsTo(User::class); }

    /**
     * Stored as a disk-relative path; resolved against the current APP_URL on
     * read. See App\Support\MediaUrl — the origin used to be baked into the
     * column, which broke every image whenever the host or port changed.
     */
    protected function actorAvatar(): Attribute
    {
        return MediaUrl::cast();
    }
}
