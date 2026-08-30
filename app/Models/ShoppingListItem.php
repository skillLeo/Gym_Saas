<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShoppingListItem extends Model
{
    protected $fillable = [
        'user_id','name','quantity','unit','category','checked',
    ];

    protected $casts = ['checked' => 'boolean'];

    public function user() { return $this->belongsTo(User::class); }
}
