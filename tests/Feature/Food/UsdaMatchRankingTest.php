<?php

namespace Tests\Feature\Food;

use App\Services\UsdaFoodData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Which food the lookup puts first.
 *
 * FoodData Central ranks by text relevance over a database where branded
 * products outnumber the curated foods enormously, and where a food's name
 * leads with its kind: "Oil, avocado", "Bread, potato", "Marmalade, orange".
 * Taking its first answer gave a member 312 kcal for a banana and a loaf of
 * bread for porridge.
 *
 * These pin the rules that fixed it, each against the case that motivated it.
 * The end-to-end number lives in `php artisan foods:match-report`, which talks
 * to the real API; this is the behaviour, fixed and offline.
 */
class UsdaMatchRankingTest extends TestCase
{
    // The lookup checks system_settings for an admin-entered key override.
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.usda.api_key' => 'TEST-USDA-KEY']);
        Cache::flush();
        Http::preventStrayRequests();
    }

    /** @param array<string,mixed> $extra */
    private function food(string $description, string $dataType = 'SR Legacy', float $calories = 100, array $extra = []): array
    {
        return $extra + [
            'fdcId'         => crc32($description.$dataType),
            'description'   => $description,
            'dataType'      => $dataType,
            'foodNutrients' => [['nutrientId' => 1008, 'value' => $calories]],
        ];
    }

    /**
     * Answer differently depending on what was asked for.
     *
     * @param  callable(string $query, string $dataType): array  $responder
     */
    private function fakeUsda(callable $responder): void
    {
        Http::fake(function (Request $request) use ($responder) {
            parse_str((string) parse_url((string) $request->url(), PHP_URL_QUERY), $q);

            return Http::response([
                'foods' => $responder((string) ($q['query'] ?? ''), (string) ($q['dataType'] ?? '')),
            ]);
        });
    }

    private function usda(): UsdaFoodData
    {
        return app(UsdaFoodData::class);
    }

    // --------------------------------------------- curated before branded

    public function test_branded_is_not_searched_when_the_curated_sets_answer(): void
    {
        $this->fakeUsda(fn (string $q, string $type) => str_contains($type, 'Branded')
            ? [$this->food('BANANA', 'Branded', 312)]
            : [$this->food('Bananas, raw', 'SR Legacy', 89)]);

        $out = $this->usda()->search('banana', 3);

        $this->assertSame('Bananas, raw', $out[0]['name']);
        $this->assertSame('generic', $out[0]['kind']);

        // One request: the branded pass never happened.
        Http::assertSentCount(1);
    }

    public function test_branded_is_searched_when_the_curated_sets_do_not_answer(): void
    {
        $this->fakeUsda(fn (string $q, string $type) => str_contains($type, 'Branded')
            ? [$this->food('PROTEIN FLAPJACK', 'Branded', 420)]
            : []);

        $out = $this->usda()->search('protein flapjack', 3);

        $this->assertSame('PROTEIN FLAPJACK', $out[0]['name']);
        $this->assertSame('brand', $out[0]['kind']);
    }

    public function test_a_branded_item_that_is_plainly_the_food_still_wins_over_a_generic_one_that_is_not(): void
    {
        /*
         * The generic bonus is a thumb on the scale, not a veto. A curated
         * entry for a different food must not beat a packet of the right one.
         */
        $this->fakeUsda(fn (string $q, string $type) => str_contains($type, 'Branded')
            ? [$this->food('SKYR', 'Branded', 63)]
            : [$this->food('Bread, rye', 'SR Legacy', 259)]);

        $out = $this->usda()->search('skyr', 3);

        $this->assertSame('SKYR', $out[0]['name']);
    }

    // ------------------------------------------------- the headword rule

    public function test_a_food_named_after_the_query_beats_one_merely_containing_it(): void
    {
        // "Bread, potato" is a bread. "Potatoes, ..." is a potato, despite
        // carrying three more words of varietal detail.
        $this->fakeUsda(fn () => [
            $this->food('Bread, potato', 'SR Legacy', 266),
            $this->food('Potatoes, russet, flesh and skin, raw', 'SR Legacy', 77),
        ]);

        $out = $this->usda()->search('potato', 3);

        $this->assertSame('Potatoes, russet, flesh and skin, raw', $out[0]['name']);
    }

    public function test_an_oil_made_from_the_food_does_not_win(): void
    {
        $this->fakeUsda(fn () => [
            $this->food('Oil, avocado', 'SR Legacy', 884),
            $this->food('Avocados, raw, all commercial varieties', 'SR Legacy', 160),
        ]);

        $out = $this->usda()->search('avocado', 3);

        $this->assertSame('Avocados, raw, all commercial varieties', $out[0]['name']);
    }

    public function test_a_product_made_from_the_food_does_not_win_even_with_the_right_first_word(): void
    {
        // Both lead with "potato", so the headword rule cannot separate them.
        $this->fakeUsda(fn () => [
            $this->food('Potato flour', 'SR Legacy', 357),
            $this->food('Potatoes, russet, flesh and skin, raw', 'SR Legacy', 77),
        ]);

        $out = $this->usda()->search('potato', 3);

        $this->assertSame('Potatoes, russet, flesh and skin, raw', $out[0]['name']);
    }

    public function test_asking_for_the_derived_product_still_finds_it(): void
    {
        // The penalty only applies to words the member did NOT ask for.
        $this->fakeUsda(fn () => [
            $this->food('Oranges, raw, all commercial varieties', 'SR Legacy', 47),
            $this->food('Orange juice, canned, unsweetened', 'SR Legacy', 45),
        ]);

        $out = $this->usda()->search('orange juice', 3);

        $this->assertSame('Orange juice, canned, unsweetened', $out[0]['name']);
    }

    // ------------------------------------------------------ plural forms

    public function test_a_singular_query_matches_a_plural_entry(): void
    {
        /*
         * This is a regression test for a real bug: stripping "es" from every
         * word ending in it turned "apples" into "appl", so "apple" never met
         * "Apples, raw" and the top match for apple was a strudel. "Bananas"
         * hid it, because it ends in "as" and took the -s branch.
         */
        $this->fakeUsda(fn () => [
            $this->food('Strudel, apple', 'SR Legacy', 274),
            $this->food('Apples, raw, without skin', 'SR Legacy', 48),
        ]);

        $out = $this->usda()->search('apple', 3);

        $this->assertSame('Apples, raw, without skin', $out[0]['name']);
    }

    public function test_plural_folding_does_not_mangle_sibilants(): void
    {
        $this->fakeUsda(fn () => [
            $this->food('Peaches, raw', 'SR Legacy', 39),
            $this->food('Bread, rye', 'SR Legacy', 259),
        ]);

        $this->assertSame('Peaches, raw', $this->usda()->search('peach', 3)[0]['name']);
    }

    // ------------------------------------------------- the US spelling

    public function test_a_british_word_is_also_searched_under_its_us_name(): void
    {
        $seen = [];

        $this->fakeUsda(function (string $q) use (&$seen) {
            $seen[] = $q;

            return $q === 'eggplant' ? [$this->food('Eggplant, raw', 'SR Legacy', 25)] : [];
        });

        $out = $this->usda()->search('aubergine', 3);

        $this->assertContains('eggplant', $seen, 'the US spelling was never tried');
        $this->assertSame('Eggplant, raw', $out[0]['name']);
    }

    public function test_the_caller_can_supply_the_alternate_name(): void
    {
        /*
         * This is the route the model's search_name takes: it knows "porridge"
         * is filed under oats, and nothing in a static map has to.
         */
        $seen = [];

        $this->fakeUsda(function (string $q) use (&$seen) {
            $seen[] = $q;

            return $q === 'oats cooked'
                ? [$this->food('Cereals, oats, regular, cooked with water', 'SR Legacy', 71)]
                : [$this->food('Bread, oatmeal', 'SR Legacy', 269)];
        });

        $out = $this->usda()->search('porridge', 3, 'oats cooked');

        $this->assertContains('oats cooked', $seen);
        $this->assertSame('Cereals, oats, regular, cooked with water', $out[0]['name']);
    }

    public function test_the_alternate_is_part_of_the_cache_key(): void
    {
        $seen = [];

        $this->fakeUsda(function (string $q) use (&$seen) {
            $seen[] = $q;

            return [$this->food('Result for '.$q, 'SR Legacy', 100)];
        });

        // Same word, different alternate: these are different questions. If
        // the alternate were left out of the cache key the second call would
        // be served from the first one's entry and never ask for "oatmeal".
        $this->usda()->search('porridge', 3, 'oats cooked');
        $this->usda()->search('porridge', 3, 'oatmeal');

        $this->assertContains('oats cooked', $seen);
        $this->assertContains('oatmeal', $seen, 'the second lookup was wrongly served from the first one\'s cache');
    }

    // ------------------------------------------------------------- shape

    public function test_every_match_says_whether_it_is_generic_or_brand(): void
    {
        $this->fakeUsda(fn (string $q, string $type) => str_contains($type, 'Branded')
            ? [$this->food('KALE CHIPS', 'Branded', 480)]
            : [$this->food('Kale, raw', 'Foundation', 35)]);

        foreach ($this->usda()->search('kale', 3) as $match) {
            $this->assertContains($match['kind'], ['generic', 'brand']);
        }
    }

    public function test_overlap_reports_how_much_a_name_resembles_a_query(): void
    {
        $usda = $this->usda();

        // Drives "check this one" on the review screen.
        $this->assertSame(1.0, $usda->overlap('apple', 'Apples, raw'));
        $this->assertLessThan(0.5, $usda->overlap('wholemeal toast', 'Crackers, rusk'));
    }
}
