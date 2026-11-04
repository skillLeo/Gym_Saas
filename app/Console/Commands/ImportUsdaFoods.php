<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Load USDA's curated food datasets into the local tables.
 *
 * Reads the published CSV archives straight out of their zips — there is no
 * extraction step, so nothing stale is left on disk and the operator drops in
 * one file per dataset and runs this.
 *
 * Idempotent: every row is keyed on FoodData Central's own id and upserted, so
 * re-running the same release changes nothing and running a newer release
 * updates in place. It never deletes, so a food withdrawn upstream stays —
 * which is deliberate, because a member's journal may point at it.
 *
 *   php artisan foods:import-usda
 *   php artisan foods:import-usda --path=/some/other/dir
 *   php artisan foods:import-usda --dataset=sr_legacy
 *
 * Data: USDA FoodData Central, public domain (CC0 1.0).
 */
class ImportUsdaFoods extends Command
{
    protected $signature = 'foods:import-usda
        {--path= : Directory holding the dataset zips (default: storage/app/usda)}
        {--dataset=all : foundation, sr_legacy, or all}';

    protected $description = 'Import USDA Foundation and SR Legacy foods into the local tables.';

    /**
     * The seven nutrients we store, by FoodData Central nutrient id.
     *
     * @var array<int, string>
     */
    private const NUTRIENTS = [
        1003 => 'protein_g',
        1004 => 'fat_g',
        1005 => 'carbs_g',
        1079 => 'fiber_g',
        1093 => 'sodium_mg',
        2000 => 'sugar_g',
    ];

    /**
     * Energy, in order of preference.
     *
     * 1008 is the reported kilocalorie figure and is what SR Legacy uses for
     * every one of its foods. Foundation often lacks it: only 135 of its 469
     * foods carry 1008, and taking that alone would have imported most of
     * Foundation with no calorie value and therefore invisible to search.
     * 2048 (Atwater specific factors) and 2047 (Atwater general factors) are
     * USDA's own computed energy for exactly those rows, and accepting them
     * raises Foundation's coverage from 29% to 81%. Specific before general,
     * because specific factors are derived per food rather than per class.
     *
     * @var list<int>
     */
    private const ENERGY_IDS = [1008, 2048, 2047];

    /** The data_type values that are real foods; the rest is lab scaffolding. */
    private const FOOD_TYPES = ['foundation_food', 'sr_legacy_food'];

    /** Files each archive must contain, or the import is refused. */
    private const REQUIRED = ['food.csv', 'food_nutrient.csv', 'food_portion.csv'];

    public function handle(): int
    {
        $dir = rtrim($this->option('path') ?: storage_path('app/usda'), '/\\');

        if (! is_dir($dir)) {
            $this->error("No such directory: {$dir}");
            $this->line('  Put the dataset zips there, or pass --path=');

            return self::FAILURE;
        }

        $wanted = $this->option('dataset');
        $sets   = [
            'foundation' => 'FoodData_Central_foundation_food_csv_*.zip',
            'sr_legacy'  => 'FoodData_Central_sr_legacy_food_csv_*.zip',
        ];

        if ($wanted !== 'all' && ! isset($sets[$wanted])) {
            $this->error("Unknown dataset '{$wanted}'. Use foundation, sr_legacy, or all.");

            return self::FAILURE;
        }

        $totalFoods = 0;
        $totalPorts = 0;

        foreach ($sets as $name => $pattern) {
            if ($wanted !== 'all' && $wanted !== $name) {
                continue;
            }

            $archive = $this->newestMatching($dir, $pattern);

            if ($archive === null) {
                $this->error("No {$name} archive found in {$dir} (looking for {$pattern}).");
                $this->line('  Download it from https://fdc.nal.usda.gov/download-datasets');

                return self::FAILURE;
            }

            $this->newLine();
            $this->info(basename($archive));

            $inner = $this->verifyArchive($archive);

            if ($inner === null) {
                return self::FAILURE;
            }

            [$foods, $ports] = $this->importArchive($archive, $inner);
            $totalFoods += $foods;
            $totalPorts += $ports;
        }

        $this->newLine();
        $this->line(sprintf('  %d foods and %d portions in the local tables.', $totalFoods, $totalPorts));
        $this->comment('  Data: USDA FoodData Central, public domain (CC0 1.0).');
        $this->newLine();

        return self::SUCCESS;
    }

    /** The most recent release in the directory, by filename. */
    private function newestMatching(string $dir, string $pattern): ?string
    {
        $found = glob($dir.DIRECTORY_SEPARATOR.$pattern) ?: [];
        sort($found);

        return $found === [] ? null : end($found);
    }

