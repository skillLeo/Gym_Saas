<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Makes `recipes.rating` nullable so "not rated yet" is representable.
 *
 * The column was NOT NULL DEFAULT 0.00, which forces every unrated recipe to
 * claim a rating of zero — a false statement, not merely an empty one. The
 * seeded ratings were fabricated, so they are cleared to NULL here rather than
 * zeroed: 0 reviews is true, but "rated 0.00 out of 5" is not.
 *
 * `reviews_count` stays NOT NULL DEFAULT 0 and is zeroed — a count of zero is
 * accurate.
 *
 * Ordering: RecipeController now sorts with `rating IS NULL ASC, rating DESC`
 * so unrated recipes fall to the end instead of relying on MySQL's implicit
 * NULL placement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->decimal('rating', 3, 2)->nullable()->default(null)->change();
        });

        // Clear fabricated seed ratings and review counts.
        DB::table('recipes')->update(['rating' => null, 'reviews_count' => 0]);
    }

    public function down(): void
    {
        // Restore the non-nullable column. Existing NULLs become 0.00, which is
        // the value the column previously defaulted to.
        DB::table('recipes')->whereNull('rating')->update(['rating' => 0]);

        Schema::table('recipes', function (Blueprint $table) {
            $table->decimal('rating', 3, 2)->nullable(false)->default(0)->change();
        });
    }
};
