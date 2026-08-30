<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Resource extends Model
{
    /**
     * Upload rules (§5.3). Both the MIME type and the extension are checked —
     * a file named `.pdf` carrying a PHP payload must fail, and so must a real
     * PDF renamed `.php`.
     */
    public const ALLOWED_MIME = [
        'pdf'   => ['application/pdf'],
        'video' => ['video/mp4', 'video/webm', 'video/quicktime'],
    ];

    public const ALLOWED_EXT = [
        'pdf'   => ['pdf'],
        'video' => ['mp4', 'webm', 'mov'],
    ];

    /** Per-type size caps in kilobytes. */
    public const MAX_KB = [
        'pdf'   => 25 * 1024,   // 25 MB
        'video' => 500 * 1024,  // 500 MB
    ];

    /** Files live on this disk, which is NOT web-accessible. */
    public const DISK = 'resources';

    protected $fillable = [
        'category_id', 'title', 'description', 'type',
        'file_path', 'file_size_bytes', 'mime_type', 'external_url',
        'thumbnail_path', 'duration_seconds', 'is_published', 'published_at', 'created_by',
    ];

    protected $casts = [
        'is_published'     => 'boolean',
        'published_at'     => 'datetime',
        'file_size_bytes'  => 'integer',
        'duration_seconds' => 'integer',
        'view_count'       => 'integer',
        'download_count'   => 'integer',
    ];

    public function category() { return $this->belongsTo(ResourceCategory::class, 'category_id'); }
    public function author()   { return $this->belongsTo(User::class, 'created_by'); }
    public function views()    { return $this->hasMany(ResourceView::class); }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    /**
     * Human-readable size, or null for link-type resources.
     *
     * Falls through to bytes below 1 KB: rounding to "0 KB" told members a real
     * file was empty.
     */
    public function getFileSizeLabelAttribute(): ?string
    {
        $bytes = $this->file_size_bytes;

        if (!$bytes) return null;

        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 1) . ' MB';
        }

        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 0) . ' KB';
        }

        return $bytes . ' bytes';
    }
}
