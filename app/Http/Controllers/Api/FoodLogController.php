<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\FoodItem;
use App\Models\FoodLogEntry;
use App\Models\MealSlot;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FoodLogController extends Controller
{
    public function index(Request $request)
    {
        $date  = $request->input('date', now()->toDateString());
        $user  = $request->user();

        $slots = MealSlot::where('user_id', $user->id)->orderBy('sort_order')->get();
        if ($slots->isEmpty()) {
            MealSlot::seedDefaultsFor($user->id);
            $slots = MealSlot::where('user_id', $user->id)->orderBy('sort_order')->get();
        }

        $entries = FoodLogEntry::with('foodItem')
            ->where('user_id', $user->id)
            ->where('logged_date', $date)
            ->get()
            ->groupBy('meal_slot_id');

        $grouped = [];
        foreach ($slots as $slot) {
            $mealEntries = $entries->get($slot->id, collect());
            $grouped[] = [
                'slot_id'        => $slot->id,
                'name'           => $slot->name,
                'sort_order'     => $slot->sort_order,
                'entries'        => $mealEntries->values(),
                'total_calories' => round($mealEntries->sum('total_calories'), 1),
                'total_protein'  => round($mealEntries->sum('total_protein_g'), 1),
                'total_carbs'    => round($mealEntries->sum('total_carbs_g'), 1),
                'total_fat'      => round($mealEntries->sum('total_fat_g'), 1),
            ];
        }

        return response()->json(['success' => true, 'data' => $grouped]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'food_item_id'  => 'required|exists:food_items,id',
            'meal_slot_id'  => 'required|exists:meal_slots,id',
            'logged_date'   => 'required|date',
            'servings'      => 'required|numeric|min:0.01|max:100',
            'image_url'     => 'nullable|string|max:2000',
        ]);

        $slot = MealSlot::findOrFail($validated['meal_slot_id']);
        if ($slot->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }

        $food = FoodItem::findOrFail($validated['food_item_id']);
        $mult = (float) $validated['servings'];

        $entry = FoodLogEntry::create([
            'user_id'          => $request->user()->id,
            'food_item_id'     => $food->id,
            'meal_slot_id'     => $slot->id,
            'meal_type'        => $slot->legacy_key,
            'logged_date'      => $validated['logged_date'],
            'servings'         => $mult,
            'total_calories'   => round($food->calories * $mult, 2),
            'total_protein_g'  => round($food->protein_g * $mult, 2),
            'total_carbs_g'    => round($food->carbs_g * $mult, 2),
            'total_fat_g'      => round($food->fat_g * $mult, 2),
            'image_url'        => $validated['image_url'] ?? $food->image_url ?? null,
        ]);

        return response()->json(['success' => true, 'data' => $entry->load('foodItem'), 'message' => 'Food logged.'], 201);
    }

    public function storeFromApi(Request $request)
    {
        $validated = $request->validate([
            'food_data'     => 'required|array',
            'food_data.name'         => 'required|string',
            'food_data.calories'     => 'required|numeric|min:0',
            'food_data.protein_g'    => 'required|numeric|min:0',
            'food_data.carbs_g'      => 'required|numeric|min:0',
            'food_data.fat_g'        => 'required|numeric|min:0',
            'food_data.serving_qty'  => 'required|numeric',
            'food_data.serving_unit' => 'required|string',
            'meal_slot_id' => 'required|exists:meal_slots,id',
            'logged_date'  => 'required|date',
            'servings'     => 'required|numeric|min:0.01|max:100',
            'image_url'    => 'nullable|string|max:2000',
        ]);

        $slot = MealSlot::findOrFail($validated['meal_slot_id']);
        if ($slot->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }

        $fd = $validated['food_data'];

        // Find or create food item
        $food = FoodItem::firstOrCreate(
            ['nutritionix_id' => $fd['nutritionix_id'] ?? null, 'name' => $fd['name'], 'is_custom' => false],
            [
                'brand'                => $fd['brand'] ?? null,
                'serving_qty'          => $fd['serving_qty'],
                'serving_unit'         => $fd['serving_unit'],
                'serving_weight_grams' => $fd['serving_weight_grams'] ?? null,
                'calories'             => $fd['calories'],
                'protein_g'            => $fd['protein_g'],
                'carbs_g'              => $fd['carbs_g'],
                'fat_g'                => $fd['fat_g'],
                'fiber_g'              => $fd['fiber_g'] ?? null,
                'sugar_g'              => $fd['sugar_g'] ?? null,
                'sodium_mg'            => $fd['sodium_mg'] ?? null,
            ]
        );

        $mult  = (float) $validated['servings'];
        $entry = FoodLogEntry::create([
            'user_id'         => $request->user()->id,
            'food_item_id'    => $food->id,
            'meal_slot_id'    => $slot->id,
            'meal_type'       => $slot->legacy_key,
            'logged_date'     => $validated['logged_date'],
            'servings'        => $mult,
            'total_calories'  => round($food->calories * $mult, 2),
            'total_protein_g' => round($food->protein_g * $mult, 2),
            'total_carbs_g'   => round($food->carbs_g * $mult, 2),
            'total_fat_g'     => round($food->fat_g * $mult, 2),
            'image_url'       => $validated['image_url'] ?? null,
        ]);

        return response()->json(['success' => true, 'data' => $entry->load('foodItem'), 'message' => 'Food logged.'], 201);
    }

    public function update(Request $request, FoodLogEntry $foodLog)
    {
        if ($foodLog->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate(['servings' => 'required|numeric|min:0.01|max:100']);
        $mult      = (float) $validated['servings'];
        $food      = $foodLog->foodItem;

        $foodLog->update([
            'servings'        => $mult,
            'total_calories'  => round($food->calories * $mult, 2),
            'total_protein_g' => round($food->protein_g * $mult, 2),
            'total_carbs_g'   => round($food->carbs_g * $mult, 2),
            'total_fat_g'     => round($food->fat_g * $mult, 2),
        ]);

        return response()->json(['success' => true, 'data' => $foodLog->load('foodItem'), 'message' => 'Entry updated.']);
    }

    public function destroy(Request $request, FoodLogEntry $foodLog)
    {
        if ($foodLog->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }
        $foodLog->delete();
        return response()->json(['success' => true, 'message' => 'Entry deleted.']);
    }

    public function summary(Request $request)
    {
        $date    = $request->input('date', now()->toDateString());
        $user    = $request->user();
        $entries = FoodLogEntry::where('user_id', $user->id)->where('logged_date', $date)->get();

        return response()->json(['success' => true, 'data' => [
            'date'              => $date,
            'total_calories'    => round($entries->sum('total_calories'), 1),
            'total_protein_g'   => round($entries->sum('total_protein_g'), 1),
            'total_carbs_g'     => round($entries->sum('total_carbs_g'), 1),
            'total_fat_g'       => round($entries->sum('total_fat_g'), 1),
            'calorie_goal'      => $user->daily_calorie_goal ?? 2000,
            'protein_goal'      => $user->daily_protein_goal_g ?? 150,
            'carbs_goal'        => $user->daily_carbs_goal_g ?? 200,
            'fat_goal'          => $user->daily_fat_goal_g ?? 65,
            'calorie_pct'       => $user->daily_calorie_goal ? round(($entries->sum('total_calories') / $user->daily_calorie_goal) * 100) : 0,
        ]]);
    }

    public function history(Request $request)
    {
        $period  = $request->input('period', 'week');
        $days    = $period === 'month' ? 30 : 7;
        $user    = $request->user();
        $start   = now()->subDays($days)->toDateString();
        $end     = now()->addDay()->toDateString();

        $entries = FoodLogEntry::where('user_id', $user->id)
            ->whereBetween('logged_date', [$start, $end])
            ->selectRaw('DATE(logged_date) as logged_date, SUM(total_calories) as calories, SUM(total_protein_g) as protein_g, SUM(total_carbs_g) as carbs_g, SUM(total_fat_g) as fat_g')
            ->groupBy(DB::raw('DATE(logged_date)'))
            ->orderBy('logged_date')
            ->get()
            ->keyBy(fn($row) => is_string($row->logged_date) ? substr($row->logged_date, 0, 10) : $row->logged_date->toDateString());

        $result = [];
        for ($i = $days - 1; $i >= -1; $i--) {
            $date         = now()->subDays($i)->toDateString();
            $row          = $entries->get($date);
            $result[]     = [
                'date'     => $date,
                'calories' => $row ? round((float) $row->calories, 1) : 0,
                'protein_g'=> $row ? round((float) $row->protein_g, 1) : 0,
                'carbs_g'  => $row ? round((float) $row->carbs_g, 1) : 0,
                'fat_g'    => $row ? round((float) $row->fat_g, 1) : 0,
            ];
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function recent(Request $request)
    {
        $entries = FoodLogEntry::with('foodItem')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->take(20)
            ->get()
            ->unique('food_item_id')
            ->map(fn($e) => $e->foodItem);

        return response()->json(['success' => true, 'data' => $entries->values()]);
    }
}
