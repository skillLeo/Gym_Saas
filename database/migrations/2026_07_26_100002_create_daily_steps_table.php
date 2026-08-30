<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('daily_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('logged_date');
            $table->unsignedInteger('steps')->default(0);
            $table->unsignedInteger('goal')->default(10000);
            $table->timestamps();
            $table->unique(['user_id', 'logged_date']);
        });
    }
    public function down(): void { Schema::dropIfExists('daily_steps'); }
};
