<?php

namespace App\Console\Commands;

use App\Services\UsdaFoodData;
use Illuminate\Console\Command;

/**
 * How often does the top USDA match for a plain food name carry sane numbers?
 *
 * The AI food logger drafts ordinary words — "banana", "porridge", "wholemeal
 * toast" — and then looks each one up. FoodData Central ranks by text
 * relevance across a database where branded supermarket products outnumber the
 * curated generic foods by orders of magnitude, so a plain word very often
 * lands on a packet of something. "Banana" returned a 312 kcal/100 g branded
 * item when raw banana is 89.
 *
 * Wrong numbers are the one thing this feature must not produce quietly, so
 * the matching needed changing — and changing it needed a measurement that is
 * not just the three examples that prompted it. Hence this: 35 foods a member
 * might actually type, each with a calorie band wide enough to accept any
 * reasonable interpretation of the name (raw or cooked, with or without skin)
 * and narrow enough to catch a result that is a different food altogether.
 *
 * READ-ONLY. It writes nothing, and it is a diagnostic rather than a test: it
 * calls the live FoodData Central API, so it needs a key and a network and
 * belongs on a developer's machine, not in CI.
 *
 *   php artisan foods:match-report
 *   php artisan foods:match-report --fresh      # ignore the 24h search cache
 *   php artisan foods:match-report --json
 */
class ReportFoodMatchQuality extends Command
{
    protected $signature = 'foods:match-report
        {--fresh : Drop the cached search for each term first}
        {--json  : Machine-readable output}';

    protected $description = 'Check the top USDA match for 35 common foods against expected calorie ranges.';

    /**
     * Food name => [min kcal/100 g, max kcal/100 g, note].
     *
     * The bands are deliberately generous. "Chicken breast" could reasonably be
     * raw (120) or roasted (165); "rice" could be dry (365) or cooked (130), so
     * where a word is that ambiguous the band spans both readings or the term
     * says which it means. A failure here should mean "that is not the food you
     * asked for", not "that is the same food prepared differently".
     *
     * @var array<string, array{0: float, 1: float, 2: string}>
     */
    private const EXPECTED = [
        // The three that prompted this work.
        'banana'            => [75,  110, 'raw 89'],
        'porridge'          => [50,  120, 'cooked oatmeal ~71'],
        'wholemeal toast'   => [220, 300, 'whole-wheat bread ~247'],

        // Fruit
        'apple'             => [40,   65, 'raw 52'],
        'orange'            => [35,   60, 'raw 47'],
        'strawberries'      => [25,   45, 'raw 32'],
        'avocado'           => [140, 190, 'raw 160'],
        'grapes'            => [55,   85, 'raw 69'],

        // Vegetables
        'broccoli'          => [20,   55, 'raw 34'],
        'carrot'            => [30,   55, 'raw 41'],
        'spinach'           => [15,   35, 'raw 23'],
        'tomato'            => [12,   30, 'raw 18'],
        'potato'            => [65,  100, 'raw 77'],
        'sweet potato'      => [70,  115, 'raw 86'],

        // Protein
        'chicken breast'    => [100, 180, 'raw 120 / roasted 165'],
        'salmon'            => [140, 230, 'raw 208'],
        'tuna'              => [95,  150, 'canned in water 116'],
        'ground beef'       => [180, 290, '80/20 raw 254'],
        'bacon'             => [380, 560, 'cooked 541'],
        'egg'               => [130, 165, 'whole raw 143'],
        'tofu'              => [60,  150, 'firm ~144'],

        // Dairy
        'whole milk'        => [50,   75, '61'],
        'cheddar cheese'    => [360, 430, '403'],
        'greek yogurt'      => [50,  110, 'plain lowfat 73'],
        'butter'            => [680, 760, '717'],

        // Grains and starches
        'white rice'        => [100, 380, 'cooked 130 / dry 365'],
        'pasta'             => [110, 380, 'cooked 131 / dry 371'],
        'oats'              => [350, 400, 'dry 389'],
        'quinoa'            => [100, 380, 'cooked 120 / dry 368'],
        'white bread'       => [230, 300, '266'],

        // Legumes
        'lentils'           => [90,  360, 'cooked 116 / dry 352'],
        'chickpeas'         => [110, 380, 'canned 164 / dry 364'],
        'black beans'       => [110, 350, 'cooked 132 / dry 341'],

        // Fats, sugars, drinks
        'olive oil'         => [820, 920, '884'],
        'peanut butter'     => [540, 640, '588'],
        'honey'             => [280, 330, '304'],
        'orange juice'      => [35,   60, '45'],
    ];

