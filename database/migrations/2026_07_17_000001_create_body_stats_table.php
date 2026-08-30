<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('body_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('logged_date');
            $table->decimal('weight_lbs', 6, 2)->nullable();
            $table->decimal('body_fat_pct', 5, 2)->nullable();
            $table->decimal('waist_inches', 5, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'logged_date']);
            $table->index(['user_id', 'logged_date']);
        });
    }
    public function down(): void { Schema::dropIfExists('body_stats'); }
};
