<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Recipe;
use Illuminate\Http\Request;

/**
 * Recipe management (§E1). The admin recipes screen previously had
 * Approve/Feature/Remove buttons that only mutated local React state —
 * clicking "Feature" looked like it worked but nothing was ever saved. This
 * is the real, persisted version.
 *
 * Recipes now DO have an approval workflow, mirroring Groups: a member's recipe
 * is private until submitted, and reaches the shared library only once an admin
 * approves it. The earlier note here — that "pending" was UI-only fiction — was
 * true at the time and no longer is.
 */
class RecipeAdminController extends Controller
{
    /**
     * Every recipe, whatever its state — this is the moderation queue.
     *
     * The admin screen used to read the member endpoint, which now returns only
     * approved recipes plus the caller's own. Left on that, the queue would have
     * shown nothing waiting for review: the one thing it exists to show.
     */
    public function index(Request $request)
    {
        $query = Recipe::query()->with('user:id,name');

        if ($search = $request->input('search')) {
            $query->where('name', 'like', "%{$search}%");
        }
        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $recipes = $query->orderByRaw("FIELD(status, 'pending') DESC")
            ->orderByDesc('id')
            ->get()
            ->map(fn ($r) => [
                'id'          => $r->id,
                'name'        => $r->name,
                'category'    => $r->category,
                'image_url'   => $r->image_url,
                'prep_time'   => $r->prep_time,
                'cook_time'   => $r->cook_time,
                'rating'      => $r->rating,
                'tags'        => $r->tags ?? [],
                'is_public'   => $r->is_public,
                'is_featured' => $r->is_featured,
                'status'      => $r->status,
                'rejection_reason' => $r->rejection_reason,
                // Null for the seeded library. Worth showing: an admin reviewing
                // a submission needs to know whose it is.
                'author'      => $r->user?->name,
                'saves_count' => 0,
            ]);

        return response()->json(['data' => $recipes]);
    }

    public function update(Request $request, Recipe $recipe)
    {
        $data = $request->validate([
            'is_featured' => 'sometimes|boolean',
        ]);

        $recipe->update($data);

        return response()->json(['recipe' => $recipe->fresh()]);
    }

    /** Put a submitted recipe into the shared library. */
    public function approve(Request $request, Recipe $recipe)
    {
        $recipe->forceFill([
            'status'           => Recipe::APPROVED,
            'is_public'        => true,
            'rejection_reason' => null,
        ])->save();

        $this->notifyAuthor($recipe, 'recipe_approved', 'Your recipe was approved',
            "\"{$recipe->name}\" is now in the recipe library for everyone to cook.");

        return response()->json(['recipe' => $recipe->fresh(), 'message' => 'Recipe approved.']);
    }

    /** Decline it, with a reason the author actually sees. */
    public function reject(Request $request, Recipe $recipe)
    {
        $validated = $request->validate(['reason' => 'nullable|string|max:500']);
        $reason    = $validated['reason'] ?? null;

        $recipe->forceFill([
            'status'           => Recipe::REJECTED,
            'is_public'        => false,
            'rejection_reason' => $reason,
        ])->save();

        $this->notifyAuthor($recipe, 'recipe_rejected', 'Your recipe was not approved',
            filled($reason)
                ? "\"{$recipe->name}\": {$reason}"
                : "\"{$recipe->name}\" was not added to the library. You can edit it and submit it again.");

        return response()->json(['recipe' => $recipe->fresh(), 'message' => 'Recipe rejected.']);
    }

    public function destroy(Request $request, Recipe $recipe)
    {
        $recipe->delete();

        return response()->json(['message' => 'Recipe removed.']);
    }

    /**
     * A seeded library recipe has no author, so there is nobody to tell — and a
     * decision nobody hears about is the failure mode the Groups flow already
     * had to fix.
     */
    private function notifyAuthor(Recipe $recipe, string $type, string $title, string $body): void
    {
        if ($recipe->user_id === null) return;

        Notification::create([
            'user_id' => $recipe->user_id,
            'type'    => $type,
            'title'   => $title,
            'body'    => $body,
            'data'    => ['recipe_id' => $recipe->id],
            'link'    => '/recipes',
        ]);
    }
}