    public function handle(UsdaFoodData $usda): int
    {
        if (! $usda->configured()) {
            $this->error('No USDA key configured. Set USDA_API_KEY and run config:clear.');

            return self::FAILURE;
        }

        $rows  = [];
        $pass  = 0;
        $flaky = [];

        foreach (self::EXPECTED as $term => [$min, $max, $note]) {
            /*
             * method_exists, so this command can also be pointed at the
             * version of the service from before the ranking work — that is
             * how the "before" column of the comparison was produced, with
             * identical retry handling on both sides. The older service has no
             * forgetSearch(); `php artisan cache:clear` stands in for it.
             */
            if ($this->option('fresh') && method_exists($usda, 'forgetSearch')) {
                $usda->forgetSearch($term, 3);
            }

            /*
             * Retried until the API actually answers.
             *
             * FoodData Central is unreliable enough that a single pass over
             * these 37 terms scored anywhere between 57% and 81% depending on
             * how many requests happened to time out or return one of its
             * spurious 400s — and a failed lookup silently falls through to
             * branded products, which looks exactly like a ranking failure.
             * What is being measured here is the ranking, so an upstream
             * outage is retried rather than scored. The count of terms that
             * needed it is reported separately, because it is the honest
             * picture of what a member experiences.
             */
            $hits = [];
            for ($try = 1; $try <= 4; $try++) {
                $hits = $usda->search($term, 3);

                if (! $usda->unavailable && $hits !== []) {
                    break;
                }

                $flaky[$term] = ($flaky[$term] ?? 0) + 1;

                if (method_exists($usda, 'forgetSearch')) {
                    $usda->forgetSearch($term, 3);
                }

                usleep(600_000);
            }

            $top  = $hits[0] ?? null;
            $kcal = $top['calories'] ?? null;

            $ok = $kcal !== null && $kcal >= $min && $kcal <= $max;
            $pass += $ok ? 1 : 0;

            $rows[] = [
                'term'     => $term,
                'expected' => "{$min}-{$max}",
                'note'     => $note,
                'match'    => $top['name'] ?? null,
                'kind'     => $top['kind'] ?? null,
                'kcal'     => $kcal,
                'ok'       => $ok,
            ];

            if (! $this->option('json')) {
                $this->line(sprintf(
                    '  %-4s %-17s %-9s %-44s %-7s %s',
                    $ok ? 'ok' : 'FAIL',
                    $term,
                    "{$min}-{$max}",
                    mb_strimwidth((string) ($top['name'] ?? 'NO MATCH'), 0, 44, '...'),
                    $top['kind'] ?? '-',
                    $kcal === null ? '-' : round((float) $kcal),
                ));
            }
        }

        $total = count(self::EXPECTED);

        if ($this->option('json')) {
            $this->line(json_encode([
                'passed'      => $pass,
                'total'       => $total,
                'api_retries' => $flaky,
                'rows'        => $rows,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        }

        $this->newLine();
        $this->line(sprintf('  %d/%d within the expected calorie range (%d%%).', $pass, $total, round($pass / $total * 100)));

        if ($flaky !== []) {
            $this->line(sprintf(
                '  %d of %d terms needed a retry because FoodData Central failed (%d retries in total).',
                count($flaky),
                $total,
                array_sum($flaky),
            ));
        }

        $this->newLine();

        return self::SUCCESS;
    }
}
