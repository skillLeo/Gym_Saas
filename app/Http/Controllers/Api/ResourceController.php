<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Resource;
use App\Models\ResourceCategory;
use App\Models\ResourceView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Member-facing resources library (§5.3).
 *
 * Files are never served from a public directory. `stream()` and `download()`
 * are the only ways to read one, and both check authentication and publication
 * state before touching the disk.
 */
class ResourceController extends Controller
{
    private const PER_PAGE = 24;

    public function categories(): JsonResponse
    {
        $categories = ResourceCategory::active()
            ->withCount(['resources' => fn ($q) => $q->published()])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'data' => $categories->map(fn (ResourceCategory $c) => [
                'id'             => $c->id,
                'name'           => $c->name,
                'slug'           => $c->slug,
                'description'    => $c->description,
                'icon_name'      => $c->icon_name,
                'resource_count' => $c->resources_count,
            ]),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => 'nullable|string|max:255',
            'type'     => 'nullable|in:pdf,video,link',
            'search'   => 'nullable|string|max:200',
            'page'     => 'nullable|integer|min:1',
        ]);

        // Only published resources are ever visible to members, whatever the
        // filters say.
        $query = Resource::published()->with('category:id,name,slug,icon_name');

        if (!empty($validated['category'])) {
            $query->whereHas('category', fn ($c) => $c->where('slug', $validated['category']));
        }

        if (!empty($validated['type'])) {
            $query->where('type', $validated['type']);
        }

        if (!empty($validated['search'])) {
            // Escaped, for the same reason as §5.5 and §5.6 — an unescaped `%`
            // would return the entire library.
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($validated['search'])) . '%';
            $query->where(fn ($q) => $q->where('title', 'like', $like)->orWhere('description', 'like', $like));
        }

        $results = $query->orderByDesc('published_at')->orderByDesc('id')
            ->paginate(self::PER_PAGE, ['*'], 'page', $validated['page'] ?? 1);

        return response()->json([
            'data' => collect($results->items())->map(fn (Resource $r) => $this->format($r)),
            'meta' => [
                'total'        => $results->total(),
                'current_page' => $results->currentPage(),
                'last_page'    => $results->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, Resource $resource): JsonResponse
    {
        if (!$resource->is_published) {
            // 404 rather than 403: an unpublished resource should not be
            // confirmed to exist.
            return response()->json(['message' => 'Not found.'], 404);
        }

        return response()->json(['data' => $this->format($resource->load('category:id,name,slug,icon_name'))]);
    }

    /**
     * Stream a file inline (PDF viewer, video player).
     */
    public function stream(Request $request, Resource $resource): StreamedResponse|JsonResponse
    {
        return $this->serve($request, $resource, 'view');
    }

    /**
     * Send a file as an attachment.
     */
    public function download(Request $request, Resource $resource): StreamedResponse|JsonResponse
    {
        return $this->serve($request, $resource, 'download');
    }

    /**
     * The single gate every file read passes through.
     *
     * Checks publication, that the resource actually has a file, and that the
     * file exists on the private disk — before recording the access and
     * streaming. Nothing here trusts a path from the request; the path comes
     * from the database row identified by route-model binding.
     */
    private function serve(Request $request, Resource $resource, string $action): StreamedResponse|JsonResponse
    {
        if (!$resource->is_published) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($resource->type === 'link' || blank($resource->file_path)) {
            return response()->json([
                'message' => 'This resource is a link and has no file to download.',
            ], 422);
        }

        $disk = Storage::disk(Resource::DISK);

        if (!$disk->exists($resource->file_path)) {
            // The row survived but the file did not — a real condition worth
            // logging rather than a 500 the member cannot act on.
            \Illuminate\Support\Facades\Log::error('Resource file missing from disk', [
                'resource_id' => $resource->id,
                'path'        => $resource->file_path,
            ]);

            return response()->json(['message' => 'This file is temporarily unavailable.'], 503);
        }

        $this->recordAccess($resource, $request->user()->id, $action);

        $filename = str($resource->title)->slug() . '.' . pathinfo($resource->file_path, PATHINFO_EXTENSION);

        return $disk->response(
            $resource->file_path,
            $filename,
            [
                'Content-Type' => $resource->mime_type ?? 'application/octet-stream',
                // Stops a browser from second-guessing the declared type, which
                // is how an uploaded file ends up executed as something else.
                'X-Content-Type-Options' => 'nosniff',
            ],
            $action === 'download' ? 'attachment' : 'inline',
        );
    }

    /**
     * Log the access and bump the counter.
     *
     * `increment()` is an atomic UPDATE rather than read-modify-write, so
     * concurrent views cannot lose counts.
     */
    private function recordAccess(Resource $resource, int $userId, string $action): void
    {
        DB::transaction(function () use ($resource, $userId, $action) {
            ResourceView::create([
                'resource_id' => $resource->id,
                'user_id'     => $userId,
                'action'      => $action,
            ]);

            $resource->increment($action === 'download' ? 'download_count' : 'view_count');
        });
    }

    private function format(Resource $r): array
    {
        return [
            'id'          => $r->id,
            'title'       => $r->title,
            'description' => $r->description,
            'type'        => $r->type,
            'category'    => $r->category?->only(['id', 'name', 'slug', 'icon_name']),
            // No file path is ever exposed. The client gets endpoints, not
            // locations, so there is nothing to guess at.
            'stream_url'   => $r->type === 'link' ? null : "/api/resources/{$r->id}/stream",
            'download_url' => $r->type === 'link' ? null : "/api/resources/{$r->id}/download",
            'external_url' => $r->type === 'link' ? $r->external_url : null,
            'thumbnail_url' => $r->thumbnail_path ? asset('storage/' . $r->thumbnail_path) : null,
            'file_size'      => $r->file_size_label,
            'duration_seconds' => $r->duration_seconds,
            'view_count'     => $r->view_count,
            'download_count' => $r->download_count,
            'published_at'   => $r->published_at,
        ];
    }
}
