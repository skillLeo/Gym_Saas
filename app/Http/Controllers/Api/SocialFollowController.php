<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Follow;
use App\Models\User;
use Illuminate\Http\Request;

class SocialFollowController extends Controller
{
    private function publicUser(User $u, int $authId): array
    {
        $followersCount = Follow::where('following_id', $u->id)->count();
        $followingCount = Follow::where('follower_id',  $u->id)->count();
        $isFollowing = Follow::where('follower_id', $authId)->where('following_id', $u->id)->exists();

        return [
            'id'              => $u->id,
            'name'            => $u->name,
            'username'        => $u->username,
            'avatar_url'      => $u->avatar_url,
            'bio'             => $u->bio,
            'primary_goal'    => $u->primary_goal,
            'is_following'    => $isFollowing,
            'followers_count' => $followersCount,
            'following_count' => $followingCount,
        ];
    }

    public function toggle(Request $request, int $userId)
    {
        $authId = $request->user()->id;

        if ($authId === $userId) {
            return response()->json(['success' => false, 'error' => 'Cannot follow yourself.'], 422);
        }

        $target = User::findOrFail($userId);
        $existing = Follow::where('follower_id', $authId)->where('following_id', $userId)->first();

        if ($existing) {
            $existing->delete();
            $action = 'unfollowed';
        } else {
            Follow::create(['follower_id' => $authId, 'following_id' => $userId]);
            $action = 'followed';
            app(\App\Services\SocialNotifier::class)->followed($request->user(), $userId);
        }

        return response()->json([
            'success'      => true,
            'action'       => $action,
            'is_following' => $action === 'followed',
            'followers_count' => Follow::where('following_id', $userId)->count(),
        ]);
    }

    public function following(Request $request)
    {
        $authId = $request->user()->id;
        $targetId = $request->filled('username')
            ? User::where('username', $request->username)->firstOrFail()->id
            : $authId;
        $followingIds = Follow::where('follower_id', $targetId)->pluck('following_id');
        $users = User::whereIn('id', $followingIds)->get();
        return response()->json(['success' => true, 'data' => $users->map(fn($u) => $this->publicUser($u, $authId))]);
    }

    public function followers(Request $request)
    {
        $authId = $request->user()->id;
        $targetId = $request->filled('username')
            ? User::where('username', $request->username)->firstOrFail()->id
            : $authId;
        $followerIds = Follow::where('following_id', $targetId)->pluck('follower_id');
        $users = User::whereIn('id', $followerIds)->get();
        return response()->json(['success' => true, 'data' => $users->map(fn($u) => $this->publicUser($u, $authId))]);
    }

    public function suggestions(Request $request)
    {
        $authId = $request->user()->id;
        $followingIds = Follow::where('follower_id', $authId)->pluck('following_id');

        $users = User::where('id', '!=', $authId)
            ->whereNotIn('id', $followingIds)
            ->inRandomOrder()
            ->limit(20)
            ->get();

        return response()->json(['success' => true, 'data' => $users->map(fn($u) => $this->publicUser($u, $authId))]);
    }

    public function search(Request $request)
    {
        $q      = $request->input('q', '');
        $authId = $request->user()->id;

        // Searches display name, username, nickname and every recorded alias —
        // maiden names, previous names — all resolving to the same profile
        // (§5.6). The wildcards are escaped inside the scope, which the previous
        // inline version did not do: a `%` typed into the box matched everyone.
        $users = User::where('id', '!=', $authId)
            ->searchByAnyName($q)
            ->limit(30)
            ->get();

        return response()->json(['success' => true, 'data' => $users->map(fn($u) => $this->publicUser($u, $authId))]);
    }

    public function profile(Request $request, string $username)
    {
        $authId = $request->user()->id;
        $user   = User::where('username', $username)->firstOrFail();
        return response()->json(['success' => true, 'data' => $this->publicUser($user, $authId)]);
    }
}
