<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminShadowAccount;
use App\Models\User;
use App\Services\UserAccountState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Undercover admin accounts (§E3). The created `User` is otherwise completely
 * ordinary — same table, same columns, `is_admin` left false — so it browses
 * and behaves exactly like a member account everywhere else in the app. The
 * *only* place the "this is admin-controlled" fact exists is the
 * `admin_shadow_accounts` row, which nothing member-facing ever queries.
 * `is_admin` is deliberately NOT set true here: an undercover account with
 * real admin privileges would be a much bigger blast radius than the feature
 * calls for, and would risk `EnsureAdmin`-gated UI leaking through if the
 * frontend ever branches on `user.is_admin`.
 */
class UndercoverController extends Controller
{
    public function index(Request $request)
    {
        $accounts = AdminShadowAccount::with('user:id,name,email,avatar,created_at', 'createdByAdmin:id,name')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['accounts' => $accounts]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'label'    => 'required|string|max:255',
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
        ]);
        $user->forceFill(['email_verified_at' => now(), 'onboarding_completed' => true])->save();
        app(UserAccountState::class)->startTrial($user);

        $shadow = AdminShadowAccount::create([
            'user_id'             => $user->id,
            'created_by_admin_id' => $request->user()->id,
            'label'               => $data['label'],
            'is_active'           => true,
        ]);

        return response()->json(['account' => $shadow->load('user:id,name,email,avatar')], 201);
    }

    public function update(Request $request, AdminShadowAccount $account)
    {
        $data = $request->validate(['is_active' => 'required|boolean']);
        $account->update($data);

        return response()->json(['account' => $account->fresh()]);
    }

    /** Removes the shadow flag only — never the underlying member account. */
    public function destroy(Request $request, AdminShadowAccount $account)
    {
        $account->delete();

        return response()->json(['message' => 'Undercover flag removed. The account itself was not deleted.']);
    }
}
