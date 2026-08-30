<?php
namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Video extends Model
{
    protected $fillable = [
        'title','description','video_url','thumbnail_url',
        'duration_seconds','category','tags','muscle_groups',
        'equipment','difficulty','instructor',
        'is_featured','is_active',
        // views and likes excluded — incremented only via increment() calls, never user-supplied
    ];

    protected $casts = [
        'tags'          => 'array',
        'muscle_groups' => 'array',
        'equipment'     => 'array',
        'is_featured'   => 'boolean',
        'is_active'     => 'boolean',
    ];

    public function savedByUsers() {
        return $this->belongsToMany(User::class, 'video_saves');
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

    /**
     * Stored as a disk-relative path; resolved against the current APP_URL on
     * read. See App\Support\MediaUrl — the origin used to be baked into the
     * column, which broke every image whenever the host or port changed.
     */
    protected function videoUrl(): Attribute
    {
        return MediaUrl::cast();
    }
}
