<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use App\Models\MealPlan;
use App\Models\ShoppingListItem;
use App\Models\Todo;
use App\Models\FitnessLog;
use App\Models\FoodLogEntry;
use Illuminate\Http\Request;
use Carbon\Carbon;

class CalendarController extends Controller
{
    private const TYPE_COLORS = [
        'workout'     => '#FF0404',
        'meal'        => '#F87404',
        'appointment' => '#004AAD',
        'personal'    => '#7C3AED',
        'other'       => '#10B981',
    ];

    // ── Calendar Events ──────────────────────────────────────────────────────

    public function events(Request $request)
    {
        $userId = $request->user()->id;
        $month  = $request->input('month', now()->format('Y-m'));
        [$year, $mon] = explode('-', $month);

        // Own events plus platform-wide ones (§5.2): a Vibe Call is stored once
        // with a NULL owner rather than duplicated per member. The write paths
        // below still require ownership, so nobody can edit or delete these.
        $events = CalendarEvent::visibleTo($userId)
            ->whereYear('date', $year)
            ->whereMonth('date', $mon)
            ->orderBy('date')
            ->get()
            ->map(fn($e) => [
                'id'       => 'event-' . $e->id,
                'raw_id'   => $e->id,
                'title'    => $e->title,
                'type'     => $e->type,
                'date'     => $e->date instanceof Carbon ? $e->date->toDateString() : substr((string) $e->date, 0, 10),
                'time'     => $e->time,
                'end_time' => $e->end_time,
                'notes'    => $e->notes,
                'color'    => $e->color ?? self::TYPE_COLORS[$e->type] ?? self::TYPE_COLORS['other'],
                'source'   => 'manual',
                'editable' => true,
            ]);

        // Auto-populate: workouts logged this month
        $workouts = FitnessLog::where('user_id', $userId)
            ->whereYear('logged_date', $year)
            ->whereMonth('logged_date', $mon)
            ->get()
            ->map(fn($w) => [
                'id'       => 'workout-' . $w->id,
                'raw_id'   => $w->id,
                'title'    => $w->exercise_name,
                'type'     => 'workout',
                'date'     => $w->logged_date instanceof Carbon ? $w->logged_date->toDateString() : substr((string) $w->logged_date, 0, 10),
                'time'     => null,
                'end_time' => null,
                'notes'    => $w->duration_minutes ? "{$w->duration_minutes} min" : null,
                'color'    => self::TYPE_COLORS['workout'],
                'source'   => 'fitness',
                'editable' => false,
            ]);

        // Auto-populate: food logged this month, grouped one entry per meal slot per day
        $foodEntries = FoodLogEntry::with(['foodItem', 'mealSlot'])
            ->where('user_id', $userId)
            ->whereYear('logged_date', $year)
            ->whereMonth('logged_date', $mon)
            ->get()
            ->groupBy(fn($f) => ($f->logged_date instanceof Carbon ? $f->logged_date->toDateString() : substr((string) $f->logged_date, 0, 10)) . '-' . ($f->meal_slot_id ?? 'none'))
            ->map(function ($group) {
                $first = $group->first();
                $slotName = $first->mealSlot->name ?? 'Meal';
                return [
                    'id'       => 'food-' . $first->meal_slot_id . '-' . ($first->logged_date instanceof Carbon ? $first->logged_date->toDateString() : $first->logged_date),
                    'raw_id'   => null,
                    'title'    => "{$slotName} (" . $group->count() . ' item' . ($group->count() !== 1 ? 's' : '') . ')',
                    'type'     => 'meal',
                    'date'     => $first->logged_date instanceof Carbon ? $first->logged_date->toDateString() : substr((string) $first->logged_date, 0, 10),
                    'time'     => null,
                    'end_time' => null,
                    'notes'    => round($group->sum('total_calories')) . ' kcal',
                    'color'    => self::TYPE_COLORS['meal'],
                    'source'   => 'food',
                    'editable' => false,
                ];
            })
            ->values();

        $all = $events->concat($workouts)->concat($foodEntries)->sortBy('date')->values();

        return response()->json(['events' => $all]);
    }

    public function storeEvent(Request $request)
    {
        $data = $request->validate([
            'title'    => 'required|string|max:255',
            'type'     => 'required|in:workout,meal,appointment,personal,other',
            'date'     => 'required|date',
            'time'     => 'nullable|string',
            'end_time' => 'nullable|string',
            'notes'    => 'nullable|string',
            'color'    => 'nullable|string|max:20',
        ]);
        $event = CalendarEvent::create(['user_id' => $request->user()->id] + $data);
        return response()->json(['event' => $event], 201);
    }

    public function updateEvent(Request $request, CalendarEvent $event)
    {
        if ($event->user_id !== $request->user()->id) abort(403);
        $data = $request->validate([
            'title'    => 'sometimes|string|max:255',
            'type'     => 'sometimes|in:workout,meal,appointment,personal,other',
            'date'     => 'sometimes|date',
            'time'     => 'nullable|string',
            'end_time' => 'nullable|string',
            'notes'    => 'nullable|string',
            'color'    => 'nullable|string|max:20',
        ]);
        $event->update($data);
        return response()->json(['event' => $event->fresh()]);
    }

