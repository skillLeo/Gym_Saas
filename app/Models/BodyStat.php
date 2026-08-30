<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class BodyStat extends Model
{
    use HasFactory;
    protected $fillable = ['user_id','logged_date','weight_lbs','body_fat_pct','waist_inches','hips_inches','chest_inches','arms_inches','thighs_inches','notes'];
    protected $casts = ['logged_date' => 'date'];
    public function user() { return $this->belongsTo(User::class); }
}
