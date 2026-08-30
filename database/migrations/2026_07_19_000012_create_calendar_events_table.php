<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->enum('type', ['workout','meal','appointment','personal','other'])->default('personal');
            $table->date('date');
            $table->string('time')->nullable();
            $table->string('end_time')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'date']);
        });
    }
    public function down(): void { Schema::dropIfExists('calendar_events'); }
};
