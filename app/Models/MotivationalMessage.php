<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MotivationalMessage extends Model
{
    protected $fillable = ['title', 'body', 'is_active', 'created_by'];

    protected $casts = [
        'is_active'    => 'boolean',
        'last_sent_at' => 'datetime',
        'send_count'   => 'integer',
    ];

    public function author()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
