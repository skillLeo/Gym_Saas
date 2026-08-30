<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links a user to their Stripe customer record.
 *
 * Created once on first checkout and reused for every subsequent subscription,
 * so a returning customer keeps one payment-method wallet and one billing
 * history in the Stripe dashboard instead of accumulating orphan customers.
 *
 * Indexed because webhooks arrive carrying a customer ID and must resolve it to
 * a user on every delivery.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('stripe_customer_id')->nullable()->after('subscription_status');
            $table->index('stripe_customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['stripe_customer_id']);
            $table->dropColumn('stripe_customer_id');
        });
    }
};
