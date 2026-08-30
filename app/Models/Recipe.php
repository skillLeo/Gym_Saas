<?php

namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recipe extends Model
{
    /** Only a member's own recipe is ever anything but APPROVED. */
    public const PRIVATE  = 'private';   // written, not submitted — author only
    public const PENDING  = 'pending';   // submitted, waiting on an admin
    public const APPROVED = 'approved';  // in the shared library
    public const REJECTED = 'rejected';  // declined, with a reason

    /**
     * Library visibility is decided here and nowhere else.
     *
     * `is_public` used to be that switch, defaulting to true, so a member's
     * recipe reached every other member the moment it was saved.
     */
    public function scopeInLibrary($query)
    {
        return $query->where('status', self::APPROVED);
    }

    protected $fillable = [
        'user_id', 'name', 'description', 'image_url', 'category', 'difficulty',
        'tags', 'prep_time', 'cook_time', 'servings',
        'calories', 'protein', 'carbs', 'fat', 'fiber',
        'ingredients', 'instructions', 'is_public', 'is_featured',
        // 'status' and 'rejection_reason' are deliberately NOT fillable: they
        // decide who can see a recipe, so they are written explicitly by the
        // controller and are never reachable through mass assignment.
        // rating and reviews_count excluded — updated only by system, not user input
    ];

    protected $casts = [
        'tags'         => 'array',
        'ingredients'  => 'array',
        'instructions' => 'array',
        'is_public'    => 'boolean',
        'is_featured'  => 'boolean',
        'rating'       => 'float',
        'protein'      => 'float',
        'carbs'        => 'float',
        'fat'          => 'float',
        'fiber'        => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function savedByUsers(): HasMany
    {
        return $this->hasMany(SavedRecipe::class);
    }

    public function mealPlans(): HasMany
    {
        return $this->hasMany(MealPlan::class);
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
