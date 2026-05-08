<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\FoodItem;
use Illuminate\Http\Request;

class CustomFoodController extends Controller
{
    public function index(Request $request)
    {
        $foods = FoodItem::where('created_by_user_id', $request->user()->id)
            ->where('is_custom', true)
            ->latest()
            ->paginate(20);

        return response()->json(['success' => true, 'data' => $foods]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'                 => 'required|string|max:255',
            'brand'                => 'nullable|string|max:255',
            'serving_qty'          => 'required|numeric|min:0.01',
            'serving_unit'         => 'required|string|max:50',
            'serving_weight_grams' => 'nullable|numeric|min:0',
            'calories'             => 'required|numeric|min:0',
            'protein_g'            => 'required|numeric|min:0',
            'carbs_g'              => 'required|numeric|min:0',
            'fat_g'                => 'required|numeric|min:0',
            'fiber_g'              => 'nullable|numeric|min:0',
            'sugar_g'              => 'nullable|numeric|min:0',
            'sodium_mg'            => 'nullable|numeric|min:0',
        ]);

        $food = FoodItem::create(array_merge($validated, [
            'is_custom'           => true,
            'created_by_user_id'  => $request->user()->id,
        ]));

        return response()->json(['success' => true, 'data' => $food, 'message' => 'Custom food created.'], 201);
    }
}
