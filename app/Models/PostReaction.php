<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostReaction extends Model
{
    protected $fillable = ['post_id', 'user_id', 'reaction'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function post(): BelongsTo { return $this->belongsTo(SocialPost::class, 'post_id'); }
}
