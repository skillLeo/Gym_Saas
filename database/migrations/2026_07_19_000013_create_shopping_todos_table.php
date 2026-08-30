<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('shopping_list_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('quantity')->nullable();
            $table->string('unit')->nullable();
            $table->string('category')->nullable();
            $table->boolean('checked')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'checked']);
        });

        Schema::create('todos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('text');
            $table->boolean('completed')->default(false);
            $table->date('due_date')->nullable();
            $table->string('priority')->default('medium');
            $table->timestamps();
            $table->index(['user_id', 'completed']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('todos');
        Schema::dropIfExists('shopping_list_items');
    }
};
