<?php

namespace Tests\Feature\Food;

use App\Models\FoodItem;
use App\Models\MealSlot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * CHARACTERIZATION — how the two write paths decide whether a food already
 * exists, pinned exactly as they behave today.
 *
 * Written and committed BEFORE the fix, so that "one USDA food is now stored
 * once" can be demonstrated rather than claimed.
 *
 * There are two paths into food_items from an external record:
 *
 *   /api/food-log/from-api      the barcode, search, photo-log and voice-log
 *                               screens
 *   /api/ai/food-log/confirm    Snap / Say / Type
 *
 * They use DIFFERENT firstOrCreate keys, so the same USDA food arriving down
 * both roads is stored twice. The tests below record that, including the
 * detail that makes it happen: from-api never writes food_source, so the AI
 * path's key — which includes it — can never match a row from-api created.
 */
class DuplicateFoodTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private MealSlot $slot;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ai.api_key'         => 'sk-svcacct-TESTONLY0000000000000000',
            'ai.consent_version' => '1',
        ]);
        Http::preventStrayRequests();

        $this->user = User::factory()->create([
            'email_verified_at'   => now(),
            'trial_ends_at'       => now()->addDays(20),
            'ai_features_enabled' => true,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => '1',
        ]);

        MealSlot::seedDefaultsFor($this->user->id);
        $this->slot = MealSlot::where('user_id', $this->user->id)->orderBy('sort_order')->first();

        Sanctum::actingAs($this->user);
    }

    /** The same USDA record, in each path's request shape. */
    private const USDA_FOOD = [
        'external_food_id'     => '1102644',
        'name'                 => 'Apples, raw, with skin',
        'brand'                => null,
        'serving_qty'          => 100,
        'serving_unit'         => 'g',
        'serving_weight_grams' => 100,
        'calories'             => 52,
        'protein_g'            => 0.3,
        'carbs_g'              => 13.8,
        'fat_g'                => 0.2,
        'fiber_g'              => 2.4,
        'sugar_g'              => 10.4,
        'sodium_mg'            => 1,
    ];

    private function logViaLegacy(array $overrides = []): void
    {
        $this->postJson('/api/food-log/from-api', [
            'food_data'    => array_merge(self::USDA_FOOD, $overrides),
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->assertStatus(201);
    }

    private function logViaAi(array $overrides = []): void
    {
        $this->postJson('/api/ai/food-log/confirm', [
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'items'        => [['grams' => 100, 'food' => array_merge(self::USDA_FOOD, $overrides)]],
        ])->assertStatus(201);
    }

    // ------------------------------------------------- what each path writes

    public function test_the_ai_path_records_where_the_food_came_from(): void
    {
        $this->logViaAi();

        $food = FoodItem::sole();
        $this->assertSame('1102644', $food->external_food_id);
        $this->assertSame('usda', $food->food_source);
    }

    public function test_the_legacy_path_records_the_id_and_the_source(): void
    {
        $this->logViaLegacy();

        $food = FoodItem::sole();
        $this->assertSame('1102644', $food->external_food_id);

        // FIXED. food_source is written now, which is what lets a row made
        // here be found by the AI path — and vice versa.
        $this->assertSame('usda', $food->food_source);
    }

    // ------------------------------------------- the duplication itself

    public function test_the_same_food_down_both_paths_is_stored_once(): void
    {
        $this->logViaLegacy();
        $this->logViaAi();

        // FIXED. One real apple, one record, two journal entries pointing at
        // it — whichever screen the member used.
        $this->assertSame(1, FoodItem::where('external_food_id', '1102644')->count());
        $this->assertDatabaseCount('food_log_entries', 2);
    }

    public function test_the_order_no_longer_matters(): void
    {
        // It used to: legacy-first made two rows and AI-first made one,
        // because only the AI key looked at food_source. Both orders now end
        // in the same single record.
        $this->logViaAi();
        $this->logViaLegacy();

        $this->assertSame(1, FoodItem::where('external_food_id', '1102644')->count());
        $this->assertSame('usda', FoodItem::sole()->food_source);
    }

    // --------------------------------------- what each path does on its own

    public function test_the_legacy_path_reuses_its_own_rows(): void
    {
        $this->logViaLegacy();
        $this->logViaLegacy();

        $this->assertSame(1, FoodItem::where('external_food_id', '1102644')->count());
        $this->assertDatabaseCount('food_log_entries', 2);
    }

    public function test_the_ai_path_reuses_its_own_rows(): void
    {
        $this->logViaAi();
        $this->logViaAi();

        $this->assertSame(1, FoodItem::where('external_food_id', '1102644')->count());
        $this->assertDatabaseCount('food_log_entries', 2);
    }

    public function test_both_paths_keep_different_foods_apart(): void
    {
        $this->logViaLegacy();
        $this->logViaLegacy(['external_food_id' => '9999999']);

        $this->assertSame(2, FoodItem::where('name', self::USDA_FOOD['name'])->count());
    }

    public function test_a_food_with_no_external_id_still_matches_on_name(): void
    {
        $this->logViaLegacy(['external_food_id' => null]);
        $this->logViaLegacy(['external_food_id' => null]);

        $this->assertSame(1, FoodItem::whereNull('external_food_id')->count());
    }

    // --------------------------------------------- shapes that must not move

    public function test_both_endpoints_still_answer_in_their_existing_shape(): void
    {
        $legacy = $this->postJson('/api/food-log/from-api', [
            'food_data'    => self::USDA_FOOD,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->assertStatus(201);

        $this->assertSame(['data', 'message', 'success'], $this->sortedKeys($legacy->json()));

        $ai = $this->postJson('/api/ai/food-log/confirm', [
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'items'        => [['grams' => 100, 'food' => self::USDA_FOOD]],
        ])->assertStatus(201);

        $this->assertSame(['data', 'message', 'success'], $this->sortedKeys($ai->json()));
        $this->assertSame(['entries', 'totals'], $this->sortedKeys($ai->json('data')));
    }

    private function sortedKeys(array $a): array
    {
        $k = array_keys($a);
        sort($k);

        return $k;
    }
}
