<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('image_url')->nullable()->after('content');
        });
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->string('color', 20)->nullable()->after('type');
        });
        Schema::table('recipes', function (Blueprint $table) {
            $table->string('difficulty')->nullable()->after('cook_time');
        });
    }
    public function down(): void {
        Schema::table('messages', function (Blueprint $table) { $table->dropColumn('image_url'); });
        Schema::table('calendar_events', function (Blueprint $table) { $table->dropColumn('color'); });
        Schema::table('recipes', function (Blueprint $table) { $table->dropColumn('difficulty'); });
    }
};
