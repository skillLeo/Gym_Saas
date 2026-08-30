<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flattened, indexed projection of every name a member goes by (§5.6).
 *
 * Maiden names, previous names and nicknames all resolve to the same profile,
 * so member search is one indexed query across this table plus the users table
 * rather than a JSON scan.
 *
 * Rebuilt from the user record by model events — never edited directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_name_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('alias', 120);
            $table->enum('type', ['maiden', 'previous', 'nickname', 'alternate']);
            $table->timestamp('created_at')->nullable();

            $table->index('alias');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_name_aliases');
    }
};
