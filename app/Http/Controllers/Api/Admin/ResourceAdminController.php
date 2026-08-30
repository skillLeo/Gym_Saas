<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Resource;
use App\Models\ResourceCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

/**
 * Admin management of the resources library (§5.3).
 *
 * Uploads are validated on three axes — declared MIME, real extension, and
 * size — and land on the private disk. Checking only the MIME type is not
 * enough: it is client-supplied on the request and trivially spoofed.
 */
class ResourceAdminController extends Controller
{
    // ── Categories ────────────────────────────────────────────────────────

    public function categories(): JsonResponse
    {
        $categories = ResourceCategory::withCount('resources')->orderBy('sort_order')->get();

        return response()->json(['data' => $categories]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'icon_name'   => 'nullable|string|max:60',
            'sort_order'  => 'nullable|integer|min:0|max:9999',
            'is_active'   => 'nullable|boolean',
        ]);

        $data['slug'] = $this->uniqueSlug($data['name']);
        $data['icon_name'] ??= 'folder';

        return response()->json(['data' => ResourceCategory::create($data)], 201);
    }

    public function updateCategory(Request $request, ResourceCategory $resourceCategory): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'icon_name'   => 'nullable|string|max:60',
            'sort_order'  => 'nullable|integer|min:0|max:9999',
            'is_active'   => 'nullable|boolean',
        ]);

        $resourceCategory->update($data);

        return response()->json(['data' => $resourceCategory->fresh()]);
    }

    /**
     * Deactivate rather than delete when a category still holds resources —
     * the FK is RESTRICT, and silently orphaning content would be worse than
     * refusing.
     */
    public function destroyCategory(ResourceCategory $resourceCategory): JsonResponse
    {
        if ($resourceCategory->resources()->exists()) {
            $resourceCategory->update(['is_active' => false]);

            return response()->json([
                'message' => 'This category still holds resources, so it was hidden rather than deleted. Move or remove them first if you want it gone.',
                'data'    => $resourceCategory->fresh(),
            ]);
        }

        $resourceCategory->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    // ── Resources ─────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Resource::with('category:id,name,slug')->orderByDesc('id');

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        $resources = $query->paginate(30);

        return response()->json([
            'data' => collect($resources->items())->map(fn (Resource $r) => $this->formatAdmin($r)),
            'meta' => [
                'total' => $resources->total(),
                'last_page' => $resources->lastPage(),
                'current_page' => $resources->currentPage(),
                'limits' => $this->limits(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id'  => 'required|exists:resource_categories,id',
            'title'        => 'required|string|max:255',
            'description'  => 'nullable|string|max:5000',
            'type'         => ['required', Rule::in(['pdf', 'video', 'link'])],
            'external_url' => 'required_if:type,link|nullable|url|max:2000',
            'file'         => 'required_unless:type,link|nullable|file',
            'thumbnail'    => 'nullable|image|mimes:jpeg,jpg,png,webp|max:4096',
            'is_published' => 'nullable|boolean',
        ]);

        $resource = new Resource([
            'category_id'  => $data['category_id'],
            'title'        => $data['title'],
            'description'  => $data['description'] ?? null,
            'type'         => $data['type'],
            'external_url' => $data['type'] === 'link' ? $data['external_url'] : null,
            'is_published' => (bool) ($data['is_published'] ?? false),
            'created_by'   => $request->user()->id,
        ]);

        if ($data['type'] !== 'link') {
            $error = $this->attachFile($resource, $request->file('file'), $data['type']);

            if ($error) {
                return response()->json(['message' => $error, 'field' => 'file'], 422);
            }
        }

        if ($request->hasFile('thumbnail')) {
            $resource->thumbnail_path = $this->storeThumbnail($request->file('thumbnail'));
        }

        if ($resource->is_published) {
            $resource->published_at = now();
        }

        $resource->save();

        return response()->json(['data' => $this->formatAdmin($resource->fresh()->load('category:id,name'))], 201);
    }

    public function update(Request $request, Resource $resource): JsonResponse
    {
        $data = $request->validate([
            'category_id'  => 'required|exists:resource_categories,id',
            'title'        => 'required|string|max:255',
            'description'  => 'nullable|string|max:5000',
            'external_url' => 'nullable|url|max:2000',
            'file'         => 'nullable|file',
            'thumbnail'    => 'nullable|image|mimes:jpeg,jpg,png,webp|max:4096',
            'is_published' => 'nullable|boolean',
        ]);

        // Replacing the file is optional; the type never changes on edit,
        // because a PDF row becoming a video row would strand the old file.
        if ($request->hasFile('file') && $resource->type !== 'link') {
            $old   = $resource->file_path;
            $error = $this->attachFile($resource, $request->file('file'), $resource->type);

            if ($error) {
                return response()->json(['message' => $error, 'field' => 'file'], 422);
            }

            // Remove the superseded file only once the new one is stored.
            if ($old && $old !== $resource->file_path) {
                Storage::disk(Resource::DISK)->delete($old);
            }
        }

        if ($request->hasFile('thumbnail')) {
            $oldThumb = $resource->thumbnail_path;
            $resource->thumbnail_path = $this->storeThumbnail($request->file('thumbnail'));

            if ($oldThumb) {
                Storage::disk('public')->delete($oldThumb);
            }
        }

        $wasPublished = $resource->is_published;
        $resource->fill([
            'category_id'  => $data['category_id'],
            'title'        => $data['title'],
            'description'  => $data['description'] ?? null,
            'is_published' => (bool) ($data['is_published'] ?? $resource->is_published),
        ]);

        if ($resource->type === 'link' && array_key_exists('external_url', $data)) {
            $resource->external_url = $data['external_url'];
        }

        if (!$wasPublished && $resource->is_published) {
            $resource->published_at = now();
        }

        $resource->save();

        return response()->json(['data' => $this->formatAdmin($resource->fresh()->load('category:id,name'))]);
    }

    public function destroy(Resource $resource): JsonResponse
    {
        $path      = $resource->file_path;
        $thumbnail = $resource->thumbnail_path;

        $resource->delete();

        // Delete the files after the row, so a failed row delete never leaves a
        // resource pointing at a file that is already gone.
        if ($path) {
            Storage::disk(Resource::DISK)->delete($path);
        }
        if ($thumbnail) {
            Storage::disk('public')->delete($thumbnail);
        }

        return response()->json(['message' => 'Resource deleted.']);
    }

    private function formatAdmin(Resource $r): array
    {
        return [
            'id' => $r->id, 'title' => $r->title, 'description' => $r->description, 'type' => $r->type,
            'category' => $r->category?->only(['id', 'name']),
            'is_published' => $r->is_published, 'published_at' => $r->published_at,
            'file_size' => $r->file_size_label,
            'thumbnail_url' => $r->thumbnail_path ? asset('storage/' . $r->thumbnail_path) : null,
            'external_url' => $r->type === 'link' ? $r->external_url : null,
            'view_count' => $r->view_count, 'download_count' => $r->download_count,
        ];
    }

    /**
     * Thumbnails are non-sensitive preview images, so — unlike the resource
     * file itself — they live on the public disk and are served as a plain
     * URL, matching the pattern already used for avatars and post images
     * (`UploadController`): resized, re-encoded as JPEG, random filename.
     */
    private function storeThumbnail(UploadedFile $file): string
    {
        $manager = new ImageManager(new Driver());
        $image   = $manager->decode($file);

        if ($image->width() > 600 || $image->height() > 600) {
            $image->scaleDown(600, 600);
        }

        $filename = Str::uuid()->toString() . '.jpg';
        $path     = 'resource-thumbnails/' . $filename;

        Storage::disk('public')->put($path, (string) $image->encode(new \Intervention\Image\Encoders\JpegEncoder(quality: 85)));

        return $path;
    }

    /**
     * Validate and store an upload on the private disk.
     *
     * @return string|null a user-facing error, or null on success
     */
    private function attachFile(Resource $resource, $file, string $type): ?string
    {
        if (!$file || !$file->isValid()) {
            return 'The upload did not complete. Please try again.';
        }

        $ext  = strtolower($file->getClientOriginalExtension());
        $mime = $file->getMimeType();

        // Extension allowlist. Checked as well as the MIME type because the
        // MIME on the request is client-supplied and easily spoofed.
        if (!in_array($ext, Resource::ALLOWED_EXT[$type] ?? [], true)) {
            return sprintf(
                'That file type is not allowed here. Accepted: %s.',
                implode(', ', Resource::ALLOWED_EXT[$type] ?? []),
            );
        }

        if (!in_array($mime, Resource::ALLOWED_MIME[$type] ?? [], true)) {
            return sprintf('That file does not look like a valid %s (detected %s).', $type, $mime ?: 'unknown type');
        }

        $maxKb = Resource::MAX_KB[$type] ?? 0;
        if ($file->getSize() > $maxKb * 1024) {
            return sprintf('That file is too large. The limit for %ss is %d MB.', $type, (int) ($maxKb / 1024));
        }

        // Random stored name: the original filename is never used as a path, so
        // a crafted name cannot traverse directories or collide.
        $stored = Str::uuid()->toString() . '.' . $ext;
        $path   = $type . '/' . $stored;

        Storage::disk(Resource::DISK)->putFileAs($type, $file, $stored);

        $resource->file_path       = $path;
        $resource->file_size_bytes = $file->getSize();
        $resource->mime_type       = $mime;

        return null;
    }

    private function limits(): array
    {
        return collect(Resource::MAX_KB)->map(fn ($kb, $type) => [
            'max_mb'     => (int) ($kb / 1024),
            'extensions' => Resource::ALLOWED_EXT[$type] ?? [],
        ])->all();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $n    = 1;

        while (ResourceCategory::where('slug', $slug)->exists()) {
            $slug = $base . '-' . (++$n);
        }

        return $slug;
    }
}
