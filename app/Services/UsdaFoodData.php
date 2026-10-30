<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Food lookups against USDA FoodData Central.
 *
 * Replaces Nutritionix, which this project moved off. One free api.data.gov key
 * covers everything; there is no per-request cost, so results are cached mainly
 * to stay inside the hourly rate limit rather than to save money.
 *
 * NUTRIENT VALUES ARE PER 100 g, ALWAYS.
 * FoodData Central reports `foodNutrients[].value` per 100 g for every data
 * type. Branded items also carry a `servingSize`, and it is tempting to present
 * that as the serving — but the nutrient numbers would still be per 100 g, so
 * a 30 g serving would be logged with 100 g of calories. Everything is
 * therefore normalised to 100 g and the caller scales by servings, which is
 * what the food log already does.
 *
 * WHAT THIS CANNOT DO
 * Nutritionix sold a natural-language endpoint ("2 eggs and a slice of toast"
 * -> nutrients). FoodData Central has no equivalent, so parseNatural() below is
 * a local parser over the same search index. It handles the common shapes and
 * is honest about what it could not resolve; it is not the same product.
 */
class UsdaFoodData
{
    private const BASE = 'https://api.nal.usda.gov/fdc/v1';

    /*
     * Seven days. Nutrition for "apple, raw" does not change, and the previous
     * one hour meant a member logging the same breakfast on consecutive days
     * paid the full network cost twice. The cache exists to stay inside the
     * rate limit as much as to be quick.
     */
    private const CACHE_TTL = 604800;

    /** Most simultaneous lookups. See searchMany(). */
    private const CONCURRENCY = 5;

    /** FoodData Central nutrient numbers. */
    private const N_CALORIES = 1008;
    private const N_PROTEIN  = 1003;
    private const N_CARBS    = 1005;
    private const N_FAT      = 1004;
    private const N_FIBER    = 1079;
    private const N_SUGAR    = 2000;
    private const N_SODIUM   = 1093;

    /**
     * The admin panel can store a key in system_settings, which takes priority
     * over the environment so it can be changed without a deploy.
     */
    public function apiKey(): ?string
    {
        $key = SystemSetting::get('usda_api_key', config('services.usda.api_key'));

        return filled($key) ? (string) $key : null;
    }

    public function configured(): bool
    {
        return $this->apiKey() !== null;
    }

    /** Free-text search. Returns an array of foods in this app's shape. */
    public function search(string $query, int $limit = 25): array
    {
        $this->unavailable = false;

        return $this->searchRaw($query, $limit);
    }

    /**
     * The search itself, without touching the `unavailable` flag.
     *
     * parseNatural() runs one of these per food in the sentence. If each call
     * reset the flag, a failure on the first item would be erased by the second
     * succeeding, and the caller would be told everything was fine.
     */
    private function searchRaw(string $query, int $limit): array
    {
        if (! $this->configured()) {
            return [];
        }

        $key = $this->cacheKey($query, $limit);

        if (($hit = Cache::get($key)) !== null) {
            return $hit;
        }

        $res = $this->get('/foods/search', $this->searchParams($query, $limit));

        if ($res === null) {
            // Deliberately NOT cached. Cache::remember would store this empty
            // array for an hour, so one rate-limited second would make a food
            // look non-existent for everyone until the hour was up.
            return [];
        }

        $foods = collect($res['foods'] ?? [])
            ->map(fn ($f) => $this->mapFood($f))
            ->filter(fn ($f) => $f['calories'] !== null)
            ->values()
            ->all();

        Cache::put($key, $foods, self::CACHE_TTL);

        return $foods;
    }

