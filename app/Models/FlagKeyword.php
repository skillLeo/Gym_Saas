<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FlagKeyword extends Model
{
    protected $fillable = ['term', 'severity', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
