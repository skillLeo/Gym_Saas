<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContentFlag;
use App\Models\FlagKeyword;
use App\Models\PostComment;
use App\Models\SocialPost;
use Illuminate\Http\Request;

/**
 * §6.4 admin surface.
 *
 * `dismiss` clears the flag and deliberately leaves the content alone — the
 * moderator judged it acceptable.
 *
 * `escalate` REMOVES the content. It previously only relabelled the flag and
 * left the post up, which meant a moderator could act on abuse, watch the
 * status change, and never notice that every member could still read it. If
 * escalating should stop short of removal again, give the admin a separate
 * control for taking content down — do not quietly return this one to a
 * status-only action.
 */
class ContentFlagController extends Controller
{
    public function index(Request $request)
    {
        $query = ContentFlag::with(['reporter:id,name', 'reviewer:id,name'])
            ->orderByRaw("FIELD(status, 'pending') DESC")
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $flags = $query->paginate(20);

        $flags->getCollection()->transform(function (ContentFlag $flag) {
            // Neither SocialPost nor PostComment use SoftDeletes — a plain
            // find() returning null means the content was hard-deleted since
            // it was flagged, which is itself worth showing the admin rather
            // than erroring the whole queue.
            $content = $flag->flaggable_type === 'post'
                ? SocialPost::with('user:id,name,avatar')->find($flag->flaggable_id)
                : PostComment::with('user:id,name,avatar')->find($flag->flaggable_id);

            return [
                'id'             => $flag->id,
                'type'           => $flag->flaggable_type,
                'reason'         => $flag->reason,
                'matched_terms'  => $flag->matched_terms,
                'severity'       => $flag->severity,
                'status'         => $flag->status,
                'reported_by'    => $flag->reporter?->name,
                'reviewed_by'    => $flag->reviewer?->name,
                'notes'          => $flag->notes,
                'created_at'     => $flag->created_at,
                'content'        => $content ? [
                    'id'     => $content->id,
                    'body'   => $content->content,
                    'author' => $content->user?->name,
                ] : null,
            ];
        });

        return response()->json($flags);
    }

    public function pendingCount(Request $request)
    {
        return response()->json(['pending_count' => ContentFlag::where('status', 'pending')->count()]);
    }

    public function dismiss(Request $request, ContentFlag $contentFlag)
    {
        $data = $request->validate(['notes' => 'nullable|string|max:1000']);
        $contentFlag->update([
            'status'      => 'dismissed',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'notes'       => $data['notes'] ?? null,
        ]);

        return response()->json(['flag' => $contentFlag->fresh()]);
    }

    /**
     * Act on flagged content: take it down, and record that we did.
     *
     * This used to set the status to "actioned" and stop there. The offending
     * post stayed visible to every member, so a moderator pressed Escalate, saw
     * the label change, and reasonably believed the content had been dealt with
     * when nothing had happened to it. The client found exactly that.
     *
     * Two things to know before changing this:
     *   - `flaggable_type` holds 'post'/'comment', not a class name, so the
     *     morphTo relation does not resolve. Look the row up the same way
     *     index() does, or this silently removes nothing.
     *   - Neither model uses SoftDeletes, so this removal is PERMANENT. The
     *     response says so plainly rather than implying it can be undone.
     */
    public function escalate(Request $request, ContentFlag $contentFlag)
    {
        $data = $request->validate(['notes' => 'nullable|string|max:1000']);

        $content = $contentFlag->flaggable_type === 'post'
            ? SocialPost::find($contentFlag->flaggable_id)
            : PostComment::find($contentFlag->flaggable_id);

        $removed = false;

        if ($content) {
            $content->delete();
            $removed = true;
        }

        $contentFlag->update([
            'status'      => 'actioned',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'notes'       => $data['notes'] ?? null,
        ]);

        return response()->json([
            'flag'            => $contentFlag->fresh(),
            'content_removed' => $removed,
            // Said plainly so the UI can tell the moderator what actually
            // happened, rather than implying an action that did not occur.
            'message'         => $removed
                ? 'Content permanently removed. Members can no longer see it.'
                : 'That content no longer exists; the flag has been closed.',
        ]);
    }

    // ── Keyword management ──────────────────────────────────────────────

    public function keywords(Request $request)
    {
        return response()->json(['keywords' => FlagKeyword::orderBy('term')->get()]);
    }

    public function storeKeyword(Request $request)
    {
        $data = $request->validate([
            'term'     => 'required|string|max:255',
            'severity' => 'required|in:low,medium,high',
        ]);

        $keyword = FlagKeyword::create($data + ['is_active' => true]);

        return response()->json(['keyword' => $keyword], 201);
    }

    public function updateKeyword(Request $request, FlagKeyword $flagKeyword)
    {
        $data = $request->validate([
            'term'      => 'sometimes|string|max:255',
            'severity'  => 'sometimes|in:low,medium,high',
            'is_active' => 'sometimes|boolean',
        ]);
        $flagKeyword->update($data);

        return response()->json(['keyword' => $flagKeyword->fresh()]);
    }

    public function destroyKeyword(Request $request, FlagKeyword $flagKeyword)
    {
        $flagKeyword->delete();

        return response()->json(['message' => 'Keyword removed.']);
    }
}
