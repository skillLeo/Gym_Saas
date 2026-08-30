<?php
namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = ['conversation_id','sender_id','content','image_url'];

    public function sender() { return $this->belongsTo(User::class, 'sender_id'); }
    public function conversation() { return $this->belongsTo(Conversation::class); }

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
