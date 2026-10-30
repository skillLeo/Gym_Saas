<?php

namespace Tests\Feature\Food;

use App\Services\UsdaFoodData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * searchMany(): the parallel, cached lookup the AI food draft depends on.
 *
 * A plate of food yields six or more labels. Done one at a time those put
 * seven to ten seconds of waiting into a request the member is watching, so
 * the correctness that matters here is: nothing is fetched twice, cache hits
 * cost no network at all, and a throttled response is never cached as though
 * the food did not exist.
 */
class UsdaSearchManyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.usda.api_key' => 'TEST-USDA-KEY']);
        Cache::flush();
        Http::preventStrayRequests();
    }

    private function food(string $description, float $calories = 52): array
    {
        return [
            'fdcId'       => crc32($description),
            'description' => $description,
            'foodNutrients' => [
                ['nutrientId' => 1008, 'value' => $calories],
                ['nutrientId' => 1003, 'value' => 1],
                ['nutrientId' => 1005, 'value' => 10],
                ['nutrientId' => 1004, 'value' => 2],
            ],
        ];
    }

    private function usda(): UsdaFoodData
    {
        return app(UsdaFoodData::class);
    }

    public function test_it_returns_results_keyed_by_the_original_query(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Apples, raw')]])]);

        $out = $this->usda()->searchMany(['apple', 'toast', 'egg']);

        $this->assertSame(['apple', 'toast', 'egg'], array_keys($out));
        $this->assertSame('Apples, raw', $out['apple'][0]['name']);
    }

    public function test_each_label_is_fetched_once(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Apples, raw')]])]);

        $this->usda()->searchMany(['apple', 'toast', 'egg']);

        Http::assertSentCount(3);
    }

    public function test_duplicate_labels_are_fetched_once_but_both_get_results(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Apples, raw')]])]);

        $out = $this->usda()->searchMany(['apple', 'toast', 'apple']);

        // A plate with two apples must not pay for two identical lookups.
        Http::assertSentCount(2);
        $this->assertNotEmpty($out['apple']);
        $this->assertNotEmpty($out['toast']);
    }

    public function test_a_second_call_costs_no_network_at_all(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Apples, raw')]])]);

        $first  = $this->usda()->searchMany(['apple', 'toast']);
        Http::assertSentCount(2);

        $second = $this->usda()->searchMany(['apple', 'toast']);

        // Still 2: the second call was served entirely from cache.
        Http::assertSentCount(2);
        $this->assertSame($first, $second);
    }

    public function test_the_cache_key_is_normalised(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Apples, raw')]])]);

        $this->usda()->searchMany(['Scrambled Eggs']);
        Http::assertSentCount(1);

        // The AI draft produces labels with inconsistent capitalisation and
        // spacing. Without normalising, the cache would miss far more than hit.
        $this->usda()->searchMany(['scrambled eggs']);
        $this->usda()->searchMany(['  SCRAMBLED   EGGS  ']);

        Http::assertSentCount(1);
    }

    public function test_the_sequential_search_shares_the_same_cache(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Apples, raw')]])]);

        $this->usda()->search('apple', 3);
        Http::assertSentCount(1);

        // Barcode scanning, typed search and the AI draft all warm one cache.
        $this->usda()->searchMany(['APPLE']);
        Http::assertSentCount(1);
    }

    public function test_a_rate_limited_label_is_empty_and_flagged_but_not_cached(): void
    {
        // A sequence, not two fake() calls: fake() MERGES stubs rather than
        // replacing them, so a second registration for the same pattern never
        // takes effect and the test would prove nothing.
        Http::fake(['*api.nal.usda.gov*' => Http::sequence()
            ->push(['error' => 'over limit'], 429)
            ->push(['foods' => [$this->food('Apples, raw')]]),
        ]);

        $usda = $this->usda();
        $out  = $usda->searchMany(['apple']);

        $this->assertSame([], $out['apple']);
        // "We could not look that up" is a different fact from "that food does
        // not exist", and the caller tells the member which it was.
        $this->assertTrue($usda->unavailable);

        // Crucially NOT cached: one throttled second must not make a real food
        // look non-existent for everyone until the entry would have expired.
        $this->assertNotEmpty($this->usda()->searchMany(['apple'])['apple']);
    }

    public function test_one_failing_label_does_not_lose_the_others(): void
    {
        Http::fake([
            '*query=apple*' => Http::response([], 500),
            '*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Bread, toasted')]]),
        ]);

        $out = $this->usda()->searchMany(['apple', 'toast']);

        $this->assertSame([], $out['apple']);
        $this->assertNotEmpty($out['toast']);
    }

    public function test_more_labels_than_the_concurrency_cap_all_resolve(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [$this->food('Something')]])]);

        $labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
        $out    = $this->usda()->searchMany($labels);

        // Twelve labels, a cap of five: three batches, nothing dropped.
        $this->assertSame($labels, array_keys($out));
        foreach ($labels as $l) {
            $this->assertNotEmpty($out[$l], "label {$l} lost");
        }
        Http::assertSentCount(12);
    }

    public function test_no_key_means_no_requests_and_empty_results(): void
    {
        config(['services.usda.api_key' => null]);
        Http::fake();

        $out = $this->usda()->searchMany(['apple', 'toast']);

        $this->assertSame(['apple' => [], 'toast' => []], $out);
        Http::assertNothingSent();
    }

    public function test_foods_without_calories_are_dropped(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => [
            ['fdcId' => 1, 'description' => 'Mystery item', 'foodNutrients' => []],
            $this->food('Apples, raw'),
        ]])]);

        $out = $this->usda()->searchMany(['apple']);

        // A match with no calorie figure is useless to a food journal.
        $this->assertCount(1, $out['apple']);
        $this->assertSame('Apples, raw', $out['apple'][0]['name']);
    }

    public function test_the_api_key_is_sent_as_a_query_parameter(): void
    {
        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => []])]);

        $this->usda()->searchMany(['apple']);

        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'api_key=TEST-USDA-KEY'));
    }
}
