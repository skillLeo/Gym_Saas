<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class WaterLog extends Model
{
    use HasFactory;
    protected $fillable = ['user_id','logged_date','glasses_count'];
    protected $casts = ['logged_date' => 'date'];
    public function user() { return $this->belongsTo(User::class); }
}
