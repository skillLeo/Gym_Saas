<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Local mirror of Stripe subscription state.
 *
 * Stripe is the source of truth; this table exists so the app can answer "is
 * this user entitled to premium features?" without an API call on every request.
 * Webhooks keep it in sync.
 *
 * `status` mirrors Stripe's own subscription statuses verbatim rather than
 * mapping to our own vocabulary — a translation layer here would silently drop
 * states Stripe adds later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // RESTRICT: a plan with live subscriptions must not be deletable.
            // Deactivate it (`is_active = false`) instead.
            $table->foreignId('plan_id')->constrained('subscription_plans')->restrictOnDelete();

            $table->string('stripe_subscription_id')->unique();
            $table->string('stripe_customer_id');

            $table->enum('status', [
                'trialing', 'active', 'past_due', 'canceled',
                'incomplete', 'incomplete_expired', 'unpaid',
            ]);

            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestamp('canceled_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('current_period_end');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
