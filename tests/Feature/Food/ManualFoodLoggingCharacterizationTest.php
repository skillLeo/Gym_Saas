<?php

namespace Tests\Feature\Food;

use App\Models\FoodItem;
use App\Models\FoodLogEntry;
use App\Models\MealSlot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * CHARACTERIZATION TEST — pins manual food logging exactly as it behaves today.
 *
 * Written BEFORE the journal write was extracted out of FoodLogController and
 * run before and after, so "manual logging is unchanged" is a demonstrated
 * fact rather than a claim.
 *
 * Most of this file records what the code DOES rather than what it ought to,
 * which is what let it be run unchanged either side of the FoodJournal
 * extraction to show that nothing moved.
 *
 * Three behaviours were originally pinned here as bugs. Two have since been
 * fixed and their tests now assert the fixed behaviour; the other is still
 * pinned as-is:
 *
 *   1. FIXED. storeFromApi() used to discard external_food_id, brand,
 *      serving_weight_grams, fiber_g, sugar_g and sodium_mg, because
 *      $request->validate() returns only the keys that carry a rule and those
 *      six had none. Every food logged from search, barcode, photo or voice
 *      lost its brand and its micronutrients.
 *   2. FIXED as a consequence. external_food_id being always null meant
 *      firstOrCreate() matched on name alone, so two genuinely different foods
 *      sharing a name collapsed into one and the first one's nutrition was
 *      logged for both.
 *   3. STILL PINNED. meal_type is written from $slot->legacy_key, which
 *      seedDefaultsFor() never populates, so it is null for every entry made
 *      against a default meal slot.
 */
class ManualFoodLoggingCharacterizationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private MealSlot $slot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'email_verified_at'  => now(),
            'trial_ends_at'      => now()->addDays(20),
            'daily_calorie_goal' => 2200,
        ]);

        MealSlot::seedDefaultsFor($this->user->id);
        $this->slot = MealSlot::where('user_id', $this->user->id)->orderBy('sort_order')->first();

        Sanctum::actingAs($this->user);
    }

    private function food(array $overrides = []): FoodItem
    {
        return FoodItem::create(array_merge([
            'name'                 => 'Chicken breast, raw',
            'serving_qty'          => 100,
            'serving_unit'         => 'g',
            'serving_weight_grams' => 100,
            'calories'             => 120,
            'protein_g'            => 22.5,
            'carbs_g'              => 0,
            'fat_g'                => 2.6,
            'is_custom'            => false,
        ], $overrides));
    }

    /**
     * MySQL stores logged_date in a DATE column, so `where('logged_date',
     * '2026-10-30')` matches. SQLite has no date type and Laravel writes
     * "2026-10-30 00:00:00" into it, so the same comparison matches nothing
     * and every date-filtered read looks empty.
     *
     * That is a property of the test driver, not of the application — the real
     * app is MySQL and the filter works there (verified against the running
     * local app). Rewriting the stored value here lets the read-path tests
     * exercise the real controller code on both drivers instead of being
     * skipped on one.
     */
    private function normaliseDatesForSqlite(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return;
        }

        foreach (DB::table('food_log_entries')->get() as $row) {
            DB::table('food_log_entries')
                ->where('id', $row->id)
                ->update(['logged_date' => substr((string) $row->logged_date, 0, 10)]);
        }
    }

    /**
     * Every key path in a structure, sorted. Comparing these catches a field
     * being added, removed or renamed anywhere in the response, which is what
     * "unchanged for the frontend" actually means.
     */
    private function keyPaths(mixed $value, string $prefix = ''): array
    {
        if (! is_array($value)) {
            return [$prefix];
        }

        $paths = [];
        foreach ($value as $k => $v) {
            // List indices collapse to [*]: three entries in an array must not
            // read as three different shapes.
            $key  = is_int($k) ? '[*]' : $k;
            $path = $prefix === '' ? $key : "{$prefix}.{$key}";
            $paths = array_merge($paths, $this->keyPaths($v, $path));
        }

        $paths = array_values(array_unique($paths));
        sort($paths);

        return $paths;
    }

    /** The serialised shape of one food_log_entry with its food loaded. */
    private const ENTRY_KEYS = [
        'created_at',
        'food_item.brand',
        'food_item.calories',
        'food_item.carbs_g',
        'food_item.created_at',
        'food_item.created_by_user_id',
        'food_item.external_food_id',
        'food_item.fat_g',
        'food_item.fiber_g',
        'food_item.food_source',
        'food_item.id',
        'food_item.is_custom',
        'food_item.name',
        'food_item.protein_g',
        'food_item.serving_qty',
        'food_item.serving_unit',
        'food_item.serving_weight_grams',
        'food_item.sodium_mg',
        'food_item.sugar_g',
        'food_item.updated_at',
        'food_item_id',
        'id',
        'image_url',
        'logged_date',
        'meal_slot_id',
        'meal_type',
        'servings',
        'total_calories',
        'total_carbs_g',
        'total_fat_g',
        'total_protein_g',
        'updated_at',
        'user_id',
    ];

    private static function prefixed(string $prefix, array $keys): array
    {
        $out = array_map(static fn ($k) => "{$prefix}.{$k}", $keys);
        sort($out);

        return $out;
    }

    // ------------------------------------------------- POST /api/food-log

    public function test_store_response_shape_is_exactly_this(): void
    {
        $food = $this->food();

        $res = $this->postJson('/api/food-log', [
            'food_item_id' => $food->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1.5,
        ])->assertStatus(201);

        $expected = array_merge(self::prefixed('data', self::ENTRY_KEYS), ['message', 'success']);
        sort($expected);

        // The relation serialises as `food_item`, not `foodItem`.
        $this->assertSame($expected, $this->keyPaths($res->json()));

        $res->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Food logged.');
    }

    public function test_store_computes_totals_by_multiplying_and_rounding_to_two_places(): void
    {
        $food = $this->food();

        $this->postJson('/api/food-log', [
            'food_item_id' => $food->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1.5,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.total_calories', 180)     // 120  * 1.5
            ->assertJsonPath('data.total_protein_g', 33.75)  // 22.5 * 1.5
            ->assertJsonPath('data.total_carbs_g', 0)        // 0    * 1.5
            ->assertJsonPath('data.total_fat_g', 3.9);       // 2.6  * 1.5
    }

    public function test_store_rounding_is_phps_float_rounding(): void
    {
        $food = $this->food(['calories' => 33.333, 'protein_g' => 1.005, 'carbs_g' => 0, 'fat_g' => 0]);

        $this->postJson('/api/food-log', [
            'food_item_id' => $food->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 3,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.total_calories', 100)   // 99.999 -> 100
            // 1.005 * 3 is 3.0149999... in binary floating point, so this
            // rounds DOWN to 3.01, not up to 3.02. Pinned exactly: an
            // extraction must not quietly change the arithmetic.
            ->assertJsonPath('data.total_protein_g', 3.01);
    }

    public function test_store_writes_this_exact_row(): void
    {
        $food = $this->food();

        $this->postJson('/api/food-log', [
            'food_item_id' => $food->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 2,
        ])->assertStatus(201);

        $row = FoodLogEntry::sole();

        $this->assertSame($this->user->id, $row->user_id);
        $this->assertSame($food->id, $row->food_item_id);
        $this->assertSame($this->slot->id, $row->meal_slot_id);
        $this->assertSame('2026-10-30', $row->logged_date->toDateString());
        $this->assertEquals(2, $row->servings);
        $this->assertEquals(240, $row->total_calories);
        $this->assertEquals(45, $row->total_protein_g);
        $this->assertEquals(0, $row->total_carbs_g);
        $this->assertEquals(5.2, $row->total_fat_g);

        // BUG, PINNED (3): meal_type copies $slot->legacy_key, which
        // seedDefaultsFor() never sets, so it is null on every default slot.
        $this->assertNull($this->slot->legacy_key);
        $this->assertNull($row->meal_type);
    }

    public function test_store_image_url_is_null_unless_given(): void
    {
        // store() reads `$food->image_url`, but food_items has no such column,
        // so the fallback can never produce anything. Pinned as null.
        $this->assertNotContains('image_url', \Illuminate\Support\Facades\Schema::getColumnListing('food_items'));

        $this->postJson('/api/food-log', [
            'food_item_id' => $this->food()->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.image_url', null);
    }

    public function test_store_keeps_an_explicit_image_url(): void
    {
        $this->postJson('/api/food-log', [
            'food_item_id' => $this->food()->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
            'image_url'    => 'https://example.test/explicit.jpg',
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.image_url', 'https://example.test/explicit.jpg');
    }

    public function test_store_refuses_another_members_meal_slot(): void
    {
        $other = User::factory()->create();
        MealSlot::seedDefaultsFor($other->id);

        $this->postJson('/api/food-log', [
            'food_item_id' => $this->food()->id,
            'meal_slot_id' => MealSlot::where('user_id', $other->id)->first()->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])
            ->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error', 'Unauthorized.');

        $this->assertDatabaseCount('food_log_entries', 0);
    }

    #[DataProvider('invalidStorePayloads')]
    public function test_store_validation_rules_are_unchanged(array $payload, string $field): void
    {
        $this->postJson('/api/food-log', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors($field);
    }

    public static function invalidStorePayloads(): array
    {
        $base = [
            'food_item_id' => 1,
            'meal_slot_id' => 1,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ];

        return [
            'missing food'     => [array_diff_key($base, ['food_item_id' => null]), 'food_item_id'],
            'missing slot'     => [array_diff_key($base, ['meal_slot_id' => null]), 'meal_slot_id'],
            'missing date'     => [array_diff_key($base, ['logged_date' => null]), 'logged_date'],
            'servings zero'    => [['servings' => 0] + $base, 'servings'],
            'servings too big' => [['servings' => 101] + $base, 'servings'],
            'servings text'    => [['servings' => 'two'] + $base, 'servings'],
            'unknown food'     => [['food_item_id' => 999999] + $base, 'food_item_id'],
        ];
    }

    // ---------------------------------------- POST /api/food-log/from-api

    private function fromApiPayload(array $foodOverrides = [], array $overrides = []): array
    {
        return array_merge([
            'food_data' => array_merge([
                'external_food_id' => '1234567',
                'name'             => 'Apple, raw',
                'brand'            => 'Orchard Co',
                'serving_qty'      => 100,
                'serving_unit'     => 'g',
                'calories'         => 52,
                'protein_g'        => 0.3,
                'carbs_g'          => 14,
                'fat_g'            => 0.2,
                'fiber_g'          => 2.4,
                'sugar_g'          => 10.4,
                'sodium_mg'        => 1,
            ], $foodOverrides),
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ], $overrides);
    }

    public function test_from_api_response_shape_matches_store_exactly(): void
    {
        $res = $this->postJson('/api/food-log/from-api', $this->fromApiPayload())
            ->assertStatus(201);

        $expected = array_merge(self::prefixed('data', self::ENTRY_KEYS), ['message', 'success']);
        sort($expected);

        // The two write endpoints must stay interchangeable from the
        // frontend's point of view. The AI confirm path becomes a third caller
        // of the same write, so this shape is now load-bearing in three places.
        $this->assertSame($expected, $this->keyPaths($res->json()));

        $res->assertJsonPath('message', 'Food logged.');
    }

    public function test_from_api_stores_every_field_it_is_sent(): void
    {
        $this->postJson('/api/food-log/from-api', $this->fromApiPayload())->assertStatus(201);

        $food = FoodItem::sole();

        $this->assertSame('Apple, raw', $food->name);
        $this->assertEquals(52, $food->calories);
        $this->assertEquals(0.3, $food->protein_g);
        $this->assertEquals(14, $food->carbs_g);
        $this->assertEquals(0.2, $food->fat_g);
        $this->assertEquals(100, $food->serving_qty);
        $this->assertSame('g', $food->serving_unit);

        // FIXED (1). These six were sent by every caller and silently dropped,
        // because they carried no validation rule and $request->validate()
        // returns only ruled keys.
        $this->assertSame('1234567', $food->external_food_id);
        $this->assertSame('Orchard Co', $food->brand);
        $this->assertEquals(2.4, $food->fiber_g);
        $this->assertEquals(10.4, $food->sugar_g);
        $this->assertEquals(1, $food->sodium_mg);
    }

    public function test_from_api_stores_a_serving_weight_when_one_is_sent(): void
    {
        $this->postJson(
            '/api/food-log/from-api',
            $this->fromApiPayload(['serving_weight_grams' => 182]),
        )->assertStatus(201);

        $this->assertEquals(182, FoodItem::sole()->serving_weight_grams);
    }

    public function test_from_api_still_accepts_a_payload_without_the_optional_fields(): void
    {
        // The barcode, photo-log and voice-log screens send only the required
        // seven. Backwards compatibility: an omitted optional field is still
        // simply absent, not a validation failure.
        $this->postJson('/api/food-log/from-api', [
            'food_data' => [
                'name' => 'Plain food', 'serving_qty' => 100, 'serving_unit' => 'g',
                'calories' => 52, 'protein_g' => 0.3, 'carbs_g' => 14, 'fat_g' => 0.2,
            ],
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->assertStatus(201);

        $food = FoodItem::sole();
        $this->assertNull($food->external_food_id);
        $this->assertNull($food->brand);
        $this->assertNull($food->fiber_g);
    }

    public function test_from_api_rejects_a_malformed_optional_field(): void
    {
        $this->postJson(
            '/api/food-log/from-api',
            $this->fromApiPayload(['fiber_g' => -5]),
        )->assertStatus(422)->assertJsonValidationErrors('food_data.fiber_g');

        $this->assertDatabaseCount('food_log_entries', 0);
    }

    public function test_from_api_keeps_two_foods_with_the_same_name_apart(): void
    {
        // FIXED (2). external_food_id now survives validation, so the lookup
        // can tell two different USDA foods apart even when they share a name.
        // Previously both collapsed into one record and the first one's
        // nutrition was logged for both.
        FoodItem::create([
            'external_food_id' => '9999999',
            'name'             => 'Apple, raw',
            'is_custom'        => false,
            'serving_qty'      => 100,
            'serving_unit'     => 'g',
            'calories'         => 999,
            'protein_g'        => 9,
            'carbs_g'          => 9,
            'fat_g'            => 9,
        ]);

        $this->postJson('/api/food-log/from-api', $this->fromApiPayload())
            ->assertStatus(201)
            // 52, not 999: the other food's numbers are no longer borrowed.
            ->assertJsonPath('data.total_calories', 52);

        $this->assertSame(2, FoodItem::where('name', 'Apple, raw')->count());

        // A repeat of the same request reuses the row it just made.
        $this->postJson('/api/food-log/from-api', $this->fromApiPayload())->assertStatus(201);
        $this->assertSame(2, FoodItem::where('name', 'Apple, raw')->count());
        $this->assertDatabaseCount('food_log_entries', 2);
    }

    public function test_from_api_totals_come_from_the_matched_row(): void
    {
        // Pre-create the row the lookup WILL match — same external id, same
        // name. An existing record's numbers still win over the ones in the
        // request, which is unchanged behaviour: firstOrCreate() only writes
        // its second argument when it has to create.
        FoodItem::create([
            'external_food_id' => '1234567',
            'name'             => 'Apple, raw',
            'is_custom'        => false,
            'serving_qty'      => 100,
            'serving_unit'     => 'g',
            'calories'         => 999,
            'protein_g'        => 9,
            'carbs_g'          => 9,
            'fat_g'            => 9,
        ]);

        $this->postJson('/api/food-log/from-api', $this->fromApiPayload())
            ->assertStatus(201)
            ->assertJsonPath('data.total_calories', 999);

        $this->assertSame(1, FoodItem::where('name', 'Apple, raw')->count());
    }

    public function test_from_api_image_url_defaults_to_null(): void
    {
        $this->postJson('/api/food-log/from-api', $this->fromApiPayload())
            ->assertStatus(201)
            ->assertJsonPath('data.image_url', null);
    }

    public function test_from_api_keeps_an_explicit_image_url(): void
    {
        $this->postJson('/api/food-log/from-api', $this->fromApiPayload([], [
            'image_url' => 'https://example.test/photo.jpg',
        ]))
            ->assertStatus(201)
            ->assertJsonPath('data.image_url', 'https://example.test/photo.jpg');
    }

    public function test_from_api_refuses_another_members_meal_slot(): void
    {
        $other = User::factory()->create();
        MealSlot::seedDefaultsFor($other->id);

        $this->postJson('/api/food-log/from-api', $this->fromApiPayload([], [
            'meal_slot_id' => MealSlot::where('user_id', $other->id)->first()->id,
        ]))->assertStatus(403)->assertJsonPath('error', 'Unauthorized.');

        $this->assertDatabaseCount('food_log_entries', 0);
    }

    #[DataProvider('invalidFromApiPayloads')]
    public function test_from_api_validation_rules_are_unchanged(array $remove, string $field): void
    {
        $payload = [
            'food_data' => [
                'name' => 'Apple', 'serving_qty' => 100, 'serving_unit' => 'g',
                'calories' => 52, 'protein_g' => 0.3, 'carbs_g' => 14, 'fat_g' => 0.2,
            ],
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ];

        foreach ($remove as $path) {
            data_forget($payload, $path);
        }

        $this->postJson('/api/food-log/from-api', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors($field);
    }

    public static function invalidFromApiPayloads(): array
    {
        return [
            'no name'     => [['food_data.name'], 'food_data.name'],
            'no calories' => [['food_data.calories'], 'food_data.calories'],
            'no protein'  => [['food_data.protein_g'], 'food_data.protein_g'],
            'no carbs'    => [['food_data.carbs_g'], 'food_data.carbs_g'],
            'no fat'      => [['food_data.fat_g'], 'food_data.fat_g'],
            'no serving'  => [['food_data.serving_qty'], 'food_data.serving_qty'],
            'no unit'     => [['food_data.serving_unit'], 'food_data.serving_unit'],
            'no slot'     => [['meal_slot_id'], 'meal_slot_id'],
            'no date'     => [['logged_date'], 'logged_date'],
            'no servings' => [['servings'], 'servings'],
        ];
    }

    // --------------------------------- the reads that totals depend on

    public function test_index_groups_by_slot_with_these_totals(): void
    {
        $this->postJson('/api/food-log', [
            'food_item_id' => $this->food()->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1.5,
        ])->assertStatus(201);

        $this->normaliseDatesForSqlite();

        $res = $this->getJson('/api/food-log?date=2026-10-30')->assertOk();

        $expected = array_merge(
            self::prefixed('data.[*].entries.[*]', self::ENTRY_KEYS),
            [
                'data.[*].name',
                'data.[*].slot_id',
                'data.[*].sort_order',
                'data.[*].total_calories',
                'data.[*].total_carbs',
                'data.[*].total_fat',
                'data.[*].total_protein',
                'success',
            ],
        );
        sort($expected);

        $this->assertSame($expected, $this->keyPaths($res->json()));

        // Slot totals are summed then rounded to ONE place, unlike the
        // per-entry totals which are rounded to two.
        $res->assertJsonPath('data.0.total_calories', 180)
            ->assertJsonPath('data.0.total_protein', 33.8)
            ->assertJsonPath('data.0.total_fat', 3.9)
            ->assertJsonCount(6, 'data');          // six default meal slots
    }

    public function test_summary_totals_and_goal_percentage(): void
    {
        foreach ([1, 1] as $servings) {
            $this->postJson('/api/food-log', [
                'food_item_id' => $this->food()->id,
                'meal_slot_id' => $this->slot->id,
                'logged_date'  => '2026-10-30',
                'servings'     => $servings,
            ])->assertStatus(201);
        }

        $this->normaliseDatesForSqlite();

        $this->getJson('/api/food-log/summary?date=2026-10-30')
            ->assertOk()
            ->assertJsonPath('data.date', '2026-10-30')
            ->assertJsonPath('data.total_calories', 240)
            ->assertJsonPath('data.total_protein_g', 45)
            ->assertJsonPath('data.calorie_goal', 2200)
            ->assertJsonPath('data.calorie_pct', 11);   // round(240/2200*100)
    }

    // ----------------------------------------------- update and destroy

    public function test_update_recomputes_totals_from_the_food_item(): void
    {
        $id = $this->postJson('/api/food-log', [
            'food_item_id' => $this->food()->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->json('data.id');

        $this->putJson("/api/food-log/{$id}", ['servings' => 3])
            ->assertOk()
            ->assertJsonPath('message', 'Entry updated.')
            ->assertJsonPath('data.total_calories', 360)
            ->assertJsonPath('data.total_protein_g', 67.5);
    }

    public function test_update_and_destroy_refuse_another_members_entry(): void
    {
        $id = $this->postJson('/api/food-log', [
            'food_item_id' => $this->food()->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->json('data.id');

        Sanctum::actingAs(User::factory()->create([
            'email_verified_at' => now(), 'trial_ends_at' => now()->addDays(20),
        ]));

        $this->putJson("/api/food-log/{$id}", ['servings' => 9])->assertStatus(403);
        $this->deleteJson("/api/food-log/{$id}")->assertStatus(403);

        $this->assertDatabaseCount('food_log_entries', 1);
    }

    public function test_destroy_removes_the_entry(): void
    {
        $id = $this->postJson('/api/food-log', [
            'food_item_id' => $this->food()->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->json('data.id');

        $this->deleteJson("/api/food-log/{$id}")
            ->assertOk()
            ->assertJsonPath('message', 'Entry deleted.');

        $this->assertDatabaseCount('food_log_entries', 0);
    }
}
