<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        Schema::table('water_logs', function (Blueprint $table) {
            $table->unsignedInteger('total_ounces')->default(0)->after('glasses_count');
        });
        DB::statement('UPDATE water_logs SET total_ounces = glasses_count * 8');
    }
    public function down(): void {
        Schema::table('water_logs', function (Blueprint $table) {
            $table->dropColumn('total_ounces');
        });
    }
};
