<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-member view/download log (§5.3).
 *
 * The counters on `resources` are a fast denormalised summary; this table is
 * the auditable record behind them, so "who actually opened this?" is
 * answerable rather than inferred from a number.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resource_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resource_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('action', ['view', 'download']);
            $table->timestamp('created_at')->nullable();

            $table->index(['resource_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resource_views');
    }
};