    /**
     * Confirm the archive actually carries the tables, and return the prefix.
     *
     * This is not defensive padding. USDA's own Foundation release of
     * 2026-10-29 ships WITHOUT food.csv, food_nutrient.csv or food_portion.csv
     * — it contains only ids and lab-sample metadata. Importing it silently
     * would have produced zero foods and looked like success, so an archive
     * missing any of them is refused by name.
     */
    private function verifyArchive(string $path): ?string
    {
        $zip = new \ZipArchive();

        if ($zip->open($path) !== true) {
            $this->error("  Could not open the archive. Is it a complete download?");

            return null;
        }

        $names = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $names[] = $zip->getNameIndex($i);
        }
        $zip->close();

        // Everything sits under one directory named after the release.
        $prefix = '';
        foreach ($names as $n) {
            if (str_ends_with($n, '/food.csv')) {
                $prefix = substr($n, 0, -strlen('food.csv'));
                break;
            }
        }

        $missing = [];
        foreach (self::REQUIRED as $file) {
            if (! in_array($prefix.$file, $names, true)) {
                $missing[] = $file;
            }
        }

        if ($missing !== []) {
            $this->error('  Archive is missing: '.implode(', ', $missing));
            $this->line('  USDA has published incomplete Foundation archives before —');
            $this->line('  the 2026-10-29 release has no food tables at all. Use an');
            $this->line('  earlier release; 2026-04-30 is complete.');

            return null;
        }