    public function destroyEvent(Request $request, CalendarEvent $event)
    {
        if ($event->user_id !== $request->user()->id) abort(403);
        $event->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Meal Plans ───────────────────────────────────────────────────────────

    public function mealPlans(Request $request)
    {
        // The meal planner and shopping list both compute their week from SUNDAY
        // and both send `week_start` explicitly. Carbon's startOfWeek() defaults
        // to MONDAY, so any caller that omitted it looked at a different week
        // from the one the member is planning and quietly found nothing.
        $weekStart = $request->input('week_start', now()->startOfWeek(\Carbon\Carbon::SUNDAY)->toDateString());
        $plans = MealPlan::where('user_id', $request->user()->id)
            ->where('week_start', $weekStart)
            ->get();
        return response()->json(['meal_plans' => $plans]);
    }

    public function destroyMealPlan(Request $request, MealPlan $mealPlan)
    {
        if ($mealPlan->user_id !== $request->user()->id) abort(403);
        $mealPlan->delete();
        return response()->json(['message' => 'Removed from meal plan']);
    }

    // ── Shopping List ────────────────────────────────────────────────────────

    public function shoppingList(Request $request)
    {
        $items = ShoppingListItem::where('user_id', $request->user()->id)
            ->orderBy('category')
            ->orderBy('name')
            ->get();
        return response()->json(['items' => $items]);
    }

    public function storeShoppingItem(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'quantity' => 'nullable|string',
            'unit'     => 'nullable|string',
            'category' => 'nullable|string',
        ]);
        $item = ShoppingListItem::create(['user_id' => $request->user()->id] + $data);
        return response()->json(['item' => $item], 201);
    }

    public function toggleShoppingItem(Request $request, ShoppingListItem $item)
    {
        if ($item->user_id !== $request->user()->id) abort(403);
        $item->update(['checked' => !$item->checked]);
        return response()->json(['item' => $item->fresh()]);
    }

    public function destroyShoppingItem(Request $request, ShoppingListItem $item)
    {
        if ($item->user_id !== $request->user()->id) abort(403);
        $item->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function clearCheckedItems(Request $request)
    {
        ShoppingListItem::where('user_id', $request->user()->id)
            ->where('checked', true)
            ->delete();
        return response()->json(['message' => 'Cleared']);
    }

    private function categorizeIngredient(string $name): string
    {
        $name = strtolower($name);
        $produce = ['broccoli','spinach','lettuce','tomato','onion','garlic','pepper','carrot','potato','avocado','apple','banana','berry','berries','fruit','vegetable','cucumber','zucchini','kale','lemon','lime','herbs','cilantro','parsley','basil'];
        $dairy   = ['milk','cheese','yogurt','butter','cream','egg'];
        $meat    = ['chicken','beef','salmon','fish','turkey','pork','shrimp','tuna','bacon','sausage'];
        foreach ($produce as $k) if (str_contains($name, $k)) return 'Produce';
        foreach ($dairy as $k) if (str_contains($name, $k)) return 'Dairy';
        foreach ($meat as $k) if (str_contains($name, $k)) return 'Meat';
        return 'Pantry';
    }

    public function generateShoppingList(Request $request)
    {
        // The meal planner and shopping list both compute their week from SUNDAY
        // and both send `week_start` explicitly. Carbon's startOfWeek() defaults
        // to MONDAY, so any caller that omitted it looked at a different week
        // from the one the member is planning and quietly found nothing.
        $weekStart = $request->input('week_start', now()->startOfWeek(\Carbon\Carbon::SUNDAY)->toDateString());
        $userId    = $request->user()->id;

        $plans = MealPlan::with('recipe')
            ->where('user_id', $userId)
            ->where('week_start', $weekStart)
            ->get();

        $created = 0;
        foreach ($plans as $plan) {
            $recipe = $plan->recipe;
            if (!$recipe || empty($recipe->ingredients)) continue;

            foreach ($recipe->ingredients as $ing) {
                $name = $ing['name'] ?? null;
                if (!$name) continue;

                $exists = ShoppingListItem::where('user_id', $userId)
                    ->where('name', $name)
                    ->where('checked', false)
                    ->exists();
                if ($exists) continue;

                ShoppingListItem::create([
                    'user_id'  => $userId,
                    'name'     => $name,
                    'quantity' => $ing['amount'] ?? null,
                    'unit'     => $ing['unit'] ?? null,
                    'category' => $this->categorizeIngredient($name),
                    'checked'  => false,
                ]);
                $created++;
            }
        }

        return response()->json([
            'message' => $created > 0 ? "Added {$created} item" . ($created !== 1 ? 's' : '') . ' from your meal plan!' : 'No new ingredients to add — your meal plan may be empty or already on the list.',
            'created' => $created,
        ]);
    }

    // ── Todos ────────────────────────────────────────────────────────────────

    public function todos(Request $request)
    {
        $todos = Todo::where('user_id', $request->user()->id)
            ->orderBy('completed')
            ->orderByDesc('created_at')
            ->get();
        return response()->json(['todos' => $todos]);
    }

    public function storeTodo(Request $request)
    {
        $data = $request->validate([
            'text'     => 'required|string|max:500',
            'due_date' => 'nullable|date',
            'priority' => 'nullable|in:low,medium,high',
        ]);
        $todo = Todo::create(['user_id' => $request->user()->id] + $data);

        // `refresh()` matters here. `priority` and `completed` have their
        // defaults applied by the database, not by the model, so the instance
        // returned straight from create() carries neither. The client groups
        // tasks by priority, so a task that came back without one landed in no
        // group at all and stayed invisible until the page was reloaded — while
        // the counter beside it, which reads the array length, said "0/1".
        return response()->json(['todo' => $todo->refresh()], 201);
    }

    public function toggleTodo(Request $request, Todo $todo)
    {
        if ($todo->user_id !== $request->user()->id) abort(403);
        $todo->update(['completed' => !$todo->completed]);
        return response()->json(['todo' => $todo->fresh()]);
    }

    public function destroyTodo(Request $request, Todo $todo)
    {
        if ($todo->user_id !== $request->user()->id) abort(403);
        $todo->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
