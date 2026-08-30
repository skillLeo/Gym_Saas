<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Badge extends Model
{
    protected $fillable = [
        'key', 'name', 'description', 'icon_name', 'tier',
        'criteria_type', 'criteria', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'criteria'   => 'array',
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    public function userBadges()
    {
        return $this->hasMany(UserBadge::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
