<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FoodLogEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id','food_item_id','meal_type','logged_date','servings',
        'total_calories','total_protein_g','total_carbs_g','total_fat_g',
    ];

    protected $casts = ['logged_date' => 'date'];

    public function user() { return $this->belongsTo(User::class); }
    public function foodItem() { return $this->belongsTo(FoodItem::class); }
}
