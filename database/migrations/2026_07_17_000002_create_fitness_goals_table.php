<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('fitness_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('category')->default('Strength');
            $table->decimal('target_value', 10, 2);
            $table->decimal('current_value', 10, 2)->default(0);
            $table->string('unit')->default('');
            $table->date('deadline')->nullable();
            $table->string('emoji')->default('🎯');
            $table->string('color', 20)->default('#F87404');
            $table->boolean('completed')->default(false);
            $table->boolean('lower_is_better')->default(false);
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('fitness_goals'); }
};
