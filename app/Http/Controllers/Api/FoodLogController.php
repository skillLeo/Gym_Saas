<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\FoodItem;
use App\Models\FoodLogEntry;
use App\Models\MealSlot;
use App\Services\FoodJournal;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FoodLogController extends Controller
{
    /**
     * The journal write lives in FoodJournal so that manual, barcode/search
     * and AI logging all produce an identical row. See that class for why the
     * food-item lookup deliberately stays in each caller.
     */
    public function __construct(private readonly FoodJournal $journal)
    {
    }

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

        $entry = $this->journal->log(
            $request->user(),
            $slot,
            $food,
            (float) $validated['servings'],
            $validated['logged_date'],
            // The `$food->image_url` arm is kept verbatim. food_items has no
            // such column, so it has always resolved to null — but it is
            // behaviour the frontend has shipped against, and an extraction is
            // not the place to change it.
            $validated['image_url'] ?? $food->image_url ?? null,
        );

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

            /*
             * These six were being sent by every caller and silently thrown
             * away. $request->validate() returns ONLY the keys that carry a
             * rule, so a field with no rule never reaches $validated and
             * therefore never reaches the model — the firstOrCreate() below
             * reads them, finds nothing, and writes null.
             *
             * The effect was that every food logged from search, barcode,
             * photo or voice lost its brand, its fibre, its sugar, its sodium
             * and its gram weight, and — because external_food_id was always
             * null — two different foods sharing a name collapsed into one
             * record, with the first one's nutrition logged for both.
             *
             * All optional, so no existing request shape breaks: a caller
             * that omits them behaves exactly as before.
             */
            'food_data.external_food_id'     => 'nullable|string|max:64',
            'food_data.brand'                => 'nullable|string|max:255',
            'food_data.serving_weight_grams' => 'nullable|numeric|min:0',
            'food_data.fiber_g'              => 'nullable|numeric|min:0',
            'food_data.sugar_g'              => 'nullable|numeric|min:0',
            'food_data.sodium_mg'            => 'nullable|numeric|min:0',
            'meal_slot_id' => 'required|exists:meal_slots,id',
            'logged_date'  => 'required|date',
            'servings'     => 'required|numeric|min:0.01|max:100',
            'image_url'    => 'nullable|string|max:2000',
        ]);

        $slot = MealSlot::findOrFail($validated['meal_slot_id']);
        if ($slot->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }

        // Shared with the AI confirm endpoint, so the same USDA food is one
        // record however the member logged it. See FoodJournal for why the
        // two paths used to disagree.
        $food = $this->journal->resolveExternalFood($request->user(), $validated["food_data"]);

        $entry = $this->journal->log(
            $request->user(),
            $slot,
            $food,
            (float) $validated['servings'],
            $validated['logged_date'],
            // No fallback to the food's own image here, unlike store().
            $validated['image_url'] ?? null,
        );

        return response()->json(['success' => true, 'data' => $entry->load('foodItem'), 'message' => 'Food logged.'], 201);
    }

    public function update(Request $request, FoodLogEntry $foodLog)
    {
        if ($foodLog->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate(['servings' => 'required|numeric|min:0.01|max:100']);

        $this->journal->recalculate($foodLog, (float) $validated['servings']);

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
