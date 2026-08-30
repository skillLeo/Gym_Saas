<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-editable trial conversion offers (§4.3).
 *
 * Two stages by default: a stronger incentive partway through the trial, and a
 * weaker reminder later. Copy, discount and timing are all editable from the
 * admin panel with no developer involvement, which is why they live in a table
 * rather than in code.
 *
 * `stripe_coupon_id` points at the Stripe Coupon holding the actual discount.
 * Each user then gets their own Promotion Code against that coupon — see
 * `coupon_grants`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupon_offers', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->unsignedTinyInteger('stage');

            // Days after the trial starts that this offer is sent.
            $table->smallInteger('trigger_day_offset');
            // How long the granted code stays valid once sent.
            $table->smallInteger('expires_after_days');

            $table->enum('discount_type', ['percent', 'fixed']);
            // percent: 0-100. fixed: whole currency units, validated against
            // the cheapest active plan so a discount can never exceed a price.
            $table->decimal('discount_value', 8, 2);

            $table->string('stripe_coupon_id')->nullable();

            $table->string('email_subject');
            $table->text('email_body_html');

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'trigger_day_offset']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_offers');
    }
};
