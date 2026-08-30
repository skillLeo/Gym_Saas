<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique()->after('name');
        });

        // Auto-generate usernames for existing users
        $users = DB::table('users')->get();
        foreach ($users as $user) {
            $base = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $user->name)) ?: 'user';
            $slug = $base . $user->id;
            DB::table('users')->where('id', $user->id)->update(['username' => $slug]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('username');
        });
    }
};
