<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\FoodLogEntry;
use App\Services\UserAccountState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

class AdminController extends Controller
{
    private function assertAdmin(Request $request): void
    {
        if (!$request->user()?->is_admin) {
            abort(403, 'Super admin access required.');
        }
    }

    public function getSettings(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        return response()->json([
            'success' => true,
            'data' => [
                'smtp'        => SystemSetting::getGroup('smtp'),
                'nutritionix' => SystemSetting::getGroup('nutritionix'),
            ],
        ]);
    }

    public function updateSmtp(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        $v = $request->validate([
            'mail_host'         => 'required|string|max:255',
            'mail_port'         => 'required|integer|min:1|max:65535',
            'mail_username'     => 'nullable|string|max:255',
            'mail_password'     => 'nullable|string|max:255',
            'mail_encryption'   => 'nullable|in:tls,ssl,starttls,null',
            'mail_from_address' => 'required|email|max:255',
            'mail_from_name'    => 'required|string|max:255',
        ]);
        foreach ($v as $key => $value) {
            // getGroup() masks secrets as '••••••••' when the settings are read
            // back, so a save that follows a load would otherwise write the
            // mask string in as the real password. Treat the mask (and an empty
            // field) as "leave the stored value alone".
            if ($key === 'mail_password' && (blank($value) || $value === SystemSetting::MASK)) {
                continue;
            }
            SystemSetting::set($key, $value, 'smtp', $key === 'mail_password');
        }
        return response()->json(['success' => true, 'message' => 'SMTP settings saved.']);
    }

    public function updateNutritionix(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        $v = $request->validate([
            'nutritionix_app_id'  => 'required|string|max:255',
            'nutritionix_app_key' => 'required|string|max:255',
        ]);
        SystemSetting::set('nutritionix_app_id', $v['nutritionix_app_id'], 'nutritionix', false);

        // Same masking hazard as the SMTP password — never write the mask back.
        if ($v['nutritionix_app_key'] !== SystemSetting::MASK) {
            SystemSetting::set('nutritionix_app_key', $v['nutritionix_app_key'], 'nutritionix', true);
        }
        return response()->json(['success' => true, 'message' => 'Nutritionix API keys saved.']);
    }

