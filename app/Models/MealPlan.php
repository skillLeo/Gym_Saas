<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealPlan extends Model
{
    protected $fillable = [
        'user_id', 'recipe_id', 'recipe_name',
        'week_start', 'day_of_week', 'meal_slot', 'notes',
    ];

    protected $casts = [
        'week_start'   => 'date',
        'day_of_week'  => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }
}
