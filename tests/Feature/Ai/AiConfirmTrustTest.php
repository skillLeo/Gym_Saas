<?php

namespace Tests\Feature\Ai;

use App\Models\FoodItem;
use App\Models\MealSlot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * What /confirm is allowed to believe from the browser.
 *
 * The confirm endpoint takes a whole food object from the client — name,
 * brand and all seven nutrient figures — and used to write it straight into
 * `food_items`. For a food carrying an external id that row is SHARED: it is
 * keyed on (external_food_id, food_source, is_custom=false), so the next
 * member to log the same real USDA food gets whatever the first member's
 * browser said it contained.
 *
 * That is a cross-member data integrity hole, not merely a validation gap:
 * member A never touches member B's account, and B's journal, daily totals
 * and goal tracking still end up computed from A's numbers.
 *
 * The rule these pin: for a food we can identify, the server looks the
 * nutrition up itself; for a food we cannot, the row is owned by the member
 * who logged it and is never shared.
 */
class AiConfirmTrustTest extends TestCase
{
    use RefreshDatabase;

    private function member(): User
    {
        return User::factory()->create([
            'email_verified_at'   => now(),
            'trial_ends_at'       => now()->addDays(20),
            'ai_features_enabled' => true,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => config('ai.consent_version'),
        ]);
    }

    private function slotFor(User $user): MealSlot
    {
        MealSlot::seedDefaultsFor($user->id);

        return MealSlot::where('user_id', $user->id)->orderBy('sort_order')->first();
    }

    /** A real USDA food, as the local import holds it. */
    private function localUsdaFood(int $fdcId, string $description, float $calories): void
    {
        DB::table('usda_foods')->insert([
            'fdc_id' => $fdcId, 'data_type' => 'sr_legacy_food', 'description' => $description,
            'calories' => $calories, 'protein_g' => 1.09, 'carbs_g' => 22.84, 'fat_g' => 0.33,
            'fiber_g' => 2.6, 'sugar_g' => 12.2, 'sodium_mg' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /** @param array<string,mixed> $foodOverrides */
    private function confirm(User $user, MealSlot $slot, array $foodOverrides = [])
    {
        Sanctum::actingAs($user);

        return $this->postJson('/api/ai/food-log/confirm', [
            'meal_slot_id' => $slot->slot_id ?? $slot->id,
            'logged_date'  => '2026-11-22',
            'items'        => [[
                'grams' => 100,
                'food'  => $foodOverrides + [
                    'external_food_id'     => '173944',
                    'name'                 => 'Bananas, raw',
                    'serving_qty'          => 100,
                    'serving_unit'         => 'g',
                    // Per 100 g, the convention every USDA row uses. Without a
                    // gram basis a weight cannot be converted to servings.
                    'serving_weight_grams' => 100,
                    'calories'         => 89,
                    'protein_g'        => 1.09,
                    'carbs_g'          => 22.84,
                    'fat_g'            => 0.33,
                ],
            ]],
        ]);
    }

    // ------------------------------------------------- the shared-row hole

    public function test_a_members_claimed_calories_cannot_become_another_members_numbers(): void
    {
        $this->localUsdaFood(173944, 'Bananas, raw', 89);

        $attacker = $this->member();
        $victim   = $this->member();

        // A logs a genuine USDA id, asserting an absurd figure.
        $this->confirm($attacker, $this->slotFor($attacker), ['calories' => 9000])
            ->assertStatus(201);

        // B logs the same real food, honestly.
        $this->confirm($victim, $this->slotFor($victim))->assertStatus(201);

        $entry = $victim->foodLogEntries()->latest('id')->first()
            ?? DB::table('food_log_entries')->where('user_id', $victim->id)->latest('id')->first();

        $this->assertNotNull($entry, 'the victim logged nothing');
        $this->assertEqualsWithDelta(
            89.0,
            (float) $entry->total_calories,
            0.5,
            'another member\'s claimed figure reached this journal',
        );
    }

    public function test_the_server_uses_its_own_figures_for_a_food_it_can_identify(): void
    {
        $this->localUsdaFood(173944, 'Bananas, raw', 89);

        $user = $this->member();
        $this->confirm($user, $this->slotFor($user), ['calories' => 9000, 'name' => 'Free Calories'])
            ->assertStatus(201);

        $food = FoodItem::where('external_food_id', '173944')->where('is_custom', false)->first();

        $this->assertNotNull($food);
        $this->assertEqualsWithDelta(89.0, (float) $food->calories, 0.5);
        $this->assertSame('Bananas, raw', $food->name, 'the client renamed a shared food record');
    }

    public function test_a_food_we_cannot_identify_is_never_written_to_a_shared_row(): void
    {
        /*
         * Branded products are not in the local tables, so their figures
         * cannot be checked. They are still loggable — but as the member's
         * own food, so an unverifiable number can only ever affect the person
         * who entered it.
         */
        $user = $this->member();

        $this->confirm($user, $this->slotFor($user), [
            'external_food_id' => '999999999',
            'name'             => 'Some Branded Thing',
            'calories'         => 4242,
        ])->assertStatus(201);

        $shared = FoodItem::where('external_food_id', '999999999')->where('is_custom', false)->first();
        $this->assertNull($shared, 'an unverifiable food was written to a globally shared row');

        $owned = FoodItem::where('external_food_id', '999999999')->first();
        $this->assertNotNull($owned, 'the member could not log their own food at all');
        $this->assertTrue((bool) $owned->is_custom);
        $this->assertSame($user->id, $owned->created_by_user_id);
    }

    public function test_two_members_logging_the_same_real_food_still_share_one_record(): void
    {
        // The de-duplication that already existed must survive the fix.
        $this->localUsdaFood(173944, 'Bananas, raw', 89);

        $a = $this->member();
        $b = $this->member();

        $this->confirm($a, $this->slotFor($a))->assertStatus(201);
        $this->confirm($b, $this->slotFor($b))->assertStatus(201);

        $this->assertSame(
            1,
            FoodItem::where('external_food_id', '173944')->where('is_custom', false)->count(),
        );
    }
}
