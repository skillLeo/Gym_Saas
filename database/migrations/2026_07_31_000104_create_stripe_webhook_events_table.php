<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotency ledger for Stripe webhooks.
 *
 * Stripe guarantees *at-least-once* delivery, not exactly-once. The same event
 * can and does arrive more than once — on retry after a timeout, or during a
 * Stripe-side replay. Without this table a duplicate
 * `invoice.payment_succeeded` would extend a billing period twice and record
 * two payments for one charge.
 *
 * `stripe_event_id` is UNIQUE and that constraint is the actual idempotency
 * mechanism: the handler INSERTs first and lets the database reject duplicates.
 * A SELECT-then-INSERT check would leave a race window between the two queries,
 * which is exactly when concurrent retries arrive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stripe_webhook_events', function (Blueprint $table) {
            $table->id();

            // Stripe's `evt_...` ID — the idempotency key.
            $table->string('stripe_event_id')->unique();

            $table->string('type');
            $table->json('payload');
            $table->enum('status', ['pending', 'processed', 'failed'])->default('pending');
            $table->timestamp('processed_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_webhook_events');
    }
};
