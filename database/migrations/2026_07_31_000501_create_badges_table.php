<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Badge definitions (§4.5).
 *
 * Deliberately data-driven: `criteria_type` names an evaluator and `criteria`
 * carries its parameters as JSON. Adding a badge — a 14-day workout streak, a
 * 30-meal month, a gold tier of an existing rule — is an INSERT, never a
 * migration. Only a genuinely new *kind* of rule requires code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('badges', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('description')->nullable();

            // Lucide icon name. Never an emoji — emoji render differently on
            // every platform and cannot be themed.
            $table->string('icon_name');

            $table->enum('tier', ['bronze', 'silver', 'gold', 'platinum'])->nullable();

            // Names the evaluator, e.g. 'consecutive_days' or 'count_in_period'.
            $table->string('criteria_type');
            // Its parameters, e.g. {"activity":"workout","days":7}.
            $table->json('criteria');

            $table->boolean('is_active')->default(true);
            $table->smallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('badges');
    }
};
