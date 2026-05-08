<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FoodItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'nutritionix_id','name','brand','serving_qty','serving_unit',
        'serving_weight_grams','calories','protein_g','carbs_g','fat_g',
        'fiber_g','sugar_g','sodium_mg','is_custom','created_by_user_id',
    ];

    protected $casts = ['is_custom' => 'boolean'];

    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
    public function foodLogEntries() { return $this->hasMany(FoodLogEntry::class); }
}
