<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ResourceView extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['resource_id', 'user_id', 'action'];

    public function resource() { return $this->belongsTo(Resource::class); }
    public function user()     { return $this->belongsTo(User::class); }
}
