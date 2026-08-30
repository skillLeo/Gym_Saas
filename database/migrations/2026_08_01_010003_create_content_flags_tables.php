<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flag_keywords', function (Blueprint $table) {
            $table->id();
            $table->string('term');
            $table->enum('severity', ['low', 'medium', 'high']);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('content_flags', function (Blueprint $table) {
            $table->id();
            $table->string('flaggable_type');
            $table->unsignedBigInteger('flaggable_id');
            $table->enum('reason', ['keyword', 'user_report']);
            $table->json('matched_terms')->nullable();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('severity', ['low', 'medium', 'high']);
            $table->enum('status', ['pending', 'reviewed', 'dismissed', 'actioned'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['flaggable_type', 'flaggable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_flags');
        Schema::dropIfExists('flag_keywords');
    }
};
