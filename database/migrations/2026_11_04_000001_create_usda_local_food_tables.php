<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A local copy of USDA's curated foods, so everyday lookups stop depending on
 * a service that is down as often as it is up.
 *
 * FoodData Central's live API has been returning spurious 400s, timing out,
 * and at times answering nothing at all. The foods a member actually types —
 * banana, chicken breast, rice — are in two datasets USDA publishes as flat
 * CSVs under CC0, and they change at most twice a year. Keeping them here
 * turns the common case into a local index lookup and leaves the API for the
 * things only it can answer: branded products and barcodes.
 *
 * ADDITIVE ONLY. Two new tables; nothing existing is touched. Journal rows
 * stay compatible because these carry FoodData Central's own `fdc_id`, which
 * is the same identifier the API returns — `GET /fdc/v1/food/173944` and the
 * SR Legacy CSV both give "Bananas, raw". The food resolver keys on
 * (external_food_id, food_source), so the same food found locally or remotely
 * collapses to one food_items row.
 *
 * Nutrients are COLUMNS, not a nutrient table. We store exactly seven, they
 * are the same seven food_items already has, and search needs them on the row
 * it is ranking — a join per candidate would buy nothing. The source CSV's
 * other ~470 nutrients are not imported.
 *
 * Expected size after import: about 8,260 foods and 14,600 portions, roughly
 * 3.9 MB of table and index together — 2.1 MB for the foods and 1.8 MB for
 * the portions, measured after a real import rather than estimated.
 */
return new class extends Migration
{
    private const FULLTEXT_INDEX = 'usda_foods_description_fulltext';

    public function up(): void
    {
        Schema::create('usda_foods', function (Blueprint $table) {
            /*
             * FoodData Central's own id, not an auto-increment. It is stable
             * across releases, it is what the API returns, and re-importing a
             * newer release has to update the same row rather than make a
             * second one.
             */
            $table->unsignedInteger('fdc_id')->primary();

            // foundation_food | sr_legacy_food. Kept so a later release can be
            // imported per dataset, and so the origin of a row is visible.
            $table->string('data_type', 20);

            // Longest description in the two datasets is 134 characters.
            $table->string('description', 200);

            $table->unsignedSmallInteger('food_category_id')->nullable();
            $table->date('publication_date')->nullable();

            /*
             * Per 100 g, always — the same convention as the API path and
             * food_items. Nullable because USDA genuinely lacks values: only
             * 29% of Foundation foods carry calories at all, against 100% of
             * SR Legacy. Search filters on calories being present, exactly as
             * the API path already does.
             */
            $table->decimal('calories', 9, 3)->nullable();
            $table->decimal('protein_g', 9, 3)->nullable();
            $table->decimal('carbs_g', 9, 3)->nullable();
            $table->decimal('fat_g', 9, 3)->nullable();
            $table->decimal('fiber_g', 9, 3)->nullable();
            $table->decimal('sugar_g', 9, 3)->nullable();
            $table->decimal('sodium_mg', 9, 3)->nullable();

            $table->timestamps();

            $table->index('data_type');
            // Search discards foods with no calorie figure before ranking.
            $table->index('calories');
        });

        Schema::create('usda_food_portions', function (Blueprint $table) {
            $table->unsignedInteger('id')->primary();   // FoodData Central's own id
            $table->unsignedInteger('fdc_id')->index();
            $table->unsignedSmallInteger('seq_num')->nullable();
            $table->decimal('amount', 9, 3)->nullable();
            $table->string('portion_description', 160)->nullable();
            $table->string('modifier', 160)->nullable();
            $table->decimal('gram_weight', 9, 2)->nullable();
        });

        $this->addFullTextIndex();
    }

    public function down(): void
    {
        Schema::dropIfExists('usda_food_portions');
        Schema::dropIfExists('usda_foods');
    }

    /**
     * FULLTEXT is MySQL-only.
     *
     * Raw SQL rather than Laravel's fullText() helper, and guarded, for the
     * same reason as the messages index: on sqlite — which the test suite runs
     * on — this is not merely unsupported, it is a syntax error that aborts
     * the whole migration run. Search has a LIKE path for short words anyway,
     * and that is what the tests exercise.
     */
    private function addFullTextIndex(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(
            'ALTER TABLE `usda_foods` ADD FULLTEXT INDEX `'.self::FULLTEXT_INDEX.'` (`description`)'
        );
    }
};
