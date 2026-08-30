<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserNameAlias extends Model
{
    /** Rebuilt wholesale on every sync, so only created_at is meaningful. */
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'alias', 'type'];

    public function user() { return $this->belongsTo(User::class); }
}
