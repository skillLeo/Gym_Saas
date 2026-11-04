<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

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

    /*
     * How long one request may take, first try and retry.
     *
     * A lookup that cannot succeed has to give up quickly, because the member
     * is watching and the review row now offers them a retry and a manual
     * search instead. Under a healthy API neither of these comes near: a
     * search answers in well under a second.
     *
     * The two differ on purpose. The retry exists for this API's spurious
     * nginx 400s, which fail instantly — so a long budget on the second try
     * only lengthens the hopeless case. The first keeps enough room to ride
     * out a slow-but-working service; the second is short because a request
     * that has already timed out once is not usually rescued by waiting
     * longer.
     *
     *     6s + 0.25s pause + 2s  =  a failing lookup surfaces in about 8s
     */
    private const TIMEOUT_FIRST = 6;
    private const TIMEOUT_RETRY = 2;

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
    /**
     * @param  string|null  $preparation  raw|cooked|boiled|fried|baked|grilled,
     *                                    when the caller knows. The manual
     *                                    search box does not and passes null,
     *                                    which disables the rule entirely.
     */
    public function search(string $query, int $limit = 25, ?string $alternate = null, ?string $preparation = null): array
    {
        $this->unavailable = false;
        $this->preparation = $this->normalisePreparation($preparation);

        try {
            return $this->searchRaw($query, $limit, $alternate);
        } finally {
            $this->preparation = null;
        }
    }

    /** Anything we have no rule for, including "unknown", means no preference. */
    private function normalisePreparation(?string $preparation): ?string
    {
        $key = mb_strtolower(trim((string) $preparation));

        return isset(self::PREPARATION_WORDS[$key]) ? $key : null;
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
        $key = $this->cacheKey($query, $limit, $alternate);

        if (($hit = Cache::get($key)) !== null) {
            return $hit;
        }

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
        $variants = $this->variantsFor($query, $alternate);
        $second   = $variants[1] ?? null;

        /*
         * 1. THE LOCAL TABLES FIRST — no network at all.
         *
         * These hold USDA's two curated datasets, which is where the answer to
         * an ordinary food word lives. Before this, every "banana" cost a
         * request to a service that was timing out half the time; now it costs
         * an index lookup, and the live API is left for the things only it can
         * answer.
         */
        $found  = $this->localSearch($variants);
        $ranked = $this->rank($found, $variants);

        if ($this->goodEnough($ranked, $variants)) {
            return $this->remember($key, $ranked, $limit);
        }

        // Nothing local answered. Without a key there is nowhere else to look,
        // and whatever weak local candidates exist are better than nothing.
        if (! $this->configured()) {
            return $this->remember($key, $ranked, $limit);
        }

        /*
         * 2. The curated sets over the API, but ONLY where there is no local
         *    copy to consult. With the tables imported this is dead weight:
         *    it would ask the network for the same datasets already on disk.
         */
        if (! $this->localReady()) {
            $found = array_merge($found, $this->fetch($query, self::GENERIC_TYPES));

            if (filled($second) && ! $this->unavailable && mb_strtolower((string) $second) !== mb_strtolower($query)) {
                $found = array_merge($found, $this->fetch((string) $second, self::GENERIC_TYPES));
            }

            $ranked = $this->rank($found, $variants);
        }

        /*
         * 3. Branded, which is never held locally — it is two million
         *    supermarket products and changes constantly.
         *
         * Once the service has said it is unavailable no further passes are
         * fired: a lookup that has already timed out twice must not spend
         * another full timeout here before giving up.
         */
        if (! $this->unavailable && ! $this->goodEnough($ranked, $variants)) {
            $found  = array_merge($found, $this->fetch($query, self::BRANDED_TYPES));
            $ranked = $this->rank($found, $variants);
        }

        return $this->remember($key, $ranked, $limit);
    }

    // ------------------------------------------------------- the local copy

    /**
     * Every spelling a query should be searched under, the original first.
     *
     * BOTH the caller's alternate and the configured alias, not one or the
     * other. The AI path supplies the model's plain US name, and preferring it
     * threw the curated list away: the model offered "oatmeal" for porridge,
     * which finds oatmeal BREAD, while config/food_aliases.php knows to ask
     * for the cooked cereal. Searching both and letting rank() choose costs
     * one local query and cannot do worse than either alone.
     *
     * @return list<string>
     */
    private function variantsFor(string $query, ?string $alternate): array
    {
        $variants = [$query];

        foreach ([$alternate, $this->usEquivalent($query)] as $candidate) {
            if (! filled($candidate)) {
                continue;
            }

            $seen = array_map('mb_strtolower', $variants);

            if (! in_array(mb_strtolower((string) $candidate), $seen, true)) {
                $variants[] = (string) $candidate;
            }
        }

        return $variants;
    }

    /**
     * The preparation the current lookup was told about, or null.
     *
     * Held on the instance rather than threaded through rank() and score()
     * because it belongs to the whole lookup, not to any one candidate, and
     * every caller that does not know it leaves it null — which is the manual
     * search box, deliberately unchanged.
     */
    private ?string $preparation = null;

    /**
     * Per-label preparations for the current pooled lookup.
     *
     * searchMany() handles many labels at once and one plate can hold raw
     * salad beside grilled meat, so the preparation has to be switched per
     * query rather than held for the batch.
     *
     * @var array<string,string>
     */
    private array $preparationByQuery = [];

    /** Point the preparation rules at one label of a pooled lookup. */
    private function usePreparationFor(string $query): void
    {
        $this->preparation = $this->preparationByQuery[$query] ?? null;
    }

    /**
     * How well a candidate's description matches the stated preparation.
     *
     * Rewards agreement and punishes contradiction, because both carry
     * information: "Chicken, breast, raw" is a bad answer for grilled chicken
     * in a way that "Chicken, breast" is merely a neutral one. The penalty is
     * smaller than the headword bonus, so it tips a close decision rather than
     * overriding which food this is.
     */
    private function preparationScore(string $description): float
    {
        if ($this->preparation === null || ! isset(self::PREPARATION_WORDS[$this->preparation])) {
            return 0.0;
        }

        /*
         * NOT tokens(): "raw" is a noise word there, stripped precisely so it
         * neither earns nor costs anything when matching a food's identity.
         * Here it is the whole point, so the description is split plainly.
         */
        $words = preg_split('/[^a-z]+/', mb_strtolower($description)) ?: [];

        foreach (self::PREPARATION_WORDS[$this->preparation] as $wanted) {
            if (in_array($wanted, $words, true)) {
                return 1.2;
            }
        }

        // Contradiction: raw asked for and the entry is cooked, or the reverse.
        $opposite = $this->preparation === 'raw'
            ? self::PREPARATION_WORDS['cooked']
            : self::PREPARATION_WORDS['raw'];

        foreach ($opposite as $clashing) {
            if (in_array($clashing, $words, true)) {
                return -1.2;
            }
        }

        return 0.0;
    }

    /** Does this description agree with the stated preparation? */
    private function matchesPreparation(string $description): bool
    {
        return $this->preparationScore($description) >= 0.0;
    }

    /** Set once per instance; the answer cannot change mid-request. */
    private ?bool $localReady = null;

    /**
     * Is there a local copy of the curated datasets to search?
     *
     * False on a fresh install that has never run `foods:import-usda`, and in
     * the tests that exercise the API path. Everything still works then — it
     * just goes over the network, exactly as it did before.
     */
    private function localReady(): bool
    {
        if ($this->localReady !== null) {
            return $this->localReady;
        }

        try {
            $this->localReady = Schema::hasTable('usda_foods')
                && DB::table('usda_foods')->limit(1)->exists();
        } catch (\Throwable) {
            // No database, or mid-migration. Not a reason to fail a lookup.
            $this->localReady = false;
        }

        return $this->localReady;
    }

    /**
     * Candidates from the local tables, in the shape the ranking expects.
     *
     * Deliberately generous: it returns far more than the caller asked for and
     * lets rank() choose, because the whole point of the ranking work was that
     * the database's own idea of relevance is not ours.
     *
     * @param  list<string>  $variants
     * @return list<array<string,mixed>>
     */
    private function localSearch(array $variants, int $perVariant = 300): array
    {
        if (! $this->localReady()) {
            return [];
        }

        $byId = [];

        foreach ($variants as $variant) {
            foreach ($this->localRows($variant, $perVariant) as $row) {
                $byId[(int) $row->fdc_id] = $this->mapLocal($row);
            }
        }

        /*
         * The food this word actually means, when we have said so.
         *
         * Ranking by name gets most foods right and a few stubbornly wrong:
         * "potato" found potato SKIN, "bacon" found TURKEY bacon, "salmon"
         * found canned sockeye. Each is a real USDA food whose name answers
         * the query perfectly, and no scoring rule separates them from the one
         * a person means without knowing which that is. config/food_preferred.php
         * says which. It is fetched even when the ordinary search missed it,
         * and marked so score() can put it first.
         */
        $preferred = $this->preferredFor($variants);

        if ($preferred !== null) {
            $row = DB::table('usda_foods')
                ->where('fdc_id', $preferred)
                ->whereNotNull('calories')
                ->first(['fdc_id', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg']);

            if ($row !== null) {
                $food = $this->mapLocal($row);

                /*
                 * The named food is the default for a bare word, but a stated
                 * preparation is more specific information and outranks it.
                 * "Chicken breast" defaults to the roasted entry; if the model
                 * says the chicken was raw, that default is wrong, so the food
                 * stays as an ordinary candidate instead of being forced.
                 */
                if ($this->matchesPreparation((string) $row->description)) {
                    $food['preferred'] = true;
                }

                $byId[(int) $row->fdc_id] = $food;
            }
        }

        return array_values($byId);
    }

    /**
     * The configured fdc_id for one of these spellings, if there is one.
     *
     * Matched on the whole query, not word by word, so it fires on "chicken
     * breast" but not on "grilled chicken breast with rice" — a longer phrase
     * carries detail the list cannot know about and belongs to the ranking.
     *
     * @param  list<string>  $variants
     */
    private function preferredFor(array $variants): ?int
    {
        /** @var array<string,int> $preferred */
        $preferred = config('food_preferred', []);

        if ($preferred === []) {
            return null;
        }

        foreach ($variants as $variant) {
            $key = preg_replace('/\s+/', ' ', trim(mb_strtolower($variant)));

            if (isset($preferred[$key])) {
                return (int) $preferred[$key];
            }
        }

        return null;
    }

    /**
     * One local query, by FULLTEXT where there is one and LIKE where there is not.
     *
     * The LIKE path is not only a sqlite fallback: InnoDB's FULLTEXT ignores
     * tokens shorter than `innodb_ft_min_token_size` (three by default), so
     * "egg" and "ham" would silently match nothing. Short words go to LIKE on
     * MySQL too.
     *
     * @return list<object>
     */
    private function localRows(string $query, int $limit): array
    {
        $tokens = $this->tokens($query);

        if ($tokens === []) {
            return [];
        }

        $base = DB::table('usda_foods')
            ->select('fdc_id', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg')
            // Search never offers a food it cannot put a calorie figure on —
            // the same rule the API path applies to its own results.
            ->whereNotNull('calories')
            ->limit($limit);

        /*
         * Each word kept BOTH as typed and singularised, because neither form
         * matches the other reliably.
         *
         * "banana*" reaches "Bananas, raw", so singularising helps there. But
         * "strawberries" singularises to "strawberry", and neither
         * "strawberry*" nor "%strawberry%" matches "Strawberries" — which is
         * why a search for strawberries returned guavas and never saw the
         * strawberry at all. Likewise "fries" becomes "fry", and "%fry%" does
         * not match "French fries".
         *
         * @var list<list<string>> one pair per word of the query
         */
        $pairs = [];
        foreach (preg_split('/[^a-z0-9]+/', mb_strtolower($query)) ?: [] as $word) {
            if ($word === '' || isset(self::NOISE[$word])) {
                continue;
            }

            $pairs[] = array_values(array_unique([$word, $this->singular($word)]));
        }

        if ($pairs === []) {
            return [];
        }

        $flat     = array_merge(...$pairs);
        $shortest = min(array_map('strlen', $flat));

        if (DB::connection()->getDriverName() === 'mysql' && $shortest >= 3) {
            // Prefix-matched. Not AND-ed: requiring every word would lose
            // "Bread, whole-wheat" for "whole wheat toast", and rank() is
            // what decides which candidate wins anyway.
            $against = implode(' ', array_map(static fn ($t) => $t.'*', $flat));

            return $base
                ->whereRaw('MATCH(description) AGAINST(? IN BOOLEAN MODE)', [$against])
                ->orderByRaw('MATCH(description) AGAINST(? IN BOOLEAN MODE) DESC', [$against])
                ->get()
                ->all();
        }

        // Every word must appear in one of its forms.
        foreach ($pairs as $forms) {
            $base->where(function ($q) use ($forms) {
                foreach ($forms as $form) {
                    $q->orWhere('description', 'like', '%'.$form.'%');
                }
            });
        }

        return $base->get()->all();
    }

    /**
     * A local row in the same shape mapFood() produces for an API result.
     *
     * `kind` is always generic: both imported datasets are USDA's curated
     * foods. `source` stays 'usda' and the id stays FoodData Central's own, so
     * a food found here and the same food found over the API resolve to one
     * food_items row.
     *
     * @return array<string,mixed>
     */
    private function mapLocal(object $row): array
    {
        return [
            'external_food_id'     => (string) $row->fdc_id,
            'source'               => 'usda',
            'kind'                 => 'generic',
            'name'                 => (string) $row->description,
            'brand'                => null,
            'serving_qty'          => 100,
            'serving_unit'         => 'g',
            'serving_weight_grams' => 100,
            'calories'             => $row->calories === null ? null : (float) $row->calories,
            'protein_g'            => (float) ($row->protein_g ?? 0),
            'carbs_g'              => (float) ($row->carbs_g ?? 0),
            'fat_g'                => (float) ($row->fat_g ?? 0),
            'fiber_g'              => (float) ($row->fiber_g ?? 0),
            'sugar_g'              => (float) ($row->sugar_g ?? 0),
            'sodium_mg'            => (float) ($row->sodium_mg ?? 0),
        ];
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
    /**
     * @param  array<string,string>  $preparations  label => raw|cooked|…, when
     *                                              the caller knows. Per label,
     *                                              because one plate can hold
     *                                              raw salad and grilled meat.
     */
    public function searchMany(array $queries, int $limit = 3, array $alternates = [], array $preparations = []): array
    {
        $this->unavailable = false;

        $this->preparationByQuery = [];
        foreach ($preparations as $label => $preparation) {
            $normalised = $this->normalisePreparation($preparation);

            if ($normalised !== null) {
                $this->preparationByQuery[(string) $label] = $normalised;
            }
        }

        $queries = array_values(array_unique(array_filter($queries, 'filled')));
        $results = [];
        $found   = [];   // query => candidates gathered so far
        $variant = [];   // query => spellings searched under

        foreach ($queries as $query) {
            $this->usePreparationFor($query);
            $hit = Cache::get($this->cacheKey($query, $limit, $alternates[$query] ?? null));

            if ($hit !== null) {
                $results[$query] = $hit;
            } else {
                $found[$query]   = [];
                $variant[$query] = [$query];
            }
        }

        /*
         * THE LOCAL TABLES FIRST, for every label at once and with no network.
         *
         * A plate of food yields six or more labels, and before this each one
         * was a request to a service that was timing out half the time. Most
         * of them are ordinary foods that the curated datasets on disk answer
         * outright, so the pooled rounds below usually have nothing left to
         * do. Without a key this is the only step there is — which is the
         * point: the food journal keeps working when FoodData Central does not.
         */
        foreach ($found as $query => $_) {
            $query           = (string) $query;
            $this->usePreparationFor($query);
            $variant[$query] = $this->variantsFor($query, $alternates[$query] ?? null);
            $found[$query]   = $this->localSearch($variant[$query]);
        }

        foreach ($this->answered($found, $variant) as $query) {
            $this->usePreparationFor($query);
            $results[$query] = $this->remember(
                $this->cacheKey($query, $limit, $alternates[$query] ?? null),
                $this->rank($found[$query], $variant[$query]),
                $limit,
            );
            unset($found[$query]);
        }

        // Everything the local copy settled is done; only the rest goes out.
        if ($found === [] || ! $this->configured()) {
            foreach ($found as $query => $candidates) {
                $this->usePreparationFor((string) $query);
                $results[$query] = $this->remember(
                    $this->cacheKey($query, $limit, $alternates[$query] ?? null),
                    $this->rank($candidates, $variant[$query]),
                    $limit,
                );
            }

            return $this->reKey($queries, $results);
        }

        /*
         * What is left goes over the network, in pooled rounds over a steadily
         * smaller set.
         *
         * The curated rounds run only where there is NO local copy to consult,
         * because with the tables imported they would be asking the network
         * for datasets already on disk. With a local copy the only thing the
         * API still has that we do not is Branded.
         */
        if (! $this->localReady()) {
            $this->poolFetch($found, array_fill_keys(array_keys($found), null), self::GENERIC_TYPES);

            $second = [];
            foreach (array_keys($found) as $q) {
                $q = (string) $q;

                // The variants were already decided above; the second one, if
                // there is one, is the US spelling to search under.
                if (isset($variant[$q][1])) {
                    $second[$q] = $variant[$q][1];
                }
            }

            /*
             * Once the service has told us it is unavailable — a rate limit,
             * or repeated failures — no further rounds are fired. Carrying on
             * would mean answering a 429 by making more requests, and the
             * later rounds would be scored as though the first had simply
             * found nothing.
             */
            if ($second !== [] && ! $this->unavailable) {
                $this->poolFetch($found, $second, self::GENERIC_TYPES);
            }
        }

        $stillUnanswered = $this->unavailable ? [] : $this->unanswered($found, $variant);

        if ($stillUnanswered !== []) {
            $this->poolFetch($found, array_fill_keys($stillUnanswered, null), self::BRANDED_TYPES);
        }

        foreach ($found as $query => $candidates) {
            $this->usePreparationFor((string) $query);
            $results[$query] = $this->remember(
                $this->cacheKey($query, $limit, $alternates[$query] ?? null),
                $this->rank($candidates, $variant[$query]),
                $limit,
            );
        }

        return $this->reKey($queries, $results);
    }

    /**
     * Which queries already have a candidate worth showing.
     *
     * @param  array<string,list<array<string,mixed>>>  $found
     * @param  array<string,list<string>>               $variant
     * @return list<string>
     */
    private function answered(array $found, array $variant): array
    {
        $unanswered = $this->unanswered($found, $variant);

        return array_values(array_diff(array_map('strval', array_keys($found)), $unanswered));
    }

    /**
     * Re-key in the caller's order, including duplicates they may have sent.
     *
     * @param  list<string>                             $queries
     * @param  array<string,list<array<string,mixed>>>  $results
     * @return array<string,list<array<string,mixed>>>
     */
    private function reKey(array $queries, array $results): array
    {
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
            $this->usePreparationFor((string) $query);

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
                    ->timeout(self::TIMEOUT_FIRST)
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
                    ->timeout(self::TIMEOUT_RETRY)
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
    public function forgetSearch(string $query, int $limit = 25, ?string $alternate = null, ?string $preparation = null): void
    {
        /*
         * The preparation has to be passed, because it is part of the key.
         * Forgetting "chicken breast" with none set does not forget "chicken
         * breast, cooked" — which cost an hour of chasing a stale answer that
         * looked like a scoring bug.
         */
        $previous          = $this->preparation;
        $this->preparation = $this->normalisePreparation($preparation);

        try {
            Cache::forget($this->cacheKey($query, $limit, $alternate));
        } finally {
            $this->preparation = $previous;
        }
    }

    /**
     * The alternate spelling is part of the key, because it changes the
     * answer: "porridge" alone and "porridge" with "oatmeal" to fall back on
     * are two different lookups and must not share a cache entry.
     */
    private function cacheKey(string $query, int $limit, ?string $alternate = null): string
    {
        $norm = static fn (string $s) => preg_replace('/\s+/', ' ', trim(mb_strtolower($s)));

        // The preparation is part of the question: "chicken breast" raw and
        // "chicken breast" grilled are two different lookups with two
        // different right answers, and must not share a cache entry.
        return 'usda_search_'.md5(
            $norm($query).'|'.$limit.'|'
            .(filled($alternate) ? $norm((string) $alternate) : '').'|'
            .($this->preparation ?? '')
        );
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
     * What each preparation looks like in a USDA description.
     *
     * The difference is large and systematic — raw chicken breast is 120
     * kcal/100 g against 165 roasted, dry pasta 371 against 157 cooked — so a
     * food identified perfectly can still be 40% wrong if the wrong entry is
     * picked. USDA writes the state into the description, which makes it
     * something the ranking can act on.
     *
     * "Cooked" is broad on purpose: a member who says their chicken was
     * cooked has not said how, and roasted, broiled or boiled all beat raw.
     *
     * @var array<string, list<string>>
     */
    private const PREPARATION_WORDS = [
        /*
         * "dry" is deliberately absent, though dry pasta really is the raw
         * form. It appears in far more names than it ought to: rewarding it
         * made "Egg custards, dry mix" the answer for raw egg and "Rice
         * noodles, dry" the answer for raw rice. The foods where dry is the
         * right reading — pasta, rice, oats — are better served by the
         * preferred list, which names them outright.
         */
        'raw'     => ['raw', 'uncooked'],
        'cooked'  => ['cooked', 'boiled', 'roasted', 'broiled', 'baked', 'grilled', 'prepared', 'toasted'],
        'boiled'  => ['boiled', 'cooked'],
        'fried'   => ['fried'],
        'baked'   => ['baked', 'roasted', 'cooked'],
        'grilled' => ['grilled', 'broiled', 'roasted', 'cooked'],
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
        // Same rule again, found once the local datasets were searchable:
        // "Oat milk" for oats and "Sweet Potato puffs" for sweet potato.
        //
        // "skin" was tried here too, for "Potatoes, raw, skin", and taken out
        // again: USDA also writes "Apples, raw, WITHOUT skin", where the word
        // marks a qualifier rather than a product made from the food, and
        // penalising it pushed the right apple below a tin of sweetened
        // apple slices. One word, two meanings, so it stays out.
        'milk', 'puff',
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
     * The vocabulary itself lives in config/food_aliases.php, not here: it is
     * a word list rather than logic, it needs editing far more often than this
     * class does, and whoever wants to add "gammon" should not have to read a
     * service to do it. Each alias is an EXTRA search, never a replacement, so
     * even an ambiguous one such as chips/fries cannot hide what was asked for.
     */
    private function usEquivalent(string $query): ?string
    {
        /** @var array<string,string> $aliases */
        $aliases = config('food_aliases', []);

        $words   = preg_split('/\s+/', mb_strtolower(trim($query))) ?: [];
        $changed = false;

        foreach ($words as $i => $w) {
            if (isset($aliases[$w])) {
                $words[$i] = $aliases[$w];
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

        /*
         * A food named in config/food_preferred.php wins outright. The bonus
         * is larger than any combination of the rules above can reach, which
         * is the point: the list exists for the cases where name-matching is
         * not the right instrument, so it must not be argued with by it.
         */
        return $best
            + (($food['kind'] ?? 'brand') === 'generic' ? 1.2 : 0.0)
            + (($food['preferred'] ?? false) ? 100.0 : 0.0)
            + $this->preparationScore((string) $food['name']);
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

        /*
         * Ties are broken on the food's own id, not on the order it arrived in.
         *
         * Equal scores are common and not a flaw — "Tofu, fried" and "Tofu
         * yogurt" answer "tofu" exactly as well as each other by every rule
         * here. What WAS a flaw is that the winner then depended on whatever
         * order the database happened to return, so the same query could give
         * different answers on consecutive runs and a change in the candidate
         * limit silently reshuffled results that had nothing to do with it.
         *
         * The id is arbitrary but stable, and mildly useful: SR Legacy's
         * long-established foods carry lower ids than later additions.
         */
        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']
            ?: ((int) ($a['food']['external_food_id'] ?? PHP_INT_MAX) <=> (int) ($b['food']['external_food_id'] ?? PHP_INT_MAX))
            ?: $a['i'] <=> $b['i']);

        return $this->collapseDuplicates(array_map(
            fn ($s) => $s['food'] + ['match_score' => round($s['score'], 3)],
            $scored,
        ));
    }

    /**
     * One row per food, when two datasets hold the same one.
     *
     * Foundation and SR Legacy overlap: both carry "Bananas, overripe, raw"
     * and "Bread, whole-wheat, commercially prepared" under different ids, and
     * USDA appends "(Includes foods for USDA's Food Distribution Program)" to
     * some names, which makes a third spelling of the same thing. The member
     * saw the same food listed two or three times in the picker with no way to
     * tell the entries apart.
     *
     * The survivor is the one with the most complete nutrition rather than the
     * highest score. They are the same food by definition here, so the figures
     * are what differ, and a row with sugar and fibre filled in is strictly
     * more use than one without. Order is otherwise untouched, so the best
     * match stays first.
     *
     * @param  list<array<string,mixed>>  $ranked
     * @return list<array<string,mixed>>
     */
    private function collapseDuplicates(array $ranked): array
    {
        $bestFor = [];

        foreach ($ranked as $i => $food) {
            $key = $this->duplicateKey((string) $food['name']);

            if (! isset($bestFor[$key])) {
                $bestFor[$key] = ['at' => $i, 'food' => $food, 'filled' => $this->nutrientsPresent($food)];

                continue;
            }

            if ($this->nutrientsPresent($food) > $bestFor[$key]['filled']) {
                // Keep the earlier position — that is the better match — but
                // take the fuller row's figures.
                $bestFor[$key]['food']   = $food;
                $bestFor[$key]['filled'] = $this->nutrientsPresent($food);
            }
        }

        usort($bestFor, fn ($a, $b) => $a['at'] <=> $b['at']);

        return array_map(static fn ($e) => $e['food'], array_values($bestFor));
    }

    /**
     * What makes two rows "the same food".
     *
     * Punctuation and case go, and so does any trailing parenthesis: USDA's
     * "(Includes foods for USDA's Food Distribution Program)" is a provenance
     * note, not a different food.
     */
    private function duplicateKey(string $description): string
    {
        $name = preg_replace('/\s*\([^)]*\)\s*$/', '', trim($description)) ?? $description;
        $name = preg_replace('/[^a-z0-9]+/', ' ', mb_strtolower($name)) ?? $name;

        return trim((string) $name);
    }

    /** How many of the seven figures this row actually carries. */
    private function nutrientsPresent(array $food): int
    {
        $present = 0;

        foreach (['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'] as $key) {
            if (($food[$key] ?? null) !== null && (float) $food[$key] !== 0.0) {
                $present++;
            }
        }

        return $present;
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
            $out    = $this->attempt($path, $query, $isLast, $isLast ? self::TIMEOUT_RETRY : self::TIMEOUT_FIRST);

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
    private function attempt(string $path, array $query, bool $isLast, int $timeout): ?array
    {
        try {
            $res = Http::timeout($timeout)
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
