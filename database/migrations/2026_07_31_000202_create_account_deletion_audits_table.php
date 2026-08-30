<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permanent record of every account deletion (§4.2: "Never silently destroy
 * user data").
 *
 * Deliberately has **no foreign key** to `users`: the whole purpose of this
 * table is to outlive the row it describes. A cascading FK would erase the
 * audit trail at exactly the moment it becomes the only evidence the account
 * ever existed.
 *
 * The email is stored so a returning customer's "what happened to my account?"
 * can actually be answered after the user row is gone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_deletion_audits', function (Blueprint $table) {
            $table->id();

            // Not a foreign key — see the note above.
            $table->unsignedBigInteger('user_id');
            $table->string('email');
            $table->string('name')->nullable();

            $table->enum('action', ['soft_deleted', 'hard_deleted', 'restored']);
            $table->string('reason');

            // State at the moment of the action, so the decision can be
            // audited later without reconstructing it from other tables.
            $table->string('account_state_at_action')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->boolean('had_any_payment')->default(false);

            // Null when a scheduled job acted; set when a human did.
            $table->unsignedBigInteger('performed_by_user_id')->nullable();

            $table->timestamps();

            $table->index('user_id');
            $table->index(['action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_deletion_audits');
    }
};
