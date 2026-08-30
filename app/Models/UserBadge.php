<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserBadge extends Model
{
    protected $fillable = [
        'user_id', 'badge_id', 'awarded_at', 'period_start', 'period_end', 'meta',
    ];

    protected $casts = [
        'awarded_at'   => 'datetime',
        'period_start' => 'date',
        'period_end'   => 'date',
        'meta'         => 'array',
    ];

    public function user()  { return $this->belongsTo(User::class); }
    public function badge() { return $this->belongsTo(Badge::class); }
}
