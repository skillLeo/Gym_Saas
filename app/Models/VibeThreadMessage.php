<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VibeThreadMessage extends Model
{
    use SoftDeletes;

    protected $fillable = ['user_id', 'body', 'is_admin_post', 'reply_to_id', 'edited_at'];

    protected $casts = [
        'is_admin_post' => 'boolean',
        'edited_at'     => 'datetime',
    ];

    public function user()    { return $this->belongsTo(User::class); }
    public function replyTo() { return $this->belongsTo(self::class, 'reply_to_id'); }
}
