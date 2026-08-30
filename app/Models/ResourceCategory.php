<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ResourceCategory extends Model
{
    protected $fillable = ['name', 'slug', 'description', 'icon_name', 'sort_order', 'is_active'];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    public function resources()
    {
        return $this->hasMany(Resource::class, 'category_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
