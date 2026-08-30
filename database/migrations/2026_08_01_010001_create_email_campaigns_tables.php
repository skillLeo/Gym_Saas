<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->longText('body_html');
            $table->enum('audience', ['all', 'trial', 'subscribers', 'inactive_days']);
            $table->json('audience_params')->nullable();
            $table->enum('status', ['draft', 'scheduled', 'sending', 'sent', 'failed'])->default('draft');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->unsignedInteger('recipient_count')->default(0);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['status', 'scheduled_at']);
        });

        Schema::create('email_campaign_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('email_campaigns')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->string('error')->nullable();

            $table->unique(['campaign_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_campaign_recipients');
        Schema::dropIfExists('email_campaigns');
    }
};
