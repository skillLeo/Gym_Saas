<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminShadowAccount extends Model
{
    protected $fillable = ['user_id', 'created_by_admin_id', 'label', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function createdByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_admin_id');
    }
}
