<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\MealSlot;
use Illuminate\Http\Request;

class MealSlotController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        // Self-heal, exactly as FoodLogController::index already does.
        // Registration seeds the six defaults, but an account created before
        // meal slots existed (or one restored from an older backup) has none —
        // and this endpoint previously returned an empty list forever, which
        // dead-ends every caller: the food journal's "manage meals" sheet, and
        // the recipe "log to journal" picker, both render nothing to choose.
        if (!MealSlot::where('user_id', $userId)->exists()) {
            MealSlot::seedDefaultsFor($userId);
        }

        $slots = MealSlot::where('user_id', $userId)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['success' => true, 'data' => $slots]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['name' => 'required|string|max:50']);
        $maxOrder = MealSlot::where('user_id', $request->user()->id)->max('sort_order') ?? -1;

        $slot = MealSlot::create([
            'user_id'    => $request->user()->id,
            'name'       => $validated['name'],
            'sort_order' => $maxOrder + 1,
        ]);

        return response()->json(['success' => true, 'data' => $slot, 'message' => 'Meal slot added!'], 201);
    }

    public function update(Request $request, MealSlot $mealSlot)
    {
        if ($mealSlot->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }
        $validated = $request->validate(['name' => 'required|string|max:50']);
        $mealSlot->update(['name' => $validated['name']]);
        return response()->json(['success' => true, 'data' => $mealSlot, 'message' => 'Meal slot renamed!']);
    }

    public function destroy(Request $request, MealSlot $mealSlot)
    {
        if ($mealSlot->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }
        if (MealSlot::where('user_id', $request->user()->id)->count() <= 1) {
            return response()->json(['success' => false, 'error' => 'You must keep at least one meal slot.'], 422);
        }
        $mealSlot->delete();
        return response()->json(['success' => true, 'message' => 'Meal slot deleted.']);
    }
}
