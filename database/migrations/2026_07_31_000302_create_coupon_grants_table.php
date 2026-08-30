<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One offer issued to one user (§4.3).
 *
 * Each grant carries its own trackable code, so redemption can be attributed to
 * a specific person and stage rather than to a shared code that says only "some
 * offer worked".
 *
 * The composite UNIQUE on (user_id, coupon_offer_id) is the guard against
 * sending the same offer twice — enforced by the database rather than by a
 * `whereDoesntHave` check, which would race whenever the scheduler overlaps a
 * previous run that has not finished.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupon_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('coupon_offer_id')->constrained()->cascadeOnDelete();

            $table->string('code')->unique();
            $table->string('stripe_promotion_code_id')->nullable();

            $table->timestamp('sent_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('redeemed_at')->nullable();
            $table->foreignId('redeemed_payment_id')->nullable()
                ->constrained('payments')->nullOnDelete();

            $table->timestamps();

            // Never send the same offer to the same person twice.
            $table->unique(['user_id', 'coupon_offer_id']);
            // Drives the expiry sweep.
            $table->index(['expires_at', 'redeemed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_grants');
    }
};
