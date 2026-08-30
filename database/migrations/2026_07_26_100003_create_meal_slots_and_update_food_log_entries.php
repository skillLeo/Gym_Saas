<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        Schema::create('meal_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('legacy_key')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'sort_order']);
        });

        Schema::table('food_log_entries', function (Blueprint $table) {
            $table->foreignId('meal_slot_id')->nullable()->after('meal_type')->constrained('meal_slots')->nullOnDelete();
            $table->string('image_url')->nullable()->after('total_fat_g');
            $table->string('meal_type_new')->nullable()->after('meal_type');
        });

        // Migrate meal_type enum values to the new nullable string column, then swap
        DB::statement('UPDATE food_log_entries SET meal_type_new = meal_type');

        // Seed default meal slots for every existing user, map old enum entries to new slots
        $defaults = ['Meal 1', 'Snack 1', 'Meal 2', 'Snack 2', 'Meal 3', 'Snack 3'];
        $legacyMap = ['breakfast' => 'Meal 1', 'lunch' => 'Meal 2', 'dinner' => 'Meal 3', 'snack' => 'Snack 1'];

        $userIds = DB::table('food_log_entries')->distinct()->pluck('user_id')
            ->merge(DB::table('users')->pluck('id'))->unique()->values();

        foreach ($userIds as $userId) {
            $slotIds = [];
            foreach ($defaults as $i => $name) {
                $slotIds[$name] = DB::table('meal_slots')->insertGetId([
                    'user_id'    => $userId,
                    'name'       => $name,
                    'sort_order' => $i,
                    'legacy_key' => array_search($name, $legacyMap) ?: null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            foreach ($legacyMap as $legacyKey => $slotName) {
                DB::table('food_log_entries')
                    ->where('user_id', $userId)
                    ->where('meal_type_new', $legacyKey)
                    ->update(['meal_slot_id' => $slotIds[$slotName]]);
            }
        }

        Schema::table('food_log_entries', function (Blueprint $table) {
            $table->dropColumn('meal_type');
        });
        Schema::table('food_log_entries', function (Blueprint $table) {
            $table->renameColumn('meal_type_new', 'meal_type');
        });
    }

    public function down(): void {
        Schema::table('food_log_entries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('meal_slot_id');
            $table->dropColumn(['image_url']);
        });
        Schema::dropIfExists('meal_slots');
    }
};
