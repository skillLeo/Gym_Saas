<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class MealSlot extends Model
{
    use HasFactory;
    protected $fillable = ['user_id', 'name', 'sort_order', 'legacy_key'];
    public function user() { return $this->belongsTo(User::class); }

    public static function defaultNamesFor(): array
    {
        return ['Meal 1', 'Snack 1', 'Meal 2', 'Snack 2', 'Meal 3', 'Snack 3'];
    }

    public static function seedDefaultsFor(int $userId): void
    {
        foreach (self::defaultNamesFor() as $i => $name) {
            self::create(['user_id' => $userId, 'name' => $name, 'sort_order' => $i]);
        }
    }
}
