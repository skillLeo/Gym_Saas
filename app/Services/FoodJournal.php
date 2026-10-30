<?php

namespace App\Services;

use App\Models\FoodItem;
use App\Models\FoodLogEntry;
use App\Models\MealSlot;
use App\Models\User;

/**
 * The one place a food_log_entries row is written.
 *
 * Extracted from FoodLogController so that manual logging, barcode/search
 * logging and AI logging cannot drift apart. They were going to: the AI
 * confirm endpoint needed the same arithmetic, and a second copy of
 * `round($food->calories * $servings, 2)` is a second copy that can be edited
 * on its own.
 *
 * WHAT DEPENDS ON THIS BEING SHARED
 * Streaks and badges are NOT fired when an entry is written — ProcessStreaks
 * derives them from the rows afterwards, and AchievementApiController reads
 * them back. So "AI logging behaves exactly like manual logging" reduces
 * entirely to writing an identical row, which is what this class guarantees.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * Resolving which FoodItem to log. The three callers legitimately differ —
 * manual logging is handed an id, the legacy from-api endpoint does a
 * firstOrCreate on a partial payload, and the AI path carries a full USDA
 * record. Forcing those into one method would mean a flags argument that
 * reintroduces the divergence it was meant to remove.
 *
 * The arithmetic below is a straight lift, float semantics included. It is
 * pinned by ManualFoodLoggingCharacterizationTest, which was written and run
 * before this class existed.
 */
class FoodJournal
{
    /**
     * Write one journal entry.
     *
     * @param  string       $loggedDate  Y-m-d.
     * @param  string|null  $imageUrl    Passed through exactly as given; this
     *                                   method applies no fallback of its own,
     *                                   because the two existing callers
     *                                   disagree about what the fallback is
     *                                   and both behaviours are pinned.
     */
    public function log(
        User $user,
        MealSlot $slot,
        FoodItem $food,
        float $servings,
        string $loggedDate,
        ?string $imageUrl = null,
    ): FoodLogEntry {
        return FoodLogEntry::create([
            'user_id'      => $user->id,
            'food_item_id' => $food->id,
            'meal_slot_id' => $slot->id,
            // Mirrors the slot's legacy key. seedDefaultsFor() does not set
            // one, so this is null for default slots — pinned, not fixed here.
            'meal_type'    => $slot->legacy_key,
            'logged_date'  => $loggedDate,
            'servings'     => $servings,
            ...$this->totalsFor($food, $servings),
            'image_url'    => $imageUrl,
        ]);
    }

    /**
     * Re-apply the totals after a servings change.
     *
     * Reads the nutrition from the entry's own food item rather than taking
     * numbers from the caller, so an edit cannot introduce a figure that no
     * food record supports.
     */
    public function recalculate(FoodLogEntry $entry, float $servings): FoodLogEntry
    {
        $entry->update([
            'servings' => $servings,
            ...$this->totalsFor($entry->foodItem, $servings),
        ]);

        return $entry;
    }

    /** Does this meal slot belong to this member? */
    public function ownsSlot(User $user, MealSlot $slot): bool
    {
        return $slot->user_id === $user->id;
    }

    /**
     * Per-entry totals: multiply by servings, round to two places.
     *
     * Two places, not one — the per-slot and per-day totals round to one, but
     * they round the SUM. Rounding each entry to one place first would make
     * the day's total drift from the sum of what the member can see.
     *
     * @return array<string, float>
     */
    private function totalsFor(FoodItem $food, float $servings): array
    {
        return [
            'total_calories'  => round($food->calories * $servings, 2),
            'total_protein_g' => round($food->protein_g * $servings, 2),
            'total_carbs_g'   => round($food->carbs_g * $servings, 2),
            'total_fat_g'     => round($food->fat_g * $servings, 2),
        ];
    }
}
