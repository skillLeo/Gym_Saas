<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiveSessionComment extends Model
{
    protected $fillable = ['live_session_id','user_id','content'];

    public function user() { return $this->belongsTo(User::class); }
    public function session() { return $this->belongsTo(LiveSession::class, 'live_session_id'); }
}
