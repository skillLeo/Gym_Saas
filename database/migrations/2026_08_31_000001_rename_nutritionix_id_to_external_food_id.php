<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The project moved off Nutritionix to USDA FoodData Central, so a column named
 * `nutritionix_id` now holds FoodData Central ids. That is the kind of naming
 * that quietly misleads whoever reads it next, so it is renamed to something
 * provider-agnostic and a `food_source` column records where a row came from.
 *
 * Existing rows are all either Nutritionix-sourced or custom foods created by
 * members. They keep their ids; only the column name changes, so nothing is
 * lost and nothing needs re-fetching.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('food_items', function (Blueprint $table) {
            $table->renameColumn('nutritionix_id', 'external_food_id');
        });

        Schema::table('food_items', function (Blueprint $table) {
            // Null for the rows that predate this change: their provider is
            // genuinely unknown now, and guessing would be worse than saying so.
            $table->string('food_source', 20)->nullable()->after('external_food_id');
        });
    }

    public function down(): void
    {
        Schema::table('food_items', function (Blueprint $table) {
            $table->dropColumn('food_source');
        });

        Schema::table('food_items', function (Blueprint $table) {
            $table->renameColumn('external_food_id', 'nutritionix_id');
        });
    }
};