    /**
     * Search several labels at once, concurrently.
     *
     * The AI food draft produces one label per food it recognises — six or
     * more for a plate of food — and running those lookups one after another
     * put seven to ten seconds of pure waiting into a request a member is
     * sitting in front of. They are independent, so they go out together.
     *
     * Cached labels never leave the process at all; only the misses are
     * fetched, in batches of CONCURRENCY. Order is preserved: the returned
     * array is keyed by the original query string.
     *
     * @param  list<string> $queries
     * @return array<string, list<array>>
     */
    public function searchMany(array $queries, int $limit = 3): array
    {
        $this->unavailable = false;

        $queries = array_values(array_unique(array_filter($queries, 'filled')));
        $results = [];
        $misses  = [];

        if (! $this->configured()) {
            return array_fill_keys($queries, []);
        }

        foreach ($queries as $query) {
            $hit = Cache::get($this->cacheKey($query, $limit));

            if ($hit !== null) {
                $results[$query] = $hit;
            } else {
                $misses[] = $query;
            }
        }

        foreach (array_chunk($misses, self::CONCURRENCY) as $batch) {
            /*
             * A cap rather than everything at once. FoodData Central is a
             * shared public service on a per-key rate limit, and firing a
             * dozen simultaneous requests is the quickest way to be throttled
             * — which would make the feature slower, not faster.
             */
            $responses = Http::pool(fn (Pool $pool) => array_map(
                fn (string $q) => $pool->as($q)
                    ->timeout(12)
                    ->get(self::BASE.'/foods/search', $this->searchParams($q, $limit) + ['api_key' => $this->apiKey()]),
                $batch,
            ));

            foreach ($batch as $query) {
                $results[$query] = $this->absorb($query, $responses[$query] ?? null, $limit);
            }
        }

        // Re-key in the caller's order, including duplicates they may have sent.
        return array_reduce(
            $queries,
            function (array $carry, string $q) use ($results) {
                $carry[$q] = $results[$q] ?? [];

                return $carry;
            },
            [],
        );
    }

    /**
     * Turn one pooled response into mapped foods, caching and flagging
     * exactly as the sequential path does.
     *
     * @param  \Illuminate\Http\Client\Response|\Throwable|null $response
     */
    private function absorb(string $query, mixed $response, int $limit): array
    {
        if (! $response instanceof \Illuminate\Http\Client\Response) {
            // A thrown transfer error: we never got an answer.
            $this->unavailable = true;
            Log::warning('USDA FoodData Central unreachable (pool)');

            return [];
        }

        if ($response->status() === 429) {
            $this->unavailable = true;
            Log::warning('USDA FoodData Central rate limit reached (pool)');

            return [];
        }

        if (! $response->successful()) {
            if ($response->serverError()) {
                $this->unavailable = true;
            }
            Log::warning('USDA FoodData Central request failed (pool)', ['status' => $response->status()]);

            return [];
        }

        $foods = collect($response->json()['foods'] ?? [])
            ->map(fn ($f) => $this->mapFood($f))
            ->filter(fn ($f) => $f['calories'] !== null)
            ->values()
            ->all();

        // Only successes are cached — a throttled second must not make a food
        // look non-existent for everyone until the entry expires.
        Cache::put($this->cacheKey($query, $limit), $foods, self::CACHE_TTL);

        return $foods;
    }

    /**
     * Cache key for a search.
     *
     * Normalised, so "Scrambled Eggs", "scrambled  eggs" and " scrambled eggs "
     * are one entry rather than three. The AI draft produces labels with
     * inconsistent capitalisation, so without this the cache would miss far
     * more often than it hit.
     */
    private function cacheKey(string $query, int $limit): string
    {
        $normalised = preg_replace('/\s+/', ' ', trim(mb_strtolower($query)));

        return 'usda_search_'.md5($normalised.'|'.$limit);
    }

    /** @return array<string,string|int> */
    private function searchParams(string $query, int $limit): array
    {
        return [
            'query'    => $query,
            'pageSize' => $limit,
            // Foundation and SR Legacy are the curated generic foods
            // ("chicken breast"); Branded covers supermarket products.
            'dataType' => 'Foundation,SR Legacy,Branded',
        ];
    }

