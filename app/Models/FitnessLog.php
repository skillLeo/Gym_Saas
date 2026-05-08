<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FitnessLog extends Model
{
    use HasFactory;
    protected $fillable = ['user_id','exercise_name','category','duration_minutes','calories_burned','logged_date','notes'];
    protected $casts = ['logged_date' => 'date'];
    public function user() { return $this->belongsTo(User::class); }
}
