<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Todo extends Model
{
    protected $fillable = [
        'user_id','text','completed','due_date','priority',
    ];

    protected $casts = [
        'completed' => 'boolean',
        'due_date'  => 'date',
    ];

    public function user() { return $this->belongsTo(User::class); }
}
