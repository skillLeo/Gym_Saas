<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Admin-defined categories for the resources library (§5.3). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resource_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            // Lucide name, never an emoji — same rule as badges.
            $table->string('icon_name')->default('folder');
            $table->smallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resource_categories');
    }
};
