<?php
namespace App\Models;
use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FoodLogEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id','food_item_id','meal_type','meal_slot_id','logged_date','servings',
        'total_calories','total_protein_g','total_carbs_g','total_fat_g','image_url',
    ];

    protected $casts = ['logged_date' => 'date'];

    public function user() { return $this->belongsTo(User::class); }
    public function foodItem() { return $this->belongsTo(FoodItem::class); }
    public function mealSlot() { return $this->belongsTo(MealSlot::class); }

    /**
     * Stored as a disk-relative path; resolved against the current APP_URL on
     * read. See App\Support\MediaUrl — the origin used to be baked into the
     * column, which broke every image whenever the host or port changed.
     */
    protected function imageUrl(): Attribute
    {
        return MediaUrl::cast();
    }
}
