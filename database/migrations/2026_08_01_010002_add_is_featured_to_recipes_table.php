<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recipe management (§E1) needs a real, persisted "feature" flag. The admin
 * recipes screen previously had Approve/Feature/Remove buttons that only
 * mutated local React state — clicking them looked like it worked but nothing
 * was saved. This gives "feature" somewhere real to write to.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->boolean('is_featured')->default(false)->after('is_public')->index();
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('is_featured');
        });
    }
};
