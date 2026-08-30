<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Group extends Model
{
    protected $table = 'groups';
    protected $fillable = ['creator_id', 'name', 'description', 'cover_color', 'status', 'rejection_reason'];

    public function creator() { return $this->belongsTo(User::class, 'creator_id'); }
    public function members() { return $this->belongsToMany(User::class, 'group_members')->withTimestamps(); }
}
