<?php

namespace Tests\Feature\Food;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * foods:import-usda, against archives built here rather than downloaded.
 *
 * The real datasets are 9 MB of zips that cannot live in the repository, so
 * these build miniature ones in the same shape: the same filenames, the same
 * columns, the same quoting. That is enough to pin the decisions that are easy
 * to get wrong and expensive to get wrong quietly — which rows count as food,
 * which nutrient means calories, and what happens when USDA ships an archive
 * with no food tables in it, as they did in October 2026.
 */
class ImportUsdaFoodsTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dir = storage_path('framework/testing/usda-'.bin2hex(random_bytes(4)));
        mkdir($this->dir, 0777, true);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir.'/*') ?: [] as $f) {
            unlink($f);
        }
        @rmdir($this->dir);

        parent::tearDown();
    }

    /**
     * Build a dataset archive with the given CSV contents.
     *
     * @param  array<string, string>  $files  filename => contents
     */
    private function archive(string $name, array $files): void
    {
        $zip = new \ZipArchive();
        $zip->open($this->dir.'/'.$name, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);

        $prefix = pathinfo($name, PATHINFO_FILENAME).'/';

        foreach ($files as $file => $contents) {
            $zip->addFromString($prefix.$file, $contents);
        }

        $zip->close();
    }

    /** A complete, if tiny, SR Legacy archive. */
    private function srLegacy(): void
    {
        $this->archive('FoodData_Central_sr_legacy_food_csv_2018-04.zip', [
            'food.csv' => <<<'CSV'
            "fdc_id","data_type","description","food_category_id","publication_date"
            "173944","sr_legacy_food","Bananas, raw","9","2019-04-01"
            "170379","sr_legacy_food","Broccoli, raw","11","2019-04-01"
            "999001","sub_sample_food","Laboratory sub-sample, not a food","","2019-04-01"
            CSV,

            'food_nutrient.csv' => <<<'CSV'
            "id","fdc_id","nutrient_id","amount"
            "1","173944","1008","89"
            "2","173944","1003","1.09"
            "3","173944","1005","22.84"
            "4","173944","1004","0.33"
            "5","170379","1008","34"
            "6","170379","1003","2.82"
            "7","999001","1008","500"
            CSV,

            'food_portion.csv' => <<<'CSV'
            "id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight"
            "10","173944","1","1","","","medium","118"
            "11","999001","1","1","","","sample","1"
            CSV,
        ]);
    }

    // ------------------------------------------------------- what is a food

    public function test_it_imports_the_foods_and_their_nutrients(): void
    {
        $this->srLegacy();

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy'])
            ->assertSuccessful();

        $banana = DB::table('usda_foods')->where('fdc_id', 173944)->first();

        $this->assertSame('Bananas, raw', $banana->description);
        $this->assertSame('sr_legacy_food', $banana->data_type);
        $this->assertEquals(89, $banana->calories);
        $this->assertEquals(1.09, $banana->protein_g);
        $this->assertEquals(22.84, $banana->carbs_g);
    }

    public function test_laboratory_rows_are_not_imported_as_foods(): void
    {
        /*
         * Foundation's food.csv holds 87,991 rows of which 469 are foods; the
         * rest are sub_sample_food, market_acquisition and sample_food records
         * from the lab pipeline. Importing those would bury real foods under
         * tens of thousands of specimens.
         */
        $this->srLegacy();

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy']);

        $this->assertSame(2, DB::table('usda_foods')->count());
        $this->assertDatabaseMissing('usda_foods', ['fdc_id' => 999001]);
        // Its portion must not come along either.
        $this->assertDatabaseMissing('usda_food_portions', ['fdc_id' => 999001]);
    }

    public function test_portions_are_imported_for_real_foods(): void
    {
        $this->srLegacy();

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy']);

        $this->assertDatabaseHas('usda_food_portions', [
            'fdc_id'      => 173944,
            'modifier'    => 'medium',
            'gram_weight' => 118,
        ]);
    }

    // ----------------------------------------------------------- re-running

    public function test_running_it_twice_changes_nothing(): void
    {
        $this->srLegacy();

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy']);
        $before = DB::table('usda_foods')->orderBy('fdc_id')->get()->toArray();

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy']);
        $after = DB::table('usda_foods')->orderBy('fdc_id')->get()->toArray();

        $this->assertSame(2, DB::table('usda_foods')->count());
        $this->assertEquals(
            array_map(fn ($r) => (array) $r, $before),
            array_map(fn ($r) => (array) $r, $after),
        );
    }

    public function test_a_newer_release_updates_in_place(): void
    {
        $this->srLegacy();
        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy']);

        // Same fdc_id, corrected figure — which is what a re-release is.
        $this->archive('FoodData_Central_sr_legacy_food_csv_2019-04.zip', [
            'food.csv' => "\"fdc_id\",\"data_type\",\"description\",\"food_category_id\",\"publication_date\"\n"
                ."\"173944\",\"sr_legacy_food\",\"Bananas, raw, revised\",\"9\",\"2019-04-01\"\n",
            'food_nutrient.csv' => "\"id\",\"fdc_id\",\"nutrient_id\",\"amount\"\n\"1\",\"173944\",\"1008\",\"95\"\n",
            'food_portion.csv'  => "\"id\",\"fdc_id\",\"seq_num\",\"amount\",\"portion_description\",\"modifier\",\"gram_weight\"\n",
        ]);

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy']);

        $banana = DB::table('usda_foods')->where('fdc_id', 173944)->first();
        $this->assertSame('Bananas, raw, revised', $banana->description);
        $this->assertEquals(95, $banana->calories);
        $this->assertSame(1, DB::table('usda_foods')->where('fdc_id', 173944)->count());
    }

    // ------------------------------------------------------------- calories

    public function test_atwater_energy_is_used_when_the_plain_one_is_absent(): void
    {
        /*
         * Only 135 of Foundation's 469 foods carry nutrient 1008. Another 243
         * carry USDA's own computed energy instead, and taking 1008 alone
         * imported most of Foundation with no calorie figure — making it
         * invisible to a search that requires one.
         */
        $this->archive('FoodData_Central_foundation_food_csv_2026-04-30.zip', [
            'food.csv' => "\"fdc_id\",\"data_type\",\"description\",\"food_category_id\",\"publication_date\"\n"
                ."\"321358\",\"foundation_food\",\"Hummus, commercial\",\"16\",\"2026-04-30\"\n",
            'food_nutrient.csv' => "\"id\",\"fdc_id\",\"nutrient_id\",\"amount\"\n"
                ."\"1\",\"321358\",\"2048\",\"229\"\n\"2\",\"321358\",\"2047\",\"240\"\n",
            'food_portion.csv' => "\"id\",\"fdc_id\",\"seq_num\",\"amount\",\"portion_description\",\"modifier\",\"gram_weight\"\n",
        ]);

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'foundation']);

        // 2048 (specific factors) is preferred over 2047 (general factors).
        $this->assertEquals(229, DB::table('usda_foods')->where('fdc_id', 321358)->value('calories'));
    }

    // ------------------------------------------------- refusing a bad archive

    public function test_an_archive_without_the_food_tables_is_refused(): void
    {
        /*
         * USDA's Foundation release of 2026-10-29 ships with no food.csv,
         * food_nutrient.csv or food_portion.csv — only ids and lab metadata.
         * Importing it silently would produce nothing and look like success.
         */
        $this->archive('FoodData_Central_foundation_food_csv_2026-10-29.zip', [
            'foundation_food.csv' => "\"fdc_id\",\"NDB_number\",\"footnote\"\n\"321358\",\"16158\",\"\"\n",
            'nutrient.csv'        => "\"id\",\"name\"\n\"1008\",\"Energy\"\n",
        ]);

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'foundation'])
            ->assertFailed();

        $this->assertSame(0, DB::table('usda_foods')->count());
    }

    public function test_a_missing_archive_is_refused_rather_than_ignored(): void
    {
        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy'])
            ->assertFailed();
    }

    public function test_a_missing_directory_is_refused(): void
    {
        $this->artisan('foods:import-usda', ['--path' => $this->dir.'/nope'])
            ->assertFailed();
    }

    public function test_the_newest_release_in_the_directory_wins(): void
    {
        // Two releases side by side: the operator should not have to tidy up.
        $this->srLegacy();
        $this->archive('FoodData_Central_sr_legacy_food_csv_2020-04.zip', [
            'food.csv' => "\"fdc_id\",\"data_type\",\"description\",\"food_category_id\",\"publication_date\"\n"
                ."\"173944\",\"sr_legacy_food\",\"From the newer release\",\"9\",\"2020-04-01\"\n",
            'food_nutrient.csv' => "\"id\",\"fdc_id\",\"nutrient_id\",\"amount\"\n\"1\",\"173944\",\"1008\",\"90\"\n",
            'food_portion.csv'  => "\"id\",\"fdc_id\",\"seq_num\",\"amount\",\"portion_description\",\"modifier\",\"gram_weight\"\n",
        ]);

        $this->artisan('foods:import-usda', ['--path' => $this->dir, '--dataset' => 'sr_legacy']);

        $this->assertSame(
            'From the newer release',
            DB::table('usda_foods')->where('fdc_id', 173944)->value('description'),
        );
    }
}
