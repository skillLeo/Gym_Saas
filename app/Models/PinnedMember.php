<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PinnedMember extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'pinned_user_id'];

    public function owner()  { return $this->belongsTo(User::class, 'user_id'); }
    public function pinned() { return $this->belongsTo(User::class, 'pinned_user_id'); }
}