        return $prefix;
    }

    /** @return array{0:int,1:int} foods, portions */
    private function importArchive(string $archive, string $prefix): array
    {
        $keep = $this->readFoods($archive, $prefix);
        $this->line(sprintf('  %6d foods', count($keep)));

        $nutrients = $this->readNutrients($archive, $prefix, $keep);
        $this->line(sprintf('  %6d foods carry a calorie value', $this->countWithCalories($nutrients)));

        $written = $this->writeFoods($keep, $nutrients);
        $ports   = $this->writePortions($archive, $prefix, $keep);

        $this->line(sprintf('  %6d portions', $ports));

        return [$written, $ports];
    }

    /**
     * The real foods, by fdc_id.
     *
     * Foundation's food.csv holds 87,991 rows of which only 469 are foods; the
     * rest are sub_sample_food, market_acquisition and sample_food records
     * from the laboratory pipeline.
     *
     * @return array<int, array{description:string,category:?int,published:?string}>
     */
    private function readFoods(string $archive, string $prefix): array
    {
        $out = [];

        $this->eachRow($archive, $prefix.'food.csv', function (array $row, array $col) use (&$out) {
            if (! in_array($row[$col['data_type']] ?? '', self::FOOD_TYPES, true)) {
                return;
            }

            $out[(int) $row[$col['fdc_id']]] = [
                'data_type'   => (string) $row[$col['data_type']],
                'description' => trim((string) ($row[$col['description']] ?? '')),
                'category'    => ($row[$col['food_category_id']] ?? '') === '' ? null : (int) $row[$col['food_category_id']],
                'published'   => ($row[$col['publication_date']] ?? '') === '' ? null : $row[$col['publication_date']],
            ];
        });

        return $out;
    }

    /**
     * Our seven nutrients for the kept foods.
     *
     * @param  array<int, mixed>  $keep
     * @return array<int, array<string, float>>
     */
    private function readNutrients(string $archive, string $prefix, array $keep): array
    {
        $out    = [];
        $energy = [];   // fdc_id => [nutrient_id => amount], resolved afterwards

        $this->eachRow($archive, $prefix.'food_nutrient.csv', function (array $row, array $col) use (&$out, &$energy, $keep) {
            $fdc = (int) ($row[$col['fdc_id']] ?? 0);

            if (! isset($keep[$fdc])) {
                return;
            }

            $id     = (int) ($row[$col['nutrient_id']] ?? 0);
            $amount = $row[$col['amount']] ?? '';

            if ($amount === '') {
                return;
            }

            if (isset(self::NUTRIENTS[$id])) {
                $out[$fdc][self::NUTRIENTS[$id]] = (float) $amount;
            } elseif (in_array($id, self::ENERGY_IDS, true)) {
                $energy[$fdc][$id] = (float) $amount;
            }
        });

        // Energy resolved by preference, once all rows have been seen.
        foreach ($energy as $fdc => $byId) {
            foreach (self::ENERGY_IDS as $id) {
                if (isset($byId[$id])) {
                    $out[$fdc]['calories'] = $byId[$id];
                    break;
                }
            }
        }

        return $out;
    }

    /** @param array<int, array<string, float>> $nutrients */
    private function countWithCalories(array $nutrients): int
    {
        return count(array_filter($nutrients, fn ($n) => isset($n['calories'])));
    }

    /**
     * @param  array<int, array{description:string,category:?int,published:?string}>  $keep
     * @param  array<int, array<string, float>>                                       $nutrients
     */
    private function writeFoods(array $keep, array $nutrients): int
    {
        $now  = now();
        $rows = [];

        foreach ($keep as $fdc => $food) {
            $n = $nutrients[$fdc] ?? [];

            $rows[] = [
                'fdc_id'           => $fdc,
                'data_type'        => $food['data_type'],
                'description'      => mb_substr($food['description'], 0, 200),
                'food_category_id' => $food['category'],
                'publication_date' => $food['published'],
                'calories'         => $n['calories']  ?? null,
                'protein_g'        => $n['protein_g'] ?? null,
                'carbs_g'          => $n['carbs_g']   ?? null,
                'fat_g'            => $n['fat_g']     ?? null,
                'fiber_g'          => $n['fiber_g']   ?? null,
                'sugar_g'          => $n['sugar_g']   ?? null,
                'sodium_mg'        => $n['sodium_mg'] ?? null,
                'created_at'       => $now,
                'updated_at'       => $now,
            ];
        }

        $this->upsert('usda_foods', $rows, 'fdc_id', [
            'data_type', 'description', 'food_category_id', 'publication_date',
            'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g',
            'sodium_mg', 'updated_at',
        ]);

        return count($rows);
    }

    /** @param array<int, mixed> $keep */
    private function writePortions(string $archive, string $prefix, array $keep): int
    {
        $rows  = [];
        $count = 0;

        $this->eachRow($archive, $prefix.'food_portion.csv', function (array $row, array $col) use (&$rows, &$count, $keep) {
            $fdc = (int) ($row[$col['fdc_id']] ?? 0);

            if (! isset($keep[$fdc])) {
                return;
            }

            $rows[] = [
                'id'                  => (int) $row[$col['id']],
                'fdc_id'              => $fdc,
                'seq_num'             => ($row[$col['seq_num']] ?? '') === '' ? null : (int) $row[$col['seq_num']],
                'amount'              => ($row[$col['amount']] ?? '') === '' ? null : (float) $row[$col['amount']],
                'portion_description' => mb_substr((string) ($row[$col['portion_description']] ?? ''), 0, 160) ?: null,
                'modifier'            => mb_substr((string) ($row[$col['modifier']] ?? ''), 0, 160) ?: null,
                'gram_weight'         => ($row[$col['gram_weight']] ?? '') === '' ? null : (float) $row[$col['gram_weight']],
            ];
            $count++;
        });

        $this->upsert('usda_food_portions', $rows, 'id', [
            'fdc_id', 'seq_num', 'amount', 'portion_description', 'modifier', 'gram_weight',
        ]);

        return $count;
    }

    /**
     * Chunked upsert, so a re-run updates in place and never duplicates.
     *
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>                $update
     */
    private function upsert(string $table, array $rows, string $key, array $update): void
    {
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($table)->upsert($chunk, [$key], $update);
        }
    }

    /**
     * Stream one CSV out of the zip, row by row.
     *
     * The escape character is passed explicitly: PHP 8.4 deprecates leaving it
     * to the default, and the default backslash escaping is wrong for RFC 4180
     * data like this anyway. Reading from `zip://` means the 35 MB
     * food_nutrient.csv is never written to disk.
     *
     * @param  callable(array<int,string>, array<string,int>): void  $onRow
     */
    private function eachRow(string $archive, string $inner, callable $onRow): void
    {
        $url = 'zip://'.realpath($archive).'#'.$inner;
        $fh  = fopen($url, 'r');

        if ($fh === false) {
            throw new \RuntimeException("Could not read {$inner} from the archive.");
        }

        $header = fgetcsv($fh, 0, ',', '"', '');

        if ($header === false) {
            fclose($fh);

            return;
        }

        $col = array_flip(array_map(static fn ($h) => trim((string) $h, "\xEF\xBB\xBF \t"), $header));

        while (($row = fgetcsv($fh, 0, ',', '"', '')) !== false) {
            $onRow($row, $col);
        }

        fclose($fh);
    }
}
