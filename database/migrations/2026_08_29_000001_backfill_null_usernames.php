<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;

/**
 * Give every account a username.
 *
 * Public profiles are addressed by username — the API route is
 * `/social/users/{username}` and the frontend links to `/social/{username}`.
 * `AdminUserSeeder` and `TestUserSeeder` never set one, so the two seeded
 * accounts (including the client's own admin account) had `username = NULL`.
 * Find Members and the feed rendered their links as `/social/null`, and
 * clicking the client's own name landed on "User not found".
 *
 * The seeders now set a username too, so this is a one-off repair for
 * databases that were seeded before that fix.
 */
return new class extends Migration
{
    public function up(): void
    {
        User::withTrashed()->whereNull('username')->orWhere('username', '')->each(function (User $user) {
            $user->forceFill(['username' => User::generateUsername($user->name)])->save();
        });
    }

    public function down(): void
    {
        // Deliberately irreversible. Nulling these again would only restore the
        // broken profile links, and we cannot tell which rows were originally
        // null once they have been filled.
    }
};