    public function testSmtp(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        $to = $request->validate(['email' => 'required|email'])['email'];
        try {
            $smtp = SystemSetting::getRaw('smtp');

            /**
             * Fall back to the .env-backed config for anything the saved
             * settings do not supply.
             *
             * This matters most for the password. The admin form is routinely
             * saved without one (the field is masked on read, so it comes back
             * blank), which left this endpoint authenticating with a NULL
             * password. The test then failed even though the application's real
             * mail — which uses .env — was working perfectly, making it look
             * like SMTP was broken when it was not.
             *
             * The test now exercises the configuration that actually sends
             * mail, which is the only thing a "test connection" button is
             * worth anything for.
             */
            $pick = fn (string $key, string $configKey) =>
                filled($smtp[$key] ?? null) ? $smtp[$key] : config($configKey);

            if (!empty($smtp['mail_host'])) {
                config([
                    'mail.mailers.smtp.host'       => $smtp['mail_host'],
                    'mail.mailers.smtp.port'       => $pick('mail_port', 'mail.mailers.smtp.port'),
                    'mail.mailers.smtp.username'   => $pick('mail_username', 'mail.mailers.smtp.username'),
                    'mail.mailers.smtp.password'   => $pick('mail_password', 'mail.mailers.smtp.password'),
                    'mail.mailers.smtp.encryption' => $pick('mail_encryption', 'mail.mailers.smtp.encryption'),
                    'mail.from.address'            => $pick('mail_from_address', 'mail.from.address'),
                    'mail.from.name'               => $pick('mail_from_name', 'mail.from.name'),
                ]);
            }
            Mail::raw('Test email from My EXtreme Trainer admin panel. SMTP is configured correctly!', function ($msg) use ($to) {
                $msg->to($to)->subject('My EXtreme Trainer — SMTP Test');
            });
            return response()->json(['success' => true, 'message' => "Test email sent to {$to}."]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
        }
    }

    public function testNutritionix(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        $appId  = SystemSetting::get('nutritionix_app_id',  env('NUTRITIONIX_APP_ID'));
        $appKey = SystemSetting::get('nutritionix_app_key', env('NUTRITIONIX_APP_KEY'));
        if (!$appId || !$appKey) {
            return response()->json(['success' => false, 'error' => 'API keys not configured yet.'], 422);
        }
        try {
            $res = Http::withHeaders([
                'x-app-id'  => $appId,
                'x-app-key' => $appKey,
            ])->timeout(10)->get('https://trackapi.nutritionix.com/v2/search/instant', ['query' => 'chicken']);
            if ($res->successful()) {
                return response()->json(['success' => true, 'message' => 'Nutritionix API keys are valid ✓']);
            }
            return response()->json(['success' => false, 'error' => "API returned HTTP {$res->status()}. Check your keys."], 422);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
        }
    }

    // ── Dashboard Stats ──────────────────────────────────────────────────────

    public function stats(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);

        $totalUsers      = User::count();
        $newThisWeek     = User::where('created_at', '>=', now()->subDays(7))->count();
        $activeThisMonth = User::where('created_at', '>=', now()->subDays(30))->count();
        $totalFoodLogs   = FoodLogEntry::count();
        $totalWorkouts   = DB::table('fitness_logs')->count();
        $totalPosts      = DB::table('social_posts')->count();

        $usersByMonth = User::selectRaw('DATE_FORMAT(created_at, "%Y-%m") as month, COUNT(*) as count')
            ->where('created_at', '>=', now()->subMonths(6))
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        // Growth-over-time for each platform metric named in the brief (§E1),
        // same 6-month window and grouping as users_by_month above so the
        // frontend can render them on matching axes.
        $growth = fn (string $table, string $dateColumn = 'created_at') => DB::table($table)
            ->selectRaw("DATE_FORMAT($dateColumn, \"%Y-%m\") as month, COUNT(*) as count")
            ->where($dateColumn, '>=', now()->subMonths(6))
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $postsByMonth     = $growth('social_posts');
        $foodLogsByMonth  = $growth('food_log_entries');
        $workoutsByMonth  = $growth('fitness_logs');

        // Counts read `account_state`, the source of truth, not the legacy
        // `subscription_status` mirror.
        $trialUsers = User::where('account_state', UserAccountState::TRIAL)->count();
        $paidUsers  = User::where('account_state', UserAccountState::SUBSCRIBER)->count();

        // Churn is someone who *paid and left* — a trial that never converted
        // is a lost lead, not churn, and lumping them together makes the number
        // meaningless. Requires a subscription record to have existed.
        $churnedUsers = User::whereIn('account_state', [UserAccountState::GRACE, UserAccountState::DEACTIVATED])
            ->whereHas('subscriptions')
            ->count();

        return response()->json([
            'total_users'       => $totalUsers,
            'new_this_week'     => $newThisWeek,
            'active_this_month' => $activeThisMonth,
            'total_food_logs'   => $totalFoodLogs,
            'total_workouts'    => $totalWorkouts,
            'total_posts'       => $totalPosts,
            'trial_users'       => $trialUsers,
            'paid_users'        => $paidUsers,
            'churned_users'     => $churnedUsers,
            'users_by_month'    => $usersByMonth,
            'posts_by_month'    => $postsByMonth,
            'food_logs_by_month'=> $foodLogsByMonth,
            'workouts_by_month' => $workoutsByMonth,
            // Real revenue and MRR now live in Admin\RevenueController — this
            // endpoint no longer invents a number by multiplying user count by
            // a hardcoded price (that line has been removed, not fixed in
            // place, so nothing still reads a fabricated `total_revenue` here).
        ]);
    }

    // ── User Management ──────────────────────────────────────────────────────

    /**
     * Search + filter by real account state (§E1) — trial, subscriber, grace
     * (the brief calls this "expired"), deactivated. The previous "new"/
     * "active" split was a 7-day-old heuristic with no relationship to
     * whether someone is actually paying; kept as an additional `recent`
     * filter since the frontend's existing "new" chip is genuinely useful,
     * but it no longer stands in for account state.
     */
    public function users(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);

