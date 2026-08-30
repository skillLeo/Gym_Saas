<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeedFeature extends Model
{
    protected $fillable = [
        'user_id', 'feature_type', 'period_start', 'period_end', 'expires_at', 'dismissed_at',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end'   => 'date',
        'expires_at'   => 'datetime',
        'dismissed_at' => 'datetime',
    ];

    public function user() { return $this->belongsTo(User::class); }

    /** Currently eligible to appear in a feed. */
    public function scopeLive($query)
    {
        return $query->whereNull('dismissed_at')->where('expires_at', '>', now());
    }
}
