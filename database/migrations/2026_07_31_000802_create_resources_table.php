<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PDFs, videos and links in the resources library (§5.3).
 *
 * `file_path` is a path inside the PRIVATE disk, never a public URL. Files are
 * streamed by an authenticated controller so a resource cannot be reached by
 * guessing a path — a hard requirement of the brief, not a preference.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resources', function (Blueprint $table) {
            $table->id();
            // RESTRICT: a category holding resources must not be deletable out
            // from under them. Deactivate it instead.
            $table->foreignId('category_id')->constrained('resource_categories')->restrictOnDelete();

            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('type', ['pdf', 'video', 'link']);

            $table->string('file_path')->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();
            $table->string('mime_type')->nullable();
            $table->string('external_url')->nullable();
            $table->string('thumbnail_path')->nullable();
            $table->integer('duration_seconds')->nullable();

            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('download_count')->default(0);

            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['category_id', 'is_published']);
            $table->index('published_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resources');
    }
};