        $query = User::query();
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(fn($b) => $b->where('name', 'like', "%{$q}%")
                ->orWhere('email', 'like', "%{$q}%")
                ->orWhere('username', 'like', "%{$q}%"));
        }
        if ($request->filled('status')) {
            // ->string() returns a Stringable, not a plain string — the strict
            // in_array() below silently matched nothing against it (a
            // Stringable is never === to a string), so this filter did
            // nothing at all until caught by testing it against real data.
            $status = (string) $request->query('status');
            if ($status === 'expired') {
                $query->where('account_state', UserAccountState::GRACE);
            } elseif (in_array($status, [UserAccountState::TRIAL, UserAccountState::SUBSCRIBER, UserAccountState::DEACTIVATED], true)) {
                $query->where('account_state', $status);
            } elseif ($status === 'new') {
                $query->where('created_at', '>=', now()->subDays(7));
            }
        }

        $paginated = $query->orderByDesc('created_at')->paginate(20);
        $paginated->getCollection()->transform(fn($u) => [
            'id'            => $u->id,
            'name'          => $u->name,
            'email'         => $u->email,
            'avatar'        => $u->avatar_url,
            'created_at'    => $u->created_at,
            'account_state' => $u->account_state,
            'is_admin'      => (bool) $u->is_admin,
        ]);

        return response()->json($paginated);
    }

    /** Full profile for the admin's single-user detail screen. */
    public function show(Request $request, User $user): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);

        return response()->json(['user' => [
            'id'                   => $user->id,
            'name'                 => $user->name,
            'username'             => $user->username,
            'email'                => $user->email,
            'avatar'               => $user->avatar_url,
            'bio'                  => $user->bio,
            'created_at'           => $user->created_at,
            'email_verified_at'    => $user->email_verified_at,
            'account_state'        => $user->account_state,
            'is_admin'             => (bool) $user->is_admin,
            'onboarding_completed' => (bool) $user->onboarding_completed,
            'trial_starts_at'      => $user->trial_starts_at,
            'trial_ends_at'        => $user->trial_ends_at,
            'deactivated_at'       => $user->deactivated_at,
            'scheduled_deletion_at'=> $user->scheduled_deletion_at,
            'active_subscription'  => $user->activeSubscription(),
            'stats' => [
                'food_logs' => FoodLogEntry::where('user_id', $user->id)->count(),
                'workouts'  => DB::table('fitness_logs')->where('user_id', $user->id)->count(),
                'posts'     => DB::table('social_posts')->where('user_id', $user->id)->count(),
            ],
        ]]);
    }

    public function recentUsers(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        $users = User::orderByDesc('created_at')->limit(10)->get(['id','name','email','avatar','created_at']);
        $mapped = $users->map(fn($u) => [
            'id'         => $u->id,
            'name'       => $u->name,
            'email'      => $u->email,
            'avatar'     => $u->avatar_url,
            'created_at' => $u->created_at,
        ]);
        return response()->json(['users' => $mapped]);
    }

    public function updateUser(Request $request, User $user): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'name'          => 'sometimes|string|max:255',
            'email'         => 'sometimes|email|unique:users,email,'.$user->id,
            'is_admin'      => 'sometimes|boolean',
            'account_state' => 'sometimes|in:trial,subscriber,grace,deactivated',
        ]);

        // is_admin and account_state are both excluded from $fillable
        // deliberately (see User.php) — forceFill so an admin action can still
        // reach them, same pattern already used everywhere else this touches.
        $forced = [];
        if (isset($data['is_admin'])) {
            $forced['is_admin'] = $data['is_admin'];
            unset($data['is_admin']);
        }
        if (isset($data['account_state'])) {
            $forced['account_state'] = $data['account_state'];
            // Deactivating manually starts the same retention clock the
            // automatic path uses, so a manually deactivated account is
            // scheduled for eventual deletion exactly like one that lapsed
            // naturally — not a silent exception to that policy.
            if ($data['account_state'] === UserAccountState::DEACTIVATED && ! $user->scheduled_deletion_at) {
                $forced['deactivated_at'] = now();
                $forced['scheduled_deletion_at'] = now()->addDays(UserAccountState::RETENTION_DAYS);
            }
            if (in_array($data['account_state'], [UserAccountState::TRIAL, UserAccountState::SUBSCRIBER], true)) {
                $forced['deactivated_at'] = null;
                $forced['scheduled_deletion_at'] = null;
            }
            unset($data['account_state']);
        }
        if ($forced) {
            $user->forceFill($forced);
        }
        $user->fill($data);
        $user->save();

        return response()->json(['user' => $user->fresh()]);
    }

    /**
     * Soft-delete through UserAccountState::softDelete(), not a bare
     * ->delete(). The bare call previously in use here destroyed the account
     * with no audit row at all — a direct violation of "log every deletion to
     * an audit table, never silently destroy user data" (§4.2). This is the
     * same audited path the automatic 90-day retention job uses.
     */
    public function deleteUser(Request $request, User $user): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete yourself'], 422);
        }

        app(UserAccountState::class)->softDelete($user, 'Deleted by admin', $request->user()->id);

        return response()->json(['message' => 'User deleted']);
    }

    // ── Moderation ───────────────────────────────────────────────────────────

    public function moderation(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        return response()->json(['reports' => [], 'total' => 0]);
    }
}
