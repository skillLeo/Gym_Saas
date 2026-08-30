<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Video;
use App\Models\VideoSave;
use Illuminate\Http\Request;

class VideoController extends Controller
{
    public function index(Request $request)
    {
        $query = Video::where('is_active', true);

        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($builder) use ($q) {
                $builder->where('title', 'like', "%{$q}%")
                        ->orWhere('description', 'like', "%{$q}%")
                        ->orWhere('instructor', 'like', "%{$q}%");
            });
        }
        if ($request->filled('category') && $request->category !== 'All') {
            $query->where('category', $request->category);
        }
        if ($request->filled('difficulty') && $request->difficulty !== 'All') {
            $query->where('difficulty', $request->difficulty);
        }
        if ($request->filled('muscle_group') && $request->muscle_group !== 'All') {
            $muscleGroup = $request->muscle_group;
            $query->whereJsonContains('muscle_groups', $muscleGroup);
        }

        $videos   = $query->orderByDesc('views')->get();
        $featured = Video::where('is_active', true)->where('is_featured', true)->first();

        $allMuscleGroups = Video::where('is_active', true)
            ->pluck('muscle_groups')
            ->filter()
            ->flatten()
            ->unique()
            ->sort()
            ->values();

        $savedIds = [];
        if ($request->user()) {
            $savedIds = \DB::table('video_saves')
                ->where('user_id', $request->user()->id)
                ->pluck('video_id')->toArray();
        }

        $formatted = $videos->map(fn($v) => $this->format($v, $savedIds));

        return response()->json([
            'videos'        => $formatted,
            'featured'      => $featured ? $this->format($featured, $savedIds) : null,
            'categories'    => Video::where('is_active', true)->distinct()->pluck('category')->sort()->values(),
            'muscle_groups' => $allMuscleGroups,
        ]);
    }

    /**
     * A small, public preview of the library for the marketing homepage.
     *
     * Deliberately unauthenticated: the homepage advertises "Free Fitness
     * Videos" and previously rendered a hardcoded array of four invented
     * titles and durations. This returns the real rows instead, so nothing on
     * the public page is fabricated.
     *
     * `video_url` is NOT included — the preview shows what exists, it does not
     * hand out the content itself, which is what the subscription pays for.
     */
    public function publicIndex(Request $request)
    {
        $videos = Video::where('is_active', true)
            ->whereNotNull('thumbnail_url')
            ->orderByDesc('is_featured')
            ->orderByDesc('views')
            ->limit(4)
            ->get();

        return response()->json([
            'videos' => $videos->map(fn (Video $v) => [
                'id'            => $v->id,
                'title'         => $v->title,
                'category'      => $v->category,
                'difficulty'    => $v->difficulty,
                'thumbnail_url' => $v->thumbnail_url,
                'duration'      => $this->formatDuration($v->duration_seconds),
            ]),
        ]);
    }

    public function show(Request $request, Video $video)
    {
        if (!$video->is_active) abort(404);
        $video->increment('views');
        $savedIds = $request->user()
            ? \DB::table('video_saves')->where('user_id', $request->user()->id)->pluck('video_id')->toArray()
            : [];
        return response()->json(['video' => $this->format($video->fresh(), $savedIds)]);
    }

    public function toggleSave(Request $request, Video $video)
    {
        $userId  = $request->user()->id;
        $exists  = \DB::table('video_saves')
            ->where('user_id', $userId)->where('video_id', $video->id)->exists();

        if ($exists) {
            \DB::table('video_saves')
                ->where('user_id', $userId)->where('video_id', $video->id)->delete();
            return response()->json(['action' => 'unsaved', 'is_saved' => false]);
        }
        \DB::table('video_saves')->insert([
            'user_id'    => $userId,
            'video_id'   => $video->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(['action' => 'saved', 'is_saved' => true]);
    }

    public function saved(Request $request)
    {
        $savedIds = \DB::table('video_saves')
            ->where('user_id', $request->user()->id)
            ->pluck('video_id')->toArray();
        $videos = Video::whereIn('id', $savedIds)->where('is_active', true)->get();
        $formatted = $videos->map(fn($v) => $this->format($v, $savedIds));
        return response()->json(['videos' => $formatted]);
    }

    // admin
    public function store(Request $request)
    {
        if (!$request->user()?->is_admin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $data = $request->validate([
            'title'            => 'required|string|max:255',
            'description'      => 'nullable|string',
            'video_url'        => 'nullable|url',
            'thumbnail_url'    => 'nullable|url',
            'duration_seconds' => 'nullable|integer',
            'category'         => 'required|string',
            'difficulty'       => 'required|in:Beginner,Intermediate,Advanced',
            'instructor'       => 'nullable|string',
            'tags'             => 'nullable|array',
            'muscle_groups'    => 'nullable|array',
            'equipment'        => 'nullable|array',
            'is_featured'      => 'boolean',
        ]);
        $data['duration_seconds'] = $data['duration_seconds'] ?? 0;
        $video = Video::create($data)->fresh();
        return response()->json(['video' => $this->format($video, [])], 201);
    }

    public function update(Request $request, Video $video)
    {
        if (!$request->user()?->is_admin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $data = $request->validate([
            'title'         => 'sometimes|string|max:255',
            'is_active'     => 'sometimes|boolean',
            'is_featured'   => 'sometimes|boolean',
            'category'      => 'sometimes|string',
            'difficulty'    => 'sometimes|in:Beginner,Intermediate,Advanced',
        ]);
        $video->update($data);
        return response()->json(['video' => $this->format($video->fresh(), [])]);
    }

    public function destroy(Request $request, Video $video)
    {
        if (!$request->user()?->is_admin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $video->update(['is_active' => false]);
        return response()->json(['message' => 'Video removed']);
    }

    private function format(Video $v, array $savedIds): array
    {
        return [
            'id'               => $v->id,
            'title'            => $v->title,
            'description'      => $v->description,
            'video_url'        => $v->video_url,
            'thumbnail_url'    => $v->thumbnail_url,
            'duration_seconds' => $v->duration_seconds,
            'duration'         => $this->formatDuration($v->duration_seconds),
            'category'         => $v->category,
            'tags'             => $v->tags ?? [],
            'muscle_groups'    => $v->muscle_groups ?? [],
            'equipment'        => $v->equipment ?? [],
            'difficulty'       => $v->difficulty,
            'instructor'       => $v->instructor,
            'views'            => $v->views,
            'likes'            => $v->likes,
            'is_featured'      => $v->is_featured,
            'is_active'        => $v->is_active,
            'is_saved'         => in_array($v->id, $savedIds),
            'created_at'       => $v->created_at,
        ];
    }

    private function formatDuration(?int $seconds): string
    {
        $seconds = $seconds ?? 0;
        $m = intdiv($seconds, 60);
        $s = $seconds % 60;
        return sprintf('%d:%02d', $m, $s);
    }
}
