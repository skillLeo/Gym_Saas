<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BetaAllowlist;
use App\Models\SystemSetting;
use Illuminate\Http\Request;

class BetaController extends Controller
{
    public function status(Request $request)
    {
        return response()->json([
            'invite_only_mode' => SystemSetting::get('invite_only_mode') === '1',
        ]);
    }

    public function toggle(Request $request)
    {
        $data = $request->validate(['invite_only_mode' => 'required|boolean']);
        SystemSetting::set('invite_only_mode', $data['invite_only_mode'] ? '1' : '0', 'beta');

        return response()->json(['invite_only_mode' => $data['invite_only_mode']]);
    }

    public function index(Request $request)
    {
        return response()->json(
            BetaAllowlist::with('inviter:id,name')->orderByDesc('created_at')->paginate(50)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255|unique:beta_allowlist,email',
            'note'  => 'nullable|string|max:255',
        ]);

        $entry = BetaAllowlist::create($data + ['invited_by' => $request->user()->id]);

        return response()->json(['entry' => $entry], 201);
    }

    public function destroy(Request $request, BetaAllowlist $betaAllowlist)
    {
        $betaAllowlist->delete();

        return response()->json(['message' => 'Removed from the allowlist.']);
    }
}
