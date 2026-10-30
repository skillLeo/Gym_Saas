<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-member AI access and consent.
 *
 * OFF for everyone, including existing members. The client wants to switch it
 * on for himself first and watch the cost before anyone else can spend money
 * on his behalf, so "off" has to be the state the column is born in — a
 * default of true here would silently enable it for the entire member base the
 * moment this migration ran.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('ai_features_enabled')->default(false)->after('locale');

            /*
             * Consent is a timestamp plus the version of the notice that was
             * shown, not a boolean. A boolean cannot answer "did they agree to
             * THIS wording", so rewording the notice would leave us claiming
             * agreement to text nobody read.
             */
            $table->timestamp('ai_consent_at')->nullable()->after('ai_features_enabled');
            $table->string('ai_consent_version', 16)->nullable()->after('ai_consent_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['ai_features_enabled', 'ai_consent_at', 'ai_consent_version']);
        });
    }
};
