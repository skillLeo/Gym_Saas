<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FitnessGoal extends Model
{
    use HasFactory;
    // `icon_name` holds a Lucide icon name (§1.5). The legacy `emoji` column was
    // dropped in 2026_07_31_000002.
    protected $fillable = ['user_id','title','category','goal_type','target_value','current_value','unit','deadline','icon_name','color','completed','lower_is_better'];
    protected $casts = ['deadline' => 'date:Y-m-d', 'completed' => 'boolean', 'lower_is_better' => 'boolean'];
    public function user() { return $this->belongsTo(User::class); }
}
