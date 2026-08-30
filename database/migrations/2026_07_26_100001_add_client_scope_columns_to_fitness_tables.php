<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('fitness_logs', function (Blueprint $table) {
            $table->json('exercises')->nullable()->after('notes');
            $table->decimal('distance_miles', 6, 2)->nullable()->after('exercises');
        });
        Schema::table('body_stats', function (Blueprint $table) {
            $table->decimal('hips_inches', 5, 1)->nullable()->after('waist_inches');
            $table->decimal('chest_inches', 5, 1)->nullable()->after('hips_inches');
            $table->decimal('arms_inches', 5, 1)->nullable()->after('chest_inches');
            $table->decimal('thighs_inches', 5, 1)->nullable()->after('arms_inches');
        });
        Schema::table('fitness_goals', function (Blueprint $table) {
            $table->string('goal_type')->default('custom')->after('category');
        });
    }
    public function down(): void {
        Schema::table('fitness_goals', function (Blueprint $table) {
            $table->dropColumn('goal_type');
        });
        Schema::table('body_stats', function (Blueprint $table) {
            $table->dropColumn(['hips_inches', 'chest_inches', 'arms_inches', 'thighs_inches']);
        });
        Schema::table('fitness_logs', function (Blueprint $table) {
            $table->dropColumn(['exercises', 'distance_miles']);
        });
    }
};
