<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The three purchasable tiers: Basic monthly, Premium monthly, Annual VIP.
 *
 * Prices live in Stripe; this table maps our plan keys to Stripe price IDs and
 * holds the marketing copy. `amount_cents` is mirrored here so the pricing page
 * can render without an API round-trip — Stripe stays authoritative for what is
 * actually charged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->enum('key', ['basic', 'premium', 'annual_vip'])->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('stripe_price_id')->nullable();

            // Money as integer cents. Never float — 0.1 + 0.2 is not 0.3.
            $table->unsignedInteger('amount_cents');
            $table->char('currency', 3)->default('USD');
            $table->enum('interval', ['month', 'year']);

            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->smallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_plans');
    }
};