    /**
     * Barcode lookup. Branded items in FoodData Central carry a gtinUpc, so a
     * search for the number finds them; the exact match is preferred because
     * the search index will also return loose text matches.
     */
    public function barcode(string $upc): ?array
    {
        $this->unavailable = false;

        if (! $this->configured()) {
            return null;
        }

        // Not Cache::remember: a null from a failed lookup would be stored for
        // a day, so one bad minute would make a real product permanently
        // "not in the database" for every member who scanned it.
        $key = 'usda_upc_'.preg_replace('/\D/', '', $upc);
        if (($hit = Cache::get($key)) !== null) {
            return $hit;
        }

        $found = (function () use ($upc) {
            $digits = preg_replace('/\D/', '', $upc);
            if ($digits === '') {
                return null;
            }

            // FoodData Central stores GTINs zero-padded to 14 digits, and the
            // search index matches the stored string. A scanner handing us a
            // 12-digit UPC-A therefore finds nothing at all — the query misses
            // before any comparison happens. Try the number as given, then the
            // padded forms, so both scanner styles work.
            $candidates = array_values(array_unique([
                $digits,
                str_pad($digits, 12, '0', STR_PAD_LEFT),
                str_pad($digits, 13, '0', STR_PAD_LEFT),
                str_pad($digits, 14, '0', STR_PAD_LEFT),
            ]));

            $wanted = ltrim($digits, '0');

            foreach ($candidates as $candidate) {
                $res = $this->get('/foods/search', [
                    'query'    => $candidate,
                    'pageSize' => 10,
                    'dataType' => 'Branded',
                ]);

                foreach (($res['foods'] ?? []) as $f) {
                    // Compare with leading zeros stripped from both sides, so
                    // 12-, 13- and 14-digit spellings of the same product match.
                    if (ltrim((string) ($f['gtinUpc'] ?? ''), '0') === $wanted) {
                        return $this->mapFood($f);
                    }
                }
            }

            return null;
        })();

        if ($found !== null) {
            Cache::put($key, $found, 86400);
        }

        return $found;
    }

    /**
     * Best-effort natural language: "2 eggs and a slice of wholemeal toast".
     *
     * Splits the phrase into items, pulls a leading quantity off each, and looks
     * the remainder up in the search index. Returns both what it resolved and
     * what it could not, so the caller can tell the member which parts of their
     * sentence were understood rather than silently dropping them.
     */
    public function parseNatural(string $text): array
    {
        $this->unavailable = false;

        if (! $this->configured()) {
            return ['items' => [], 'unresolved' => []];
        }

        $words = [
            'a' => 1, 'an' => 1, 'one' => 1, 'two' => 2, 'three' => 3, 'four' => 4,
            'five' => 5, 'six' => 6, 'seven' => 7, 'eight' => 8, 'nine' => 9, 'ten' => 10,
            'half' => 0.5,
        ];
        // Words that describe the portion rather than the food.
        $units = 'slices?|pieces?|cups?|bowls?|glass(?:es)?|servings?|scoops?|tbsp|tsp|tablespoons?|teaspoons?|grams?|g|oz|ounces?|ml|plates?|handfuls?';

        $items = [];
        $unresolved = [];

        foreach (preg_split('/\s*(?:,|\band\b|\bwith\b|\bplus\b|\+)\s*/i', $text) as $chunk) {
            $chunk = trim($chunk);
            if ($chunk === '') {
                continue;
            }

            $qty = 1.0;
            if (preg_match('/^([\d]+(?:\.\d+)?)\s*/', $chunk, $m)) {
                $qty = (float) $m[1];
                $chunk = trim(substr($chunk, strlen($m[0])));
            } elseif (preg_match('/^(\w+)\s+/', $chunk, $m) && isset($words[strtolower($m[1])])) {
                $qty = (float) $words[strtolower($m[1])];
                $chunk = trim(substr($chunk, strlen($m[0])));
            }

            // Drop a portion word so "slices of toast" searches for "toast".
            $chunk = preg_replace('/^(?:'.$units.')\s+(?:of\s+)?/i', '', $chunk);
            $chunk = trim($chunk);
            if ($chunk === '') {
                continue;
            }

            $hits = $this->searchRaw($chunk, 3);
            if ($hits === []) {
                $unresolved[] = $chunk;
                continue;
            }

            $food = $hits[0];
            $food['servings'] = $qty;
            $food['matched_from'] = $chunk;
            $items[] = $food;
        }

        return ['items' => $items, 'unresolved' => $unresolved];
    }

