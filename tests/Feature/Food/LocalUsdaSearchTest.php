<?php

namespace Tests\Feature\Food;

use App\Services\UsdaFoodData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Searching the local copy of USDA's curated foods, and when the API is still
 * worth asking.
 *
 * The point of importing those datasets was to stop an ordinary food word
 * depending on a service that spent days at a time timing out. So the first
 * thing these pin is the strongest claim: with foods in the local tables, a
 * lookup makes no network request at all — asserted by forbidding stray
 * requests outright, not by counting them.
 *
 * The API keeps two jobs it alone can do: branded supermarket products, which
 * are two million rows that change constantly, and barcodes.
 */
class LocalUsdaSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.usda.api_key' => 'TEST-USDA-KEY']);
        Cache::flush();
        Http::preventStrayRequests();
    }

    /** @param array<string,mixed> $extra */
    private function localFood(int $id, string $description, float $calories = 100, array $extra = []): void
    {
        DB::table('usda_foods')->insert($extra + [
            'fdc_id'      => $id,
            'data_type'   => 'sr_legacy_food',
            'description' => $description,
            'calories'    => $calories,
            'protein_g'   => 1,
            'carbs_g'     => 2,
            'fat_g'       => 3,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    private function usda(): UsdaFoodData
    {
        return app(UsdaFoodData::class);
    }

    // ------------------------------------------------- no network at all

    public function test_a_local_food_is_found_without_any_request(): void
    {
        $this->localFood(173944, 'Bananas, raw', 89);

        // Http::preventStrayRequests() is already on: any request at all fails
        // the test, so this asserts the absence of a network call directly.
        $out = $this->usda()->search('banana', 3);

        $this->assertSame('Bananas, raw', $out[0]['name']);
        $this->assertEquals(89, $out[0]['calories']);
        $this->assertSame('generic', $out[0]['kind']);
        $this->assertSame('usda', $out[0]['source']);
    }

    public function test_it_works_with_no_api_key_whatsoever(): void
    {
        // The whole point: FoodData Central being unreachable, or never
        // configured, must not stop a member logging a banana.
        config(['services.usda.api_key' => null]);
        $this->localFood(173944, 'Bananas, raw', 89);

        $out = $this->usda()->search('banana', 3);

        $this->assertSame('Bananas, raw', $out[0]['name']);
    }

    public function test_the_pooled_lookup_the_ai_uses_is_also_local(): void
    {
        $this->localFood(173944, 'Bananas, raw', 89);
        $this->localFood(170379, 'Broccoli, raw', 34);

        $out = $this->usda()->searchMany(['banana', 'broccoli'], 3);

        $this->assertSame('Bananas, raw', $out['banana'][0]['name']);
        $this->assertSame('Broccoli, raw', $out['broccoli'][0]['name']);
    }

    public function test_the_local_id_is_food_data_centrals_own(): void
    {
        /*
         * Not cosmetic. The food resolver keys on (external_food_id,
         * food_source), so a food found locally and the same food found over
         * the API have to collapse to one food_items row — otherwise every
         * member who logged a banana before the import gets a second one.
         */
        $this->localFood(173944, 'Bananas, raw', 89);

        $this->assertSame('173944', $this->usda()->search('banana', 3)[0]['external_food_id']);
    }

    public function test_a_food_with_no_calorie_figure_is_never_offered(): void
    {
        // 29% of Foundation's foods have no energy value at all. A row with no
        // calories cannot be logged, so it must not be shown as a choice.
        $this->localFood(1, 'Mystery food, raw', 0);
        DB::table('usda_foods')->where('fdc_id', 1)->update(['calories' => null]);

        $this->assertSame([], $this->usda()->search('mystery', 3));
    }

    // ------------------------------------------------- when the API is used

    public function test_branded_is_still_fetched_when_nothing_local_fits(): void
    {
        $this->localFood(173944, 'Bananas, raw', 89);

        Http::fake(['*api.nal.usda.gov*' => Http::response([
            'foods' => [[
                'fdcId' => 999, 'description' => 'PROTEIN FLAPJACK', 'dataType' => 'Branded',
                'foodNutrients' => [['nutrientId' => 1008, 'value' => 420]],
            ]],
        ])]);

        $out = $this->usda()->search('protein flapjack', 3);

        $this->assertSame('PROTEIN FLAPJACK', $out[0]['name']);
        $this->assertSame('brand', $out[0]['kind']);
    }

    public function test_the_curated_sets_are_not_re_fetched_over_the_network(): void
    {
        /*
         * With the datasets on disk, asking the API for Foundation and SR
         * Legacy would be requesting a copy of what we already hold. Only
         * Branded should ever leave the machine.
         */
        $this->localFood(173944, 'Bananas, raw', 89);

        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => []])]);

        $this->usda()->search('something not in the local tables', 3);

        Http::assertSent(function ($request) {
            parse_str((string) parse_url((string) $request->url(), PHP_URL_QUERY), $q);

            return ($q['dataType'] ?? '') === 'Branded';
        });

        // Exactly one request: the branded pass, and nothing else.
        Http::assertSentCount(1);
    }

    public function test_without_a_local_copy_it_behaves_as_before(): void
    {
        // A fresh install that has never run foods:import-usda still works,
        // over the network, exactly as it did before any of this.
        Http::fake(['*api.nal.usda.gov*' => Http::response([
            'foods' => [[
                'fdcId' => 173944, 'description' => 'Bananas, raw', 'dataType' => 'SR Legacy',
                'foodNutrients' => [['nutrientId' => 1008, 'value' => 89]],
            ]],
        ])]);

        $this->assertSame(0, DB::table('usda_foods')->count());

        $out = $this->usda()->search('banana', 3);

        $this->assertSame('Bananas, raw', $out[0]['name']);
        Http::assertSent(function ($request) {
            parse_str((string) parse_url((string) $request->url(), PHP_URL_QUERY), $q);

            return str_contains((string) ($q['dataType'] ?? ''), 'Foundation');
        });
    }

    // ------------------------------------------------------------- aliases

    public function test_an_everyday_name_from_the_config_is_searched_too(): void
    {
        config(['food_aliases' => ['wholemeal' => 'whole wheat']]);

        $this->localFood(172688, 'Bread, whole-wheat, commercially prepared', 252);

        // "wholemeal" appears nowhere in the data; only the alias reaches it.
        $out = $this->usda()->search('wholemeal bread', 3);

        $this->assertSame('Bread, whole-wheat, commercially prepared', $out[0]['name']);
    }

    public function test_an_alias_adds_candidates_rather_than_replacing_them(): void
    {
        /*
         * This is why an ambiguous alias such as chips/fries is safe to ship:
         * the member's own word is still searched, so its results cannot be
         * hidden by the alias's.
         */
        config(['food_aliases' => ['chips' => 'french fries']]);

        $this->localFood(1, 'Potato chips, plain, salted', 536);
        $this->localFood(2, 'French fries, frozen, heated', 312);

        $names = array_column($this->usda()->search('chips', 5), 'name');

        $this->assertContains('Potato chips, plain, salted', $names);
        $this->assertContains('French fries, frozen, heated', $names);
    }

    public function test_the_callers_alternate_and_the_alias_are_both_used(): void
    {
        /*
         * The AI path supplies the model's own US name. Preferring it threw
         * the curated list away — the model offered "oatmeal" for porridge,
         * which finds oatmeal BREAD, while the alias knows to ask for the
         * cooked cereal.
         */
        config(['food_aliases' => ['porridge' => 'cereals oats cooked']]);

        $this->localFood(1, 'Bread, oatmeal', 269);
        $this->localFood(2, 'Cereals, oats, regular and quick, cooked with water', 71);

        $names = array_column($this->usda()->search('porridge', 5, 'oatmeal'), 'name');

        $this->assertContains('Cereals, oats, regular and quick, cooked with water', $names);
        $this->assertContains('Bread, oatmeal', $names);
    }

    // ------------------------------------------------- preferred foods

    public function test_a_preferred_food_wins_even_when_another_scores_higher(): void
    {
        /*
         * The whole reason the list exists. "Potatoes, raw, skin" answers
         * "potato" better by every name-matching rule here — it leads with the
         * word and carries one qualifier — but it is potato skin, and a member
         * logging a potato means the potato.
         */
        config(['food_preferred' => ['potato' => 170026]]);

        $this->localFood(1, 'Potatoes, raw, skin', 58);
        $this->localFood(170026, 'Potatoes, flesh and skin, raw', 77);

        $out = $this->usda()->search('potato', 3);

        $this->assertSame('Potatoes, flesh and skin, raw', $out[0]['name']);
        $this->assertTrue($out[0]['preferred']);
    }

    public function test_a_preferred_food_is_found_even_if_the_search_would_have_missed_it(): void
    {
        // Named foods are fetched by id, not hoped for in the candidate list.
        config(['food_preferred' => ['porridge' => 173905]]);

        $this->localFood(173905, 'Cereals, oats, regular and quick, cooked with water', 71);

        $out = $this->usda()->search('porridge', 3);

        $this->assertSame(173905, (int) $out[0]['external_food_id']);
    }

    public function test_the_other_candidates_are_still_offered(): void
    {
        // It decides the default, not the options — the member can still pick
        // something else from the dropdown.
        config(['food_preferred' => ['potato' => 170026]]);

        $this->localFood(1, 'Potatoes, raw, skin', 58);
        $this->localFood(170026, 'Potatoes, flesh and skin, raw', 77);

        $names = array_column($this->usda()->search('potato', 5), 'name');

        $this->assertContains('Potatoes, raw, skin', $names);
    }

    public function test_it_matches_the_whole_query_not_a_word_inside_it(): void
    {
        /*
         * A longer phrase carries detail the list cannot know about, so it
         * belongs to the ranking. "Chicken breast" is named; "grilled chicken
         * breast with rice and broccoli" is a meal, not an entry.
         */
        config(['food_preferred' => ['chicken breast' => 2]]);

        $this->localFood(1, 'Chicken, breast, raw', 120);
        $this->localFood(2, 'Chicken, breast, cooked, roasted', 165);

        $this->assertSame(2, (int) $this->usda()->search('chicken breast', 3)[0]['external_food_id']);
        $this->assertSame(2, (int) $this->usda()->search('  Chicken  Breast ', 3)[0]['external_food_id']);

        $longer = $this->usda()->search('grilled chicken breast with rice', 3);
        $this->assertFalse($longer[0]['preferred'] ?? false);
    }

    public function test_a_preferred_id_that_is_not_imported_is_ignored(): void
    {
        // An id for a food this install has not got must not blank the result.
        config(['food_preferred' => ['banana' => 999999]]);

        $this->localFood(173944, 'Bananas, raw', 89);

        $this->assertSame('Bananas, raw', $this->usda()->search('banana', 3)[0]['name']);
    }

    public function test_the_shipped_list_is_well_formed(): void
    {
        /*
         * Cannot check the ids resolve — the test database holds no imported
         * foods — but it can check the file stays editable by hand without
         * breaking the lookup, which matches on a normalised key.
         */
        $preferred = require base_path('config/food_preferred.php');

        $this->assertGreaterThanOrEqual(100, count($preferred));

        foreach ($preferred as $term => $id) {
            $this->assertIsInt($id, "'{$term}' must be an fdc_id");
            $this->assertGreaterThan(0, $id, "'{$term}' has a nonsense id");
            $this->assertSame(
                preg_replace('/\s+/', ' ', trim(mb_strtolower((string) $term))),
                (string) $term,
                "'{$term}' is not normalised, so it can never match a query",
            );
        }
    }

    // ------------------------------------------------- raw versus cooked

    private function chickenPair(): void
    {
        $this->localFood(1, 'Chicken, breast, boneless, skinless, raw', 112);
        $this->localFood(2, 'Chicken, breast, meat only, cooked, roasted', 165);
    }

    public function test_cooked_is_preferred_when_the_caller_says_cooked(): void
    {
        /*
         * The difference is 47 kcal per 100 g on a food the model identified
         * perfectly — a 40% error from picking the wrong entry, which is more
         * than most of what the ranking rules are arguing about.
         */
        $this->chickenPair();

        $out = $this->usda()->search('chicken breast', 3, null, 'cooked');

        $this->assertSame('Chicken, breast, meat only, cooked, roasted', $out[0]['name']);
    }

    public function test_raw_is_preferred_only_when_the_caller_says_raw(): void
    {
        $this->chickenPair();

        $out = $this->usda()->search('chicken breast', 3, null, 'raw');

        $this->assertSame('Chicken, breast, boneless, skinless, raw', $out[0]['name']);
    }

    public function test_grilled_and_boiled_count_as_cooked(): void
    {
        // A member who says "grilled" has told us it is not raw, which is the
        // part that matters; USDA may file it as roasted or broiled.
        $this->chickenPair();

        foreach (['grilled', 'baked', 'boiled', 'fried'] as $how) {
            Cache::flush();
            $out = $this->usda()->search('chicken breast', 3, null, $how);

            $this->assertSame(
                'Chicken, breast, meat only, cooked, roasted',
                $out[0]['name'],
                "'{$how}' should not have chosen the raw entry",
            );
        }
    }

    public function test_unknown_leaves_the_ranking_alone(): void
    {
        $this->chickenPair();

        Cache::flush();
        $unknown = $this->usda()->search('chicken breast', 3, null, 'unknown');
        Cache::flush();
        $none = $this->usda()->search('chicken breast', 3);

        $this->assertSame($none[0]['name'], $unknown[0]['name']);
    }

    public function test_manual_search_is_unchanged(): void
    {
        /*
         * The search box has no model behind it and no way to know how
         * anything was cooked, so it passes nothing and the rule is inert.
         * This is the guarantee that the feature cannot change what someone
         * typing into the food search sees.
         */
        $this->chickenPair();

        $withoutPreparation = $this->usda()->search('chicken breast', 3);
        Cache::flush();
        $explicitNull = $this->usda()->search('chicken breast', 3, null, null);

        $this->assertSame(
            array_column($withoutPreparation, 'name'),
            array_column($explicitNull, 'name'),
        );
    }

    public function test_a_stated_preparation_overrides_the_preferred_food(): void
    {
        /*
         * The preferred list gives the default for a bare word; a stated
         * preparation is more specific and wins. "Chicken breast" defaults to
         * the roasted entry, but if the model saw raw chicken that default is
         * simply wrong.
         */
        config(['food_preferred' => ['chicken breast' => 2]]);
        $this->chickenPair();

        $out = $this->usda()->search('chicken breast', 3, null, 'raw');

        $this->assertSame('Chicken, breast, boneless, skinless, raw', $out[0]['name']);
        $this->assertFalse($out[0]['preferred'] ?? false);
    }

    public function test_the_preparation_is_part_of_the_cache_key(): void
    {
        // Raw and cooked are two questions with two right answers; sharing a
        // cache entry would serve one as the other.
        $this->chickenPair();

        $cooked = $this->usda()->search('chicken breast', 3, null, 'cooked');
        $raw    = $this->usda()->search('chicken breast', 3, null, 'raw');

        $this->assertNotSame($cooked[0]['name'], $raw[0]['name']);
    }

    public function test_each_label_can_have_its_own_preparation(): void
    {
        // One plate can hold raw salad beside grilled meat.
        $this->chickenPair();
        $this->localFood(3, 'Lettuce, cos or romaine, raw', 17);

        $out = $this->usda()->searchMany(
            ['chicken breast', 'lettuce'],
            3,
            [],
            ['chicken breast' => 'grilled', 'lettuce' => 'raw'],
        );

        $this->assertSame('Chicken, breast, meat only, cooked, roasted', $out['chicken breast'][0]['name']);
        $this->assertSame('Lettuce, cos or romaine, raw', $out['lettuce'][0]['name']);
    }

    // ------------------------------------------------------ duplicates

    public function test_the_same_food_from_both_datasets_is_shown_once(): void
    {
        /*
         * Foundation and SR Legacy overlap — 110 descriptions appear more than
         * once in the imported tables. The member saw the same food listed two
         * or three times in the picker with nothing to tell the entries apart.
         */
        $this->localFood(1, 'Broccoli, raw', 34);
        $this->localFood(2, 'Broccoli, raw', 32);

        $names = array_column($this->usda()->search('broccoli', 5), 'name');

        $this->assertSame(['Broccoli, raw'], $names);
    }

    public function test_the_fuller_row_survives(): void
    {
        // They are the same food, so the figures are what differ, and a row
        // with fibre and sugar filled in is strictly more use.
        DB::table('usda_foods')->insert([
            ['fdc_id' => 1, 'data_type' => 'sr_legacy_food', 'description' => 'Broccoli, raw',
             'calories' => 34, 'protein_g' => 2.8, 'carbs_g' => 6.6, 'fat_g' => 0.4,
             'fiber_g' => null, 'sugar_g' => null, 'sodium_mg' => null, 'created_at' => now(), 'updated_at' => now()],
            ['fdc_id' => 2, 'data_type' => 'foundation_food', 'description' => 'Broccoli, raw',
             'calories' => 32, 'protein_g' => 2.6, 'carbs_g' => 6.3, 'fat_g' => 0.3,
             'fiber_g' => 2.4, 'sugar_g' => 1.5, 'sodium_mg' => 33, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $out = $this->usda()->search('broccoli', 5);

        $this->assertCount(1, $out);
        $this->assertSame('2', $out[0]['external_food_id']);
        $this->assertEquals(2.4, $out[0]['fiber_g']);
    }

    public function test_usdas_provenance_note_does_not_make_a_second_food(): void
    {
        /*
         * "(Includes foods for USDA's Food Distribution Program)" is appended
         * to some names. It says where the record came from, not what the food
         * is, so it must not split one food into two rows in the picker.
         */
        $this->localFood(1, 'Apples, raw, with skin', 52);
        $this->localFood(2, "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", 52);

        $this->assertCount(1, $this->usda()->search('apple', 5));
    }

    public function test_genuinely_different_foods_are_not_collapsed(): void
    {
        $this->localFood(1, 'Broccoli, raw', 34);
        $this->localFood(2, 'Broccoli, cooked, boiled, drained, without salt', 35);
        $this->localFood(3, 'Broccoli raab, raw', 22);

        $this->assertCount(3, $this->usda()->search('broccoli', 5));
    }

    public function test_the_best_match_still_comes_first_after_collapsing(): void
    {
        // Collapsing takes the fuller row's figures but keeps the better
        // match's position, so de-duplicating cannot reorder the list.
        $this->localFood(1, 'Broccoli, raw', 34);
        $this->localFood(2, 'Broccoli, raw', 32);
        $this->localFood(3, 'Soup, broccoli cheese', 180);

        $this->assertSame('Broccoli, raw', $this->usda()->search('broccoli', 5)[0]['name']);
    }

    // ----------------------------------------------------------- ordering

    public function test_the_same_query_gives_the_same_answer_every_time(): void
    {
        /*
         * Equal scores are common — "Tofu, fried" and "Tofu yogurt" answer
         * "tofu" as well as each other. Before the tie-break was fixed the
         * winner depended on the order the database happened to return, so
         * consecutive runs could disagree.
         */
        $this->localFood(3, 'Tofu yogurt', 94);
        $this->localFood(2, 'Tofu, fried', 270);
        $this->localFood(1, 'Tofu, raw, firm', 144);

        $first = array_column($this->usda()->search('tofu', 5), 'name');
        Cache::flush();
        $second = array_column($this->usda()->search('tofu', 5), 'name');

        $this->assertSame($first, $second);
    }
}
