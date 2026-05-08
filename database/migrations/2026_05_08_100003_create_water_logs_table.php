<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('water_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('logged_date');
            $table->integer('glasses_count')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'logged_date']);
        });
    }
    public function down(): void { Schema::dropIfExists('water_logs'); }
};