    // ---------------------------------------------------------------- internals

    /**
     * True when we could not get an answer out of FoodData Central at all —
     * rate limited, server error, or the network dropped.
     *
     * That is a completely different thing to a member than "no matches": one
     * means "we could not look that up right now", the other means "that food
     * does not exist". Both failure modes turned up while building this — a 429
     * from the shared DEMO_KEY and a dropped connection — and both were
     * reporting "not in the database", which is an answer people act on.
     *
     * Reset only at the start of a public call, not per HTTP request, because
     * barcode() makes several attempts and the last one succeeding does not
     * undo the fact that earlier ones could not be answered.
     */
    public bool $unavailable = false;

    private function get(string $path, array $query): ?array
    {
        try {
            $res = Http::timeout(12)
                ->get(self::BASE.$path, $query + ['api_key' => $this->apiKey()]);

            if ($res->status() === 429) {
                $this->unavailable = true;
                Log::warning('USDA FoodData Central rate limit reached', ['path' => $path]);

                return null;
            }

            if (! $res->successful()) {
                // A 5xx is the provider failing, not the food missing. A 4xx
                // other than 429 means we asked wrongly, which is our bug.
                if ($res->serverError()) {
                    $this->unavailable = true;
                }

                Log::warning('USDA FoodData Central request failed', [
                    'path' => $path, 'status' => $res->status(),
                ]);

                return null;
            }

            return $res->json();
        } catch (\Throwable $e) {
            // Timeout, DNS, TLS, connection reset — we never got an answer.
            $this->unavailable = true;
            Log::warning('USDA FoodData Central unreachable', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /** FoodData Central item -> this application's food shape (per 100 g). */
    private function mapFood(array $f): array
    {
        $n = [];
        foreach (($f['foodNutrients'] ?? []) as $nut) {
            // The search endpoint uses nutrientId/value; the detail endpoint
            // uses nutrient.id/amount. Accept either so this mapper works for
            // both without a second code path.
            $id  = $nut['nutrientId'] ?? $nut['nutrient']['id'] ?? null;
            $val = $nut['value'] ?? $nut['amount'] ?? null;
            if ($id !== null && $val !== null) {
                $n[(int) $id] = (float) $val;
            }
        }

        $brand = $f['brandName'] ?? $f['brandOwner'] ?? null;

        return [
            'external_food_id'     => isset($f['fdcId']) ? (string) $f['fdcId'] : null,
            'source'               => 'usda',
            'name'                 => trim((string) ($f['description'] ?? 'Unknown food')),
            'brand'                => $brand ? trim((string) $brand) : null,
            // Always per 100 g — see the class docblock.
            'serving_qty'          => 100,
            'serving_unit'         => 'g',
            'serving_weight_grams' => 100,
            'calories'             => $n[self::N_CALORIES] ?? null,
            'protein_g'            => $n[self::N_PROTEIN] ?? 0,
            'carbs_g'              => $n[self::N_CARBS] ?? 0,
            'fat_g'                => $n[self::N_FAT] ?? 0,
            'fiber_g'              => $n[self::N_FIBER] ?? 0,
            'sugar_g'              => $n[self::N_SUGAR] ?? 0,
            'sodium_mg'            => $n[self::N_SODIUM] ?? 0,
        ];
    }
}
