<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('beta_allowlist', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('note')->nullable();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('beta_allowlist');
    }
};
