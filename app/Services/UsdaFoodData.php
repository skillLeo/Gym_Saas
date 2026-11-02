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

    /*
     * The curated generic foods, searched first and on their own.
     *
     * Branded is a SEPARATE pass rather than another entry in this list, and
     * that separation is the fix: FoodData Central ranks by text relevance over
     * a set where branded products outnumber generic foods enormously, so a
     * single mixed request for "banana" filled every slot with packets before
     * any curated entry appeared.
     *
     * SURVEY (FNDDS) IS DELIBERATELY ABSENT, although it is the obvious third
     * curated set and was the intended design. Asking for it makes the API
     * return intermittent nginx 400s, measured over 12 identical requests for
     * "potato":
     *
     *     Foundation,SR Legacy                   0/12 failed
     *     Foundation,SR Legacy,Survey (FNDDS)    6/12 failed
     *     Survey (FNDDS) alone                   5/12 failed
     *
     * Percent-encoding the parentheses and passing dataType as an array were
     * both tried and were no better. It is a fault at their end, and a 400 is
     * silent here — it yields no results rather than an error — so including
     * Survey would have thrown away the generic pass about half the time and
     * quietly dropped every lookup through to branded. The cost of leaving it
     * out is that FNDDS's everyday prepared dishes are unavailable; the
     * ranking below plus the US spelling map cover the common cases instead.
     * Worth retrying if the API is fixed.
     */
    private const GENERIC_TYPES = 'Foundation,SR Legacy';
    private const BRANDED_TYPES = 'Branded';

    /**
     * Candidates fetched per pass, before ranking trims to the caller's limit.
     *
     * 50 rather than a page of 20 because FoodData Central's own relevance is
     * what we are correcting: for "apple" and "orange" the plain entry was not
     * in the first twenty at all, so there was nothing for the ranking to
     * promote and a croissant won. Measured at 25/37 correct with 20, 30/37
     * with 50. It is one request either way.
     */
    private const CANDIDATES = 50;

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
    /**
     * @param  string|null  $alternate  A second spelling to try if the query
     *                                  itself finds nothing good — the AI path
     *                                  passes the model's plain US name here
     *                                  ("porridge" -> "oatmeal").
     */
    public function search(string $query, int $limit = 25, ?string $alternate = null): array
    {
        $this->unavailable = false;

        return $this->searchRaw($query, $limit, $alternate);
    }

    /**
     * The search itself, without touching the `unavailable` flag.
     *
     * parseNatural() runs one of these per food in the sentence. If each call
     * reset the flag, a failure on the first item would be erased by the second
     * succeeding, and the caller would be told everything was fine.
     */
    /**
     * Curated foods first; supermarket products only if those do not answer.
     *
     * Up to three requests, and the common case is one:
     *   1. the generic sets for the query as typed;
     *   2. if that found nothing that shares half the query's words, the
     *      generic sets again for a US spelling of it, when there is one;
     *   3. branded, still nothing having answered.
     *
     * Branded results are appended rather than replacing, so a packet is
     * offered when it is the only thing resembling the food — but it is
     * ranked against everything else rather than inheriting the top slot.
     */
    private function searchRaw(string $query, int $limit, ?string $alternate = null): array
    {
        if (! $this->configured()) {
            return [];
        }

        $key = $this->cacheKey($query, $limit, $alternate);

        if (($hit = Cache::get($key)) !== null) {
            return $hit;
        }

        $variants = [$query];
        $found    = $this->fetch($query, self::GENERIC_TYPES);

        /*
         * The US spelling is searched WHENEVER there is one, not only after
         * the first attempt disappoints.
         *
         * "wholemeal toast" looked satisfied by "Crackers, rusk toast": it
         * shares the word "toast", which is half a two-word query, so the
         * fallback never fired and a 407 kcal cracker stood as the answer. A
         * query we already know is written in the wrong dialect should be
         * asked both ways and the results judged together.
         */
        $second = filled($alternate) ? (string) $alternate : $this->usEquivalent($query);

        if (filled($second) && mb_strtolower((string) $second) !== mb_strtolower($query)) {
            $alt = $this->fetch((string) $second, self::GENERIC_TYPES);

            if ($alt !== []) {
                $variants[] = (string) $second;
                $found      = array_merge($found, $alt);
            }
        }

        $ranked = $this->rank($found, $variants);

        if (! $this->goodEnough($ranked, $variants)) {
            $found  = array_merge($found, $this->fetch($query, self::BRANDED_TYPES));
            $ranked = $this->rank($found, $variants);
        }

        return $this->remember($key, $ranked, $limit);
    }

    /**
     * One search request, mapped. Empty on failure — `unavailable` carries the
     * distinction between "nothing matched" and "we never got an answer".
     *
     * @return list<array<string,mixed>>
     */
    private function fetch(string $query, string $dataType): array
    {
        $res = $this->get('/foods/search', $this->searchParams($query, $dataType));

        if ($res === null) {
            return [];
        }

        return collect($res['foods'] ?? [])
            ->map(fn ($f) => $this->mapFood($f))
            ->filter(fn ($f) => $f['calories'] !== null)
            ->values()
            ->all();
    }

    /**
     * Trim to what the caller asked for and cache it.
     *
     * Nothing is cached when the lookup failed outright, so one rate-limited
     * second cannot make a food look non-existent for a week.
     *
     * @param  list<array<string,mixed>>  $ranked
     * @return list<array<string,mixed>>
     */
    private function remember(string $key, array $ranked, int $limit): array
    {
        $top = array_slice($ranked, 0, $limit);

        if (! $this->unavailable) {
            Cache::put($key, $top, self::CACHE_TTL);
        }

        return $top;
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
    /**
     * @param  array<string,string>  $alternates  label => plain US search name,
     *                                            as supplied by the model.
     */
    public function searchMany(array $queries, int $limit = 3, array $alternates = []): array
    {
        $this->unavailable = false;

        $queries = array_values(array_unique(array_filter($queries, 'filled')));
        $results = [];
        $found   = [];   // query => candidates gathered so far
        $variant = [];   // query => spellings searched under

        if (! $this->configured()) {
            return array_fill_keys($queries, []);
        }

        foreach ($queries as $query) {
            $hit = Cache::get($this->cacheKey($query, $limit, $alternates[$query] ?? null));

            if ($hit !== null) {
                $results[$query] = $hit;
            } else {
                $found[$query]   = [];
                $variant[$query] = [$query];
            }
        }

        /*
         * Up to three pooled rounds, each over a strictly smaller set, so the
         * ordinary case where the curated foods answer at once still costs a
         * single round trip.
         *
         *   1. the curated sets, as the member said it;
         *   2. the curated sets again under a US spelling, for the few that
         *      found nothing — "porridge" is not a word this database knows;
         *   3. branded, for whatever is still unanswered.
         */
        $this->poolFetch($found, array_fill_keys(array_keys($found), null), self::GENERIC_TYPES);

        /*
         * Round two covers every term that HAS another spelling, not only the
         * ones round one failed on — see the note in searchRaw(). A query that
         * looks half-answered by the wrong food is the case this exists for.
         */
        $second = [];
        foreach (array_keys($found) as $q) {
            $q   = (string) $q;
            $alt = filled($alternates[$q] ?? null) ? (string) $alternates[$q] : $this->usEquivalent($q);

            if (filled($alt) && mb_strtolower((string) $alt) !== mb_strtolower($q)) {
                $second[$q]    = (string) $alt;
                $variant[$q][] = (string) $alt;
            }
        }

        /*
         * Once the service has told us it is unavailable — a rate limit, or
         * repeated failures — no further rounds are fired. Carrying on would
         * mean answering a 429 by making more requests, and the later rounds
         * would be scored as though the first had simply found nothing.
         */
        if ($second !== [] && ! $this->unavailable) {
            $this->poolFetch($found, $second, self::GENERIC_TYPES);
        }

        $stillUnanswered = $this->unavailable ? [] : $this->unanswered($found, $variant);

        if ($stillUnanswered !== []) {
            $this->poolFetch($found, array_fill_keys($stillUnanswered, null), self::BRANDED_TYPES);
        }

        foreach ($found as $query => $candidates) {
            $results[$query] = $this->remember(
                $this->cacheKey($query, $limit, $alternates[$query] ?? null),
                $this->rank($candidates, $variant[$query]),
                $limit,
            );
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
     * Which queries still have no candidate worth showing.
     *
     * @param  array<string,list<array<string,mixed>>>  $found
     * @param  array<string,list<string>>               $variant
     * @return list<string>
     */
    private function unanswered(array $found, array $variant): array
    {
        $out = [];

        foreach ($found as $query => $candidates) {
            if (! $this->goodEnough($this->rank($candidates, $variant[$query]), $variant[$query])) {
                $out[] = (string) $query;
            }
        }

        return $out;
    }

    /**
     * Run one pooled round and merge the results into $found, by original key.
     *
     * @param  array<string,list<array<string,mixed>>>  $found     modified in place
     * @param  array<string,string|null>                $searchAs  key => the term to
     *                                                             actually search for,
     *                                                             null meaning the key
     */
    private function poolFetch(array &$found, array $searchAs, string $dataType): void
    {
        foreach (array_chunk(array_keys($searchAs), self::CONCURRENCY, true) as $batch) {
            /*
             * A cap rather than everything at once. FoodData Central is a
             * shared public service on a per-key rate limit, and firing a
             * dozen simultaneous requests is the quickest way to be throttled
             * — which would make the feature slower, not faster.
             */
            $responses = Http::pool(fn (Pool $pool) => array_map(
                fn (string $key) => $pool->as($key)
                    ->timeout(12)
                    ->get(
                        self::BASE.'/foods/search',
                        $this->searchParams($searchAs[$key] ?? $key, $dataType) + ['api_key' => $this->apiKey()],
                    ),
                $batch,
            ));

            /*
             * Same spurious-400 retry as get(), for the pooled path the AI
             * uses. Only the keys that actually failed go round again, and
             * only once; a 429 is left alone because that is the rate limit.
             */
            $retry = [];

            foreach ($batch as $key) {
                $res = $responses[$key] ?? null;

                if ($res instanceof \Illuminate\Http\Client\Response
                    && ! $res->successful()
                    && $res->status() !== 429
                    && ! $res->serverError()) {
                    $retry[] = $key;

                    continue;
                }

                $found[$key] = array_merge($found[$key] ?? [], $this->absorb($res));
            }

            if ($retry === []) {
                continue;
            }

            usleep(250_000);

            $second = Http::pool(fn (Pool $pool) => array_map(
                fn (string $key) => $pool->as($key)
                    ->timeout(12)
                    ->get(
                        self::BASE.'/foods/search',
                        $this->searchParams($searchAs[$key] ?? $key, $dataType) + ['api_key' => $this->apiKey()],
                    ),
                $retry,
            ));

            foreach ($retry as $key) {
                $found[$key] = array_merge($found[$key] ?? [], $this->absorb($second[$key] ?? null));
            }
        }
    }

    /**
     * Turn one pooled response into mapped foods, caching and flagging
     * exactly as the sequential path does.
     *
     * @param  \Illuminate\Http\Client\Response|\Throwable|null $response
     */
    /**
     * One pooled response, mapped. Caching happens in remember(), after the
     * rounds have finished and the candidates are ranked — a single round's
     * results are not the answer.
     *
     * @return list<array<string,mixed>>
     */
    private function absorb(mixed $response): array
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

        return collect($response->json()['foods'] ?? [])
            ->map(fn ($f) => $this->mapFood($f))
            ->filter(fn ($f) => $f['calories'] !== null)
            ->values()
            ->all();
    }

    /**
     * Cache key for a search.
     *
     * Normalised, so "Scrambled Eggs", "scrambled  eggs" and " scrambled eggs "
     * are one entry rather than three. The AI draft produces labels with
     * inconsistent capitalisation, so without this the cache would miss far
     * more often than it hit.
     */
    /**
     * Drop the cached search for one term.
     *
     * Only `foods:match-report --fresh` uses this. Measuring a change to the
     * ranking against a 24-hour cache would compare the new code against the
     * old code's stored answers and show no difference at all.
     */
    public function forgetSearch(string $query, int $limit = 25, ?string $alternate = null): void
    {
        Cache::forget($this->cacheKey($query, $limit, $alternate));
    }

    /**
     * The alternate spelling is part of the key, because it changes the
     * answer: "porridge" alone and "porridge" with "oatmeal" to fall back on
     * are two different lookups and must not share a cache entry.
     */
    private function cacheKey(string $query, int $limit, ?string $alternate = null): string
    {
        $norm = static fn (string $s) => preg_replace('/\s+/', ' ', trim(mb_strtolower($s)));

        return 'usda_search_'.md5($norm($query).'|'.$limit.'|'.(filled($alternate) ? $norm((string) $alternate) : ''));
    }

    /** @return array<string,string|int> */
    private function searchParams(string $query, string $dataType): array
    {
        return [
            'query'    => $query,
            // More than we return, because the ranking below is the point: the
            // first page in FoodData Central's own order is frequently the
            // wrong food, and there is nothing to re-rank if we only ask for
            // three.
            'pageSize' => self::CANDIDATES,
            'dataType' => $dataType,
        ];
    }

    // ------------------------------------------------------------- ranking

    /**
     * Words that carry no identity, and so neither earn nor cost anything.
     *
     * Everything else that a candidate has and the query does not is treated
     * as a sign it is a different food — which is the whole mechanism behind
     * rejecting "Bread, potato" for "potato" and "Oil, avocado" for "avocado".
     * Preparation words are deliberately NOT in here: "dehydrated" is exactly
     * what makes "Carrot, dehydrated" (341 kcal) the wrong answer for
     * "carrot" (41).
     */
    private const NOISE = [
        'nfs' => 1, 'ns' => 1, 'raw' => 1, 'includes' => 1, 'usda' => 1,
        'commodity' => 1, 'all' => 1, 'types' => 1, 'varieties' => 1,
        'and' => 1, 'or' => 1, 'the' => 1, 'of' => 1, 'in' => 1, 'a' => 1,
        'an' => 1, 'with' => 1, 'without' => 1, 'added' => 1, 'unprepared' => 1,
    ];

    /**
     * Words marking a product made FROM a food rather than the food.
     *
     * Deliberately short, and deliberately without "bread" or "crackers":
     * those are foods a member legitimately asks for, and the headword rule
     * already handles "Bread, potato" for "potato". Everything here is a
     * processing word that almost never belongs in a bare food name.
     */
    private const DERIVED = [
        'flour', 'powder', 'substitute', 'peel', 'oil', 'juice', 'syrup',
        'extract', 'concentrate', 'dehydrated', 'dried', 'paste', 'puree',
        'jam', 'jelly', 'marmalade', 'candy', 'infant', 'formula', 'leavening',
        // A second group, all of them a different food built from the first:
        // "Chicken breast tenders, breaded", "Sweet potato leaves", "Fish,
        // tuna salad", "Oat bran", "Bacon, meatless", "Potato pancakes".
        'breaded', 'tender', 'nugget', 'leave', 'bran', 'salad', 'meatless',
        'pancake', 'sherbet', 'croissant',
    ];

    /**
     * British and colloquial names that FoodData Central does not index.
     *
     * The database is American. "Porridge" and "wholemeal" return nothing
     * sensible from the curated sets, so the search falls through to branded
     * products that merely contain the word — which is how "porridge" became a
     * 260 kcal loaf of bread. The AI path also asks the model for a plain US
     * name per item; this map covers the manual search box, which has no model
     * behind it, and acts as a backstop when the model does not supply one.
     *
     * Word-level and deliberately conservative: only terms with one unambiguous
     * US equivalent. "Chips" and "biscuit" are not here precisely because they
     * do not have one.
     */
    private const US_TERMS = [
        'wholemeal'  => 'whole wheat',
        // Not "oatmeal": without Survey (FNDDS) the only oatmeal entries in
        // the curated sets are oatmeal BREAD. The cooked cereal is filed under
        // oats, so that is what to ask for.
        'porridge'   => 'oats cooked',
        'aubergine'  => 'eggplant',
        'courgette'  => 'zucchini',
        'coriander'  => 'cilantro',
        'rocket'     => 'arugula',
        'prawn'      => 'shrimp',
        'prawns'     => 'shrimp',
        'beetroot'   => 'beets',
        'sultanas'   => 'raisins',
        'yoghurt'    => 'yogurt',
        'swede'      => 'rutabaga',
        'mangetout'  => 'snow peas',
    ];

    /**
     * The same query written the way the database spells it, or null.
     */
    private function usEquivalent(string $query): ?string
    {
        $words   = preg_split('/\s+/', mb_strtolower(trim($query))) ?: [];
        $changed = false;

        foreach ($words as $i => $w) {
            if (isset(self::US_TERMS[$w])) {
                $words[$i] = self::US_TERMS[$w];
                $changed   = true;
            }
        }

        return $changed ? implode(' ', $words) : null;
    }

    /**
     * What fraction of the first text's meaningful words appear in the second.
     *
     * Public so the review screen can be told when a match is doubtful: the
     * same tokenising that ranks the results decides whether the one on offer
     * actually resembles what the member said, and a second implementation in
     * the frontend would drift from this one.
     */
    public function overlap(string $query, string $candidate): float
    {
        $q = $this->tokens($query);
        $c = $this->tokens($candidate);

        if ($q === []) {
            return 0.0;
        }

        return count(array_intersect($q, $c)) / count($q);
    }

    /** @return list<string> */
    private function tokens(string $text): array
    {
        $text  = preg_replace('/[^a-z0-9\s]/', ' ', mb_strtolower($text)) ?? '';
        $words = [];

        foreach (preg_split('/\s+/', trim($text)) ?: [] as $w) {
            if ($w === '' || isset(self::NOISE[$w])) {
                continue;
            }
            $words[] = $this->singular($w);
        }

        return array_values(array_unique($words));
    }

    /**
     * Crude plural stripping, enough to make "bananas" meet "banana".
     *
     * Not a stemmer. A real one would also fold "toasted" onto "toast", which
     * is the opposite of what is wanted here — "Bread, egg, toasted" should
     * not look like a match for "toast".
     */
    private function singular(string $w): string
    {
        if (strlen($w) > 4 && str_ends_with($w, 'ies')) {
            return substr($w, 0, -3).'y';          // berries -> berry
        }
        if (strlen($w) > 4 && str_ends_with($w, 'oes')) {
            return substr($w, 0, -2);              // potatoes -> potato
        }
        /*
         * Only the -es that English actually adds after a sibilant. Stripping
         * two characters from every word ending in "es" turned "apples" into
         * "appl", so "apple" never met "Apples, raw, without skin" and the top
         * match for apple was a strudel. "Bananas" hid the bug: it ends in
         * "as", so it took the -s branch and worked.
         */
        if (strlen($w) > 4 && preg_match('/(ss|sh|ch|x|z)es$/', $w)) {
            return substr($w, 0, -2);              // dishes -> dish
        }
        if (strlen($w) > 3 && str_ends_with($w, 's') && ! str_ends_with($w, 'ss')) {
            return substr($w, 0, -1);              // apples -> apple
        }

        return $w;
    }

    /**
     * How well one candidate answers the query.
     *
     * Three things, in order of weight:
     *   - does it contain the words asked for (coverage),
     *   - does it contain words that were NOT asked for (extra), and
     *   - is it a curated generic food rather than a supermarket product.
     *
     * The generic bonus is smaller than full coverage on purpose: a branded
     * item that is exactly what was asked for still beats a generic entry for
     * a different food.
     *
     * @param  array<string,mixed>  $food
     */
    private function score(array $food, array $variantTokens): float
    {
        $cand = $this->tokens((string) $food['name']);

        if ($cand === []) {
            return 0.0;
        }

        $best = 0.0;

        /*
         * The best fit against ANY spelling we searched under.
         *
         * Results for "oatmeal" and results for "porridge" end up in one list,
         * and scoring the whole list against only the word the member typed
         * would give every oatmeal result a coverage of zero — throwing away
         * the very results the alternate spelling was fetched to find.
         */
        foreach ($variantTokens as $q) {
            if ($q === []) {
                continue;
            }

            $coverage = count(array_intersect($q, $cand)) / count($q);
            $extra    = count(array_diff($cand, $q));

            /*
             * FoodData Central names a food by its kind first and qualifies it
             * afterwards: "Oil, avocado", "Bread, potato", "Marmalade,
             * orange" — against "Avocados, raw, all commercial varieties".
             *
             * Counting extra words alone gets this exactly backwards. The
             * wrong answers are SHORTER, because "oil" and "bread" are tidy,
             * while the right answer carries three words of varietal detail.
             * What actually separates them is which word comes first: that is
             * the food, and everything after it is description. So a candidate
             * whose leading word is one the member asked for is rewarded,
             * rather than candidates with trailing words being punished hard.
             *
             * A bonus and not a penalty, because a compound query often has no
             * headword of its own — "wholemeal toast" is correctly answered by
             * "Bread, whole-wheat", and penalising "bread" there would reject
             * the right food.
             */
            $head = $cand[0] ?? '';

            /*
             * Things MADE FROM the food, which share its name and its leading
             * word: "Potato flour", "Tomato powder", "Orange peel", "Egg
             * substitute, powder". The headword rule above cannot separate
             * these — the head really is the food — and counting extra words
             * ranks them ABOVE the real entry, because "Potato flour" is
             * tidier than "Potatoes, russet, flesh and skin, raw".
             *
             * Only counted when the member did not ask for them, so "dried
             * apricot" and "orange juice" still find what they say.
             */
            $derived = count(array_diff(array_intersect($cand, self::DERIVED), $q));

            $best = max($best, 2.5 * $coverage
                - 0.35 * min($extra, 6)
                - 1.6 * min($derived, 2)
                + (in_array($head, $q, true) ? 1.5 : 0.0));
        }

        return $best + (($food['kind'] ?? 'brand') === 'generic' ? 1.2 : 0.0);
    }

    /**
     * Best first. Ties keep FoodData Central's own order, which is relevance.
     *
     * @param  list<array<string,mixed>>  $foods
     * @param  list<string>               $variants
     * @return list<array<string,mixed>>
     */
    private function rank(array $foods, array $variants): array
    {
        $tokenised = array_map(fn (string $v) => $this->tokens($v), $variants);

        $scored = [];
        foreach ($foods as $i => $food) {
            $scored[] = ['i' => $i, 'food' => $food, 'score' => $this->score($food, $tokenised)];
        }

        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score'] ?: $a['i'] <=> $b['i']);

        return array_map(
            fn ($s) => $s['food'] + ['match_score' => round($s['score'], 3)],
            $scored,
        );
    }

    /**
     * Is the best of these good enough to stop looking?
     *
     * Half the words of at least one spelling we searched under have to
     * appear. Below that we are looking at a food that merely shares a word,
     * and a supermarket product that genuinely contains the thing asked for is
     * more use than a curated entry for something else.
     *
     * @param  list<array<string,mixed>>  $ranked
     * @param  list<string>               $variants
     */
    private function goodEnough(array $ranked, array $variants): bool
    {
        $top = $ranked[0] ?? null;

        if ($top === null) {
            return false;
        }

        $cand = $this->tokens((string) $top['name']);

        foreach ($variants as $v) {
            $q = $this->tokens($v);

            if ($q !== [] && count(array_intersect($q, $cand)) / count($q) >= 0.5) {
                return true;
            }
        }

        return false;
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
        /*
         * One retry, because this API returns spurious nginx 400s.
         *
         * Measured while building the ranking: identical repeated requests
         * alternate between 200 and 400 for no reason visible from here. A
         * failed search is SILENT — it yields no results rather than an error
         * — so one unlucky request made the curated pass look empty and
         * dropped the lookup through to branded products, which is exactly
         * the behaviour the ranking exists to prevent. "Banana" came back as
         * a 312 kcal packet roughly one run in three until this was added.
         *
         * A 429 is never retried: that is the rate limit asking us to stop.
         */
        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $isLast = $attempt === 2;
            $out    = $this->attempt($path, $query, $isLast);

            if ($out !== null || $this->unavailable) {
                return $out;
            }

            if (! $isLast) {
                usleep(250_000);
            }
        }

        return null;
    }

    /**
     * @param  bool  $isLast  Only the final attempt may declare the service
     *                        unavailable or write a log line. A first attempt
     *                        that times out is common enough here to be worth
     *                        another go rather than a warning.
     */
    private function attempt(string $path, array $query, bool $isLast): ?array
    {
        try {
            // 8s, not 12s: two attempts have to fit inside the same budget the
            // caller had for one. The API answers in well under a second when
            // it answers at all.
            $res = Http::timeout(8)
                ->get(self::BASE.$path, $query + ['api_key' => $this->apiKey()]);

            if ($res->status() === 429) {
                $this->unavailable = true;
                Log::warning('USDA FoodData Central rate limit reached', ['path' => $path]);

                return null;
            }

            if (! $res->successful()) {
                // A 5xx is the provider failing, not the food missing, and is
                // not worth a retry. A 4xx other than 429 is usually one of
                // their spurious 400s, so it falls through to the second
                // attempt and is only logged if that fails too.
                if ($res->serverError() && $isLast) {
                    $this->unavailable = true;
                }

                if ($isLast) {
                    Log::warning('USDA FoodData Central request failed', [
                        'path' => $path, 'status' => $res->status(),
                    ]);
                }

                return null;
            }

            return $res->json();
        } catch (\Throwable $e) {
            // Timeout, DNS, TLS, connection reset — we never got an answer.
            // Retried once before it counts, because this API times out often
            // enough that a single slow request is not evidence it is down.
            if ($isLast) {
                $this->unavailable = true;
                Log::warning('USDA FoodData Central unreachable', ['error' => $e->getMessage()]);
            }

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
            /*
             * Which half of the database this came from, surfaced so the
             * review screen can say so. A member choosing between "Bananas,
             * raw" and a branded banana product deserves to know which is
             * which — the names alone do not always make it obvious.
             */
            'kind'                 => ($f['dataType'] ?? '') === 'Branded' ? 'brand' : 'generic',
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
