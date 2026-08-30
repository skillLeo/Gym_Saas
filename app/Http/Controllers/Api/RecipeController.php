<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FoodItem;
use App\Models\FoodLogEntry;
use App\Models\MealPlan;
use App\Models\Recipe;
use App\Models\SavedRecipe;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecipeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // The library is what an admin has approved — plus your own recipes,
        // whatever state they are in, so a private draft is not invisible to the
        // person who wrote it. `is_mine` and `status` ride along on each row so
        // the UI can badge them.
        $query = Recipe::where(function ($q) use ($user) {
            $q->inLibrary();
            if ($user) $q->orWhere('user_id', $user->id);
        });

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }
        if ($ingredient = $request->input('ingredient')) {
            $query->whereRaw('LOWER(CAST(ingredients AS CHAR)) LIKE ?', ['%' . strtolower($ingredient) . '%']);
        }
        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }
        if ($tag = $request->input('tag')) {
            $query->whereJsonContains('tags', $tag);
        }
        if ($difficulty = $request->input('difficulty')) {
            $query->where('difficulty', $difficulty);
        }
        if ($request->filled('calorie_min')) {
            $query->where('calories', '>=', (int) $request->input('calorie_min'));
        }
        if ($request->filled('calorie_max')) {
            $query->where('calories', '<=', (int) $request->input('calorie_max'));
        }

        // `rating` is NULL until a recipe has genuinely been rated. Sort unrated
        // recipes last explicitly rather than leaning on MySQL's implicit NULL
        // placement, which differs across engines and is easy to break.
        $recipes = $query
            ->orderByRaw('rating IS NULL ASC')
            ->orderByDesc('rating')
            ->orderByDesc('id')
            ->paginate(24);

        $savedIds = $user
            ? SavedRecipe::where('user_id', $user->id)->pluck('recipe_id')->flip()
            : collect();

        return response()->json([
            'data'       => $recipes->map(fn($r) => $this->formatRecipe($r, $savedIds)),
            'total'      => $recipes->total(),
            'last_page'  => $recipes->lastPage(),
            'current_page' => $recipes->currentPage(),
        ]);
    }

    public function saved(Request $request): JsonResponse
    {
        $user = $request->user();

        $savedIds = SavedRecipe::where('user_id', $user->id)->pluck('recipe_id');
        $recipes  = Recipe::whereIn('id', $savedIds)
            ->orderByRaw('rating IS NULL ASC')
            ->orderByDesc('rating')
            ->orderByDesc('id')
            ->get();
        $flip     = $savedIds->flip();

        return response()->json([
            'data' => $recipes->map(fn($r) => $this->formatRecipe($r, $flip)),
        ]);
    }

    public function show(Request $request, Recipe $recipe): JsonResponse
    {
        $user     = $request->user();
        $savedIds = $user
            ? SavedRecipe::where('user_id', $user->id)->where('recipe_id', $recipe->id)->exists()
            : false;

        return response()->json(['data' => $this->formatRecipe($recipe, $savedIds ? collect([$recipe->id => 0]) : collect())]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'description'  => 'nullable|string',
            'image_url'    => 'nullable|string|url',
            'category'     => 'required|in:Breakfast,Lunch,Dinner,Snacks,Smoothies',
            'difficulty'   => 'nullable|in:Easy,Medium,Hard',
            'tags'         => 'nullable|array',
            'tags.*'       => 'string',
            'prep_time'    => 'nullable|integer|min:0|max:1440',
            'cook_time'    => 'nullable|integer|min:0|max:1440',
            'servings'     => 'nullable|integer|min:1|max:100',
            // Upper bounds must stay within the DB columns' actual precision (decimal(6,2) for
            // protein/carbs/fat/fiber = max 9999.99) so an oversized value is rejected here with
            // a clean validation error instead of reaching the DB and throwing a raw SQL exception.
            'calories'     => 'nullable|integer|min:0|max:9999',
            'protein'      => 'nullable|numeric|min:0|max:999.99',
            'carbs'        => 'nullable|numeric|min:0|max:999.99',
            'fat'          => 'nullable|numeric|min:0|max:999.99',
            'fiber'        => 'nullable|numeric|min:0|max:999.99',
            'ingredients'  => 'nullable|array',
            'instructions' => 'nullable|array',
        ]);

        try {
            $recipe = Recipe::create([
                // is_public is no longer accepted from the client at all —
                // visibility is decided by `status`, and only an admin moves it.
                ...$validated,
                'user_id'   => $request->user()->id,
                // Private until an admin says otherwise. This used to default to
                // public, so anything a member typed was in front of the whole
                // membership the moment they pressed Save.
                'is_public' => false,
            ]);
            $recipe->forceFill(['status' => Recipe::PRIVATE])->save();
        } catch (QueryException $e) {
            report($e);
            return response()->json(['message' => 'Something went wrong saving your recipe. Please check your entries and try again.'], 422);
        }

        return response()->json(['data' => $this->formatRecipe($recipe, collect())], 201);
    }

    /**
     * Edit a recipe you wrote.
     *
     * Members could create recipes and then never touch them again: there was no
     * member-facing update or delete route at all, only the admin pair under
     * /admin/recipes. A typo in a recipe was permanent, and so was a recipe added
     * by mistake. Seeded recipes (user_id null) belong to the library and are not
     * editable by members.
     */
    public function update(Request $request, Recipe $recipe): JsonResponse
    {
        $this->assertOwner($request, $recipe);

        $validated = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'description'  => 'nullable|string',
            'image_url'    => 'nullable|string|url',
            'category'     => 'sometimes|in:Breakfast,Lunch,Dinner,Snacks,Smoothies',
            'difficulty'   => 'nullable|in:Easy,Medium,Hard',
            'tags'         => 'nullable|array',
            'tags.*'       => 'string',
            'prep_time'    => 'nullable|integer|min:0|max:1440',
            'cook_time'    => 'nullable|integer|min:0|max:1440',
            'servings'     => 'nullable|integer|min:1|max:100',
            // Same ceilings as store(): they mirror the columns' real precision,
            // so an oversized number is a clean 422 rather than a raw SQL error.
            'calories'     => 'nullable|integer|min:0|max:9999',
            'protein'      => 'nullable|numeric|min:0|max:999.99',
            'carbs'        => 'nullable|numeric|min:0|max:999.99',
            'fat'          => 'nullable|numeric|min:0|max:999.99',
            'fiber'        => 'nullable|numeric|min:0|max:999.99',
            'ingredients'  => 'nullable|array',
            'instructions' => 'nullable|array',
        ]);

        $wasApproved = $recipe->status === Recipe::APPROVED;

        try {
            $recipe->update($validated);
        } catch (QueryException $e) {
            report($e);
            return response()->json(['message' => 'Something went wrong saving your recipe. Please check your entries and try again.'], 422);
        }

        // Without this, approval would mean nothing: get one good recipe into the
        // library, then quietly rewrite it into anything at all, live to every
        // member instantly. An edit puts it back in the queue.
        if ($wasApproved) {
            $recipe->forceFill([
                'status'    => Recipe::PENDING,
                'is_public' => false,
            ])->save();
        }

        return response()->json([
            'data'    => $this->formatRecipe($recipe->fresh(), collect()),
            'message' => $wasApproved
                ? 'Saved. Because this recipe was in the library, it has gone back for review.'
                : 'Recipe updated.',
        ]);
    }

    /** Delete a recipe you wrote. */
    public function destroy(Request $request, Recipe $recipe): JsonResponse
    {
        $this->assertOwner($request, $recipe);

        // Anything pointing at this recipe goes with it, or the meal planner is
        // left showing a row whose recipe no longer exists.
        SavedRecipe::where('recipe_id', $recipe->id)->delete();
        \App\Models\MealPlan::where('recipe_id', $recipe->id)->delete();
        $recipe->delete();

        return response()->json(['message' => 'Recipe deleted.']);
    }

    /** Ask an admin to put this recipe into the shared library. */
    public function submit(Request $request, Recipe $recipe): JsonResponse
    {
        $this->assertOwner($request, $recipe);

        if ($recipe->status === Recipe::PENDING) {
            return response()->json(['message' => 'This recipe is already waiting for review.'], 422);
        }
        if ($recipe->status === Recipe::APPROVED) {
            return response()->json(['message' => 'This recipe is already in the library.'], 422);
        }

        $recipe->forceFill([
            'status'           => Recipe::PENDING,
            'rejection_reason' => null,
        ])->save();

        return response()->json([
            'data'    => $this->formatRecipe($recipe->fresh(), collect()),
            'message' => 'Sent for review. You will be notified once it has been looked at.',
        ]);
    }

    /**
     * Only the author may change a recipe. A seeded library recipe has a null
     * user_id and belongs to nobody, so it fails this too.
     */
    private function assertOwner(Request $request, Recipe $recipe): void
    {
        if ($recipe->user_id === null || $recipe->user_id !== $request->user()->id) {
            abort(403, 'You can only edit recipes you created.');
        }
    }

    public function toggleSave(Request $request, Recipe $recipe): JsonResponse
    {
        $user   = $request->user();
        $exists = SavedRecipe::where('user_id', $user->id)->where('recipe_id', $recipe->id)->first();

        if ($exists) {
            $exists->delete();
            $action = 'unsaved';
        } else {
            SavedRecipe::create(['user_id' => $user->id, 'recipe_id' => $recipe->id]);
            $action = 'saved';
        }

        return response()->json(['action' => $action, 'is_saved' => $action === 'saved']);
    }

    public function logToJournal(Request $request, Recipe $recipe): JsonResponse
    {
        $validated = $request->validate([
            'meal_slot_id' => 'required|exists:meal_slots,id',
            'servings'     => 'nullable|numeric|min:0.1|max:20',
        ]);

        $slot = \App\Models\MealSlot::findOrFail($validated['meal_slot_id']);
        if ($slot->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $servings = $validated['servings'] ?? 1;
        $user     = $request->user();

        // Per-serving nutrition
        $perServing = max((int) ($recipe->servings ?? 1), 1);
        $calPerServing   = ($recipe->calories ?? 0) / $perServing;
        $protPerServing  = ($recipe->protein  ?? 0) / $perServing;
        $carbsPerServing = ($recipe->carbs    ?? 0) / $perServing;
        $fatPerServing   = ($recipe->fat      ?? 0) / $perServing;
        $fiberPerServing = ($recipe->fiber    ?? 0) / $perServing;

        // Ensure a food item exists for this recipe (keyed by nutritionix_id)
        $nutritionixId = 'recipe_' . $recipe->id;
        $foodItem = FoodItem::where('nutritionix_id', $nutritionixId)->first();
        if (!$foodItem) {
            $foodItem = FoodItem::create([
                'nutritionix_id'  => $nutritionixId,
                'name'            => $recipe->name,
                'brand'           => 'My Recipes',
                'serving_qty'     => 1,
                'serving_unit'    => 'serving',
                'calories'        => round($calPerServing, 2),
                'protein_g'       => round($protPerServing, 2),
                'carbs_g'         => round($carbsPerServing, 2),
                'fat_g'           => round($fatPerServing, 2),
                'fiber_g'         => round($fiberPerServing, 2),
                'is_custom'       => true,
                'created_by_user_id' => $user->id,
            ]);
        }

        $mult = (float) $servings;

        $log = FoodLogEntry::create([
            'user_id'          => $user->id,
            'food_item_id'     => $foodItem->id,
            'meal_slot_id'     => $slot->id,
            'meal_type'        => $slot->legacy_key,
            'servings'         => $mult,
            'total_calories'   => round($foodItem->calories * $mult, 2),
            'total_protein_g'  => round($foodItem->protein_g * $mult, 2),
            'total_carbs_g'    => round($foodItem->carbs_g * $mult, 2),
            'total_fat_g'      => round($foodItem->fat_g * $mult, 2),
            'logged_date'      => now()->toDateString(),
            'image_url'        => $recipe->image_url,
        ]);

        return response()->json([
            'message'    => 'Logged to food journal',
            'log_id'     => $log->id,
            'meal_slot'  => $slot->name,
            'calories'   => $log->total_calories,
        ]);
    }

    public function addToMealPlan(Request $request, Recipe $recipe): JsonResponse
    {
        $validated = $request->validate([
            'week_start'  => 'required|date',
            'day_of_week' => 'required|integer|min:0|max:6',
            'meal_slot'   => 'required|in:breakfast,lunch,dinner,snack',
            'notes'       => 'nullable|string|max:500',
        ]);

        $entry = MealPlan::updateOrCreate(
            [
                'user_id'     => $request->user()->id,
                'week_start'  => $validated['week_start'],
                'day_of_week' => $validated['day_of_week'],
                'meal_slot'   => $validated['meal_slot'],
            ],
            [
                'recipe_id'   => $recipe->id,
                'recipe_name' => $recipe->name,
                'notes'       => $validated['notes'] ?? null,
            ]
        );

        $addedIngredients = 0;
        foreach (($recipe->ingredients ?? []) as $ing) {
            $name = $ing['name'] ?? null;
            if (!$name) continue;

            $exists = \App\Models\ShoppingListItem::where('user_id', $request->user()->id)
                ->where('name', $name)->where('checked', false)->exists();
            if ($exists) continue;

            \App\Models\ShoppingListItem::create([
                'user_id'  => $request->user()->id,
                'name'     => $name,
                'quantity' => $ing['amount'] ?? null,
                'unit'     => $ing['unit'] ?? null,
                'category' => $this->categorizeIngredient($name),
                'checked'  => false,
            ]);
            $addedIngredients++;
        }

        return response()->json([
            'message' => 'Added to meal plan' . ($addedIngredients > 0 ? " and {$addedIngredients} ingredient" . ($addedIngredients !== 1 ? 's' : '') . ' to your shopping list' : ''),
            'id' => $entry->id,
        ]);
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

    private function formatRecipe(Recipe $recipe, $savedFlip): array
    {
        $isSaved = is_bool($savedFlip)
            ? $savedFlip
            : $savedFlip->has($recipe->id);

        return [
            'id'           => $recipe->id,
            'name'         => $recipe->name,
            'description'  => $recipe->description,
            'image_url'    => $recipe->image_url,
            'category'     => $recipe->category,
            'difficulty'   => $recipe->difficulty,
            'tags'         => $recipe->tags ?? [],
            'prep_time'    => $recipe->prep_time,
            'cook_time'    => $recipe->cook_time,
            'servings'     => $recipe->servings,
            'calories'     => $recipe->calories,
            'protein'      => $recipe->protein,
            'carbs'        => $recipe->carbs,
            'fat'          => $recipe->fat,
            'fiber'        => $recipe->fiber,
            'ingredients'  => $recipe->ingredients ?? [],
            'instructions' => $recipe->instructions ?? [],
            'rating'       => $recipe->rating,
            'reviews_count' => $recipe->reviews_count,
            'is_saved'     => $isSaved,
            'is_public'    => $recipe->is_public,
            'status'           => $recipe->status,
            'rejection_reason' => $recipe->rejection_reason,
            'user_id'      => $recipe->user_id,
            // Computed here rather than left to the client to compare ids: the
            // Edit and Delete controls hang off this, and the server is the only
            // place that reliably knows who is asking.
            'is_mine'      => $recipe->user_id !== null
                && $recipe->user_id === optional(request()->user())->id,
        ];
    }
}
