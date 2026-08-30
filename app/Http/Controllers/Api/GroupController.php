<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Group;
use Illuminate\Http\Request;

class GroupController extends Controller
{
    private function format(Group $g, int $authId): array
    {
        return [
            'id'          => $g->id,
            'name'        => $g->name,
            'description' => $g->description,
            'cover_color' => $g->cover_color,
            'status'      => $g->status,
            'rejection_reason' => $g->rejection_reason,
            'member_count'=> $g->members()->count(),
            'is_member'   => $g->members()->where('user_id', $authId)->exists(),
            'is_creator'  => $g->creator_id === $authId,
            'creator'     => ['id' => $g->creator->id, 'name' => $g->creator->name],
            'created_at'  => $g->created_at,
        ];
    }

    // Approved groups, optionally filtered to only groups a member belongs to.
    // `mine=true` defaults to the caller, but a profile page viewing someone
    // else needs that OTHER member's memberships, not its own — passing
    // `username` scopes "mine" to them instead.
    public function index(Request $request)
    {
        $authId = $request->user()->id;
        $query = Group::where('status', 'approved');

        if ($request->boolean('mine')) {
            $targetId = $authId;
            if ($request->filled('username')) {
                $targetId = \App\Models\User::where('username', $request->string('username'))->value('id') ?? $authId;
            }
            $query->whereHas('members', fn($q) => $q->where('user_id', $targetId));
        }

        $groups = $query->orderByDesc('created_at')->get();
        return response()->json(['success' => true, 'data' => $groups->map(fn($g) => $this->format($g, $authId))]);
    }

    // Groups the requesting user created that are still pending/rejected (so they can see their own submission status)
    public function mine(Request $request)
    {
        $authId = $request->user()->id;
        $groups = Group::where('creator_id', $authId)->orderByDesc('created_at')->get();
        return response()->json(['success' => true, 'data' => $groups->map(fn($g) => $this->format($g, $authId))]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'cover_color' => 'nullable|string|max:20',
        ]);

        $group = Group::create(array_merge($validated, [
            'creator_id' => $request->user()->id,
            'status'     => 'pending',
        ]));
        $group->members()->attach($request->user()->id);

        return response()->json([
            'success' => true,
            'data'    => $this->format($group, $request->user()->id),
            'message' => 'Your group has been submitted and is awaiting admin approval.',
        ], 201);
    }

    public function join(Request $request, Group $group)
    {
        if ($group->status !== 'approved') {
            return response()->json(['success' => false, 'error' => 'This group is not yet approved.'], 422);
        }
        $group->members()->syncWithoutDetaching([$request->user()->id]);
        return response()->json(['success' => true, 'message' => 'Joined group!']);
    }

    public function leave(Request $request, Group $group)
    {
        $group->members()->detach($request->user()->id);
        return response()->json(['success' => true, 'message' => 'Left group.']);
    }

    // Admin: list all pending groups
    public function pending(Request $request)
    {
        if (!$request->user()->is_admin) {
            return response()->json(['success' => false, 'error' => 'Forbidden'], 403);
        }
        $groups = Group::where('status', 'pending')->orderBy('created_at')->get();
        return response()->json(['success' => true, 'data' => $groups->map(fn($g) => $this->format($g, $request->user()->id))]);
    }

    public function approve(Request $request, Group $group)
    {
        if (!$request->user()->is_admin) {
            return response()->json(['success' => false, 'error' => 'Forbidden'], 403);
        }
        $group->update(['status' => 'approved', 'rejection_reason' => null]);

        // Tell the creator. Without this the decision was invisible to them —
        // they had to keep re-opening their profile to find out.
        \App\Models\Notification::create([
            'user_id' => $group->creator_id,
            'type'    => 'group_approved',
            'title'   => 'Your group was approved',
            'body'    => "\"{$group->name}\" is now live. Members can find and join it.",
            'data'    => ['group_id' => $group->id],
            'link'    => '/social',
        ]);

        return response()->json(['success' => true, 'message' => 'Group approved.']);
    }

    public function reject(Request $request, Group $group)
    {
        if (!$request->user()->is_admin) {
            return response()->json(['success' => false, 'error' => 'Forbidden'], 403);
        }
        $validated = $request->validate(['reason' => 'nullable|string|max:500']);
        $group->update(['status' => 'rejected', 'rejection_reason' => $validated['reason'] ?? null]);

        \App\Models\Notification::create([
            'user_id' => $group->creator_id,
            'type'    => 'group_rejected',
            'title'   => 'Your group was not approved',
            'body'    => filled($validated['reason'] ?? null)
                ? "\"{$group->name}\": {$validated['reason']}"
                : "\"{$group->name}\" was not approved. Message us if you would like to know more.",
            'data'    => ['group_id' => $group->id],
            'link'    => '/social',
        ]);
        return response()->json(['success' => true, 'message' => 'Group rejected.']);
    }
}
