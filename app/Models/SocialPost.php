<?php
namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SocialPost extends Model
{
    protected $table = 'social_posts';

    protected $fillable = ['user_id', 'content', 'image_url', 'post_type'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(PostReaction::class, 'post_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class, 'post_id')->whereNull('parent_id')->with('user', 'replies.user')->orderBy('created_at');
    }

    /**
     * Every comment on the post, replies included and nothing eager-loaded.
     *
     * `comments()` is deliberately scoped to top-level rows and eager-loads
     * users, so it cannot be used with withCount(). This exists purely so the
     * feed can eager-count the true total in one query instead of running two
     * COUNT(*) queries per post — which was a real N+1: a page of 20 posts cost
     * 40 extra round trips for a number the list query can produce in one.
     */
    public function allComments(): HasMany
    {
        return $this->hasMany(PostComment::class, 'post_id');
    }

    /**
     * Stored as a disk-relative path; resolved against the current APP_URL on
     * read. See App\Support\MediaUrl — the origin used to be baked into the
     * column, which broke every image whenever the host or port changed.
     */
    protected function imageUrl(): Attribute
    {
        return MediaUrl::cast();
    }
}
