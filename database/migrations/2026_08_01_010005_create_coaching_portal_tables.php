<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Coaching portal (§E5) — the most security-critical schema in the app.
 *
 * `physicians` is deliberately its own table, not a role on `users`: a
 * physician must never be able to authenticate through the member login path
 * or inherit any member capability by accident. See `config/auth.php` for the
 * separate `physician` guard this table backs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('physicians', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('practice_name');
            $table->string('practice_phone');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('coaching_authorizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('users')->cascadeOnDelete();
            $table->string('physician_name');
            $table->string('practice_name');
            $table->string('practice_address');
            $table->string('practice_phone');
            $table->string('representative_name');
            $table->string('representative_email');
            $table->enum('status', ['pending', 'approved', 'rejected', 'revoked'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->foreignId('physician_id')->nullable()->constrained('physicians')->nullOnDelete();
            // Raw invite token is emailed once and never stored — only its hash,
            // so a leaked database dump cannot be used to mint portal access.
            $table->string('invite_token_hash')->nullable();
            $table->timestamp('invite_expires_at')->nullable();
            $table->timestamp('authorized_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['member_id', 'status']);
            $table->index(['physician_id', 'status']);
        });

        Schema::create('physician_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coaching_authorization_id')->constrained('coaching_authorizations')->cascadeOnDelete();
            $table->enum('sender_type', ['physician', 'admin']);
            $table->unsignedBigInteger('sender_id');
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['coaching_authorization_id', 'created_at']);
        });

        // Audit trail — written on every physician data access, per §6.5.3.
        // Append-only by convention (nothing in the app ever updates or deletes
        // a row here); no soft deletes, no updated_at needed.
        Schema::create('coaching_access_log', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('physician_id');
            $table->unsignedBigInteger('coaching_authorization_id');
            $table->unsignedBigInteger('member_id');
            $table->string('endpoint');
            $table->string('ip')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['physician_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coaching_access_log');
        Schema::dropIfExists('physician_messages');
        Schema::dropIfExists('coaching_authorizations');
        Schema::dropIfExists('physicians');
    }
};
