<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Payment history — successful and failed.
 *
 * Failed attempts are recorded too: "why did my card not work?" is a support
 * question that cannot be answered from a table containing only successes.
 *
 * `stripe_invoice_id` is UNIQUE and doubles as a second idempotency guard, so a
 * replayed `invoice.payment_succeeded` cannot insert a duplicate payment row
 * even if the event ledger were somehow bypassed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Keep the payment record if the subscription row is removed —
            // financial history must outlive the subscription it paid for.
            $table->foreignId('subscription_id')->nullable()
                ->constrained('subscriptions')->nullOnDelete();

            $table->string('stripe_invoice_id')->nullable()->unique();
            $table->string('stripe_payment_intent_id')->nullable();

            $table->unsignedInteger('amount_cents');
            $table->char('currency', 3)->default('USD');
            $table->enum('status', ['succeeded', 'failed', 'refunded', 'pending']);
            $table->string('failure_reason')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
