<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TrialWelcomeMail;
use App\Mail\VerifyEmailMail;
use App\Models\BetaAllowlist;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    /**
     * §E6 — enforced here, server-side, not by hiding the signup form on the
     * frontend (hiding a form is not enforcement; a direct POST would still
     * succeed). Checked before validation so an attempted registration from a
     * non-allowlisted email never even reaches a duplicate-email check that
     * could leak whether that email already has an account.
     */
    private function assertRegistrationAllowed(string $email): void
    {
        $inviteOnly = SystemSetting::get('invite_only_mode') === '1';

        if ($inviteOnly && ! BetaAllowlist::permits($email)) {
            abort(403, 'This is a private beta right now. If you have an invite, make sure you are using the exact email address it was sent to.');
        }
    }

    public function register(Request $request)
    {
        $this->assertRegistrationAllowed((string) $request->input('email'));

        $validated = $request->validate([
            'name'                  => 'required|string|max:255',
            'email'                 => ['required', 'string', 'email:rfc', 'regex:/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/', 'max:255', 'unique:users'],
            'password'              => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        // One implementation of this, shared with the seeders and the backfill
        // migration — a NULL username makes a member's public profile
        // unreachable, so it must never be possible to create one without it.
        $username = User::generateUsername($validated['name']);

        $user = User::create([
            'name'                => $validated['name'],
            'username'            => $username,
            'email'               => $validated['email'],
            'password'            => Hash::make($validated['password']),
            'onboarding_completed'=> false,
        ]);

        // Trial length is admin-configurable; the service owns both the dates
        // and the state so they cannot be set inconsistently.
        app(\App\Services\UserAccountState::class)->startTrial($user);
        BetaAllowlist::markUsed($user->email);

        \App\Models\MealSlot::seedDefaultsFor($user->id);

        try {
            Mail::to($user->email)->send(new TrialWelcomeMail($user));
        } catch (\Exception $e) {
            // Don't fail registration if email fails
        }

        $this->sendVerificationEmail($user);

        // Matches the frontend's auth_token cookie lifetime for a fresh
        // registration (register/page.tsx sets max-age=2592000, i.e. 30 days).
        $token = $user->createToken('auth_token', ['*'], now()->addDays(30))->plainTextToken;

        return response()->json([
            'success' => true,
            'data'    => ['token' => $token, 'user' => $this->userResponse($user)],
            'message' => 'Registration successful. Your 30-day free trial has started!',
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['success' => false, 'error' => 'Invalid credentials.'], 401);
        }

        $user = Auth::user();

        // Mirrors the frontend's own auth_token cookie lifetime (login/page.tsx):
        // 30 days when "Remember me" is checked, 1 day otherwise. Previously
        // this checkbox only changed the cookie — the actual API token behind
        // it never expired either way, so the cookie expiring did nothing.
        $expiresAt = $request->boolean('remember') ? now()->addDays(30) : now()->addDay();
        $token     = $user->createToken('auth_token', ['*'], $expiresAt)->plainTextToken;

        return response()->json([
            'success' => true,
            'data'    => ['token' => $token, 'user' => $this->userResponse($user)],
            'message' => 'Login successful.',
        ]);
    }

    private function sendVerificationEmail(User $user): bool
    {
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->email)]
        );

        try {
            Mail::to($user->email)->send(new VerifyEmailMail($user, $url));
            return true;
        } catch (\Exception $e) {
            // Logged so a real SMTP/mail failure is visible instead of vanishing silently —
            // registration itself must still succeed even if the email send fails.
            report($e);
            return false;
        }
    }

    public function verifyEmail(Request $request, int $id, string $hash)
    {
        if (!$request->hasValidSignature()) {
            return redirect()->away(config('app.frontend_url') . '/auth/verify-email?status=invalid');
        }

        $user = User::findOrFail($id);

        if (!hash_equals($hash, sha1($user->email))) {
            return redirect()->away(config('app.frontend_url') . '/auth/verify-email?status=invalid');
        }

        if (!$user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return redirect()->away(config('app.frontend_url') . '/auth/verify-email?status=verified');
    }

    public function resendVerification(Request $request)
    {
        $user = $request->user();

        if ($user->email_verified_at) {
            return response()->json(['success' => true, 'message' => 'Your email is already verified.']);
        }

        if (!$this->sendVerificationEmail($user)) {
            return response()->json(['success' => false, 'message' => 'We could not send the verification email right now. Please try again in a moment.'], 500);
        }

        return response()->json(['success' => true, 'message' => 'Verification email sent — check your inbox.']);
    }

    public function redirectToGoogle()
    {
        return Socialite::driver('google')->stateless()->redirect();
    }

    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            return redirect()->away(config('app.frontend_url') . '/auth/login?oauth_error=1');
        }

        $user = User::where('google_id', $googleUser->getId())->first();

        if (!$user) {
            $user = User::where('email', $googleUser->getEmail())->first();

            if ($user) {
                // An account with this email already exists (password signup) — link it to Google.
                $user->forceFill(['google_id' => $googleUser->getId()])->save();
            } else {
                // §E6 — Google is a second registration path and is easy to
                // miss: invite-only mode must block a brand-new account here
                // exactly as it does on the password path, not just at the
                // form the frontend happens to show first.
                $inviteOnly = SystemSetting::get('invite_only_mode') === '1';
                if ($inviteOnly && ! BetaAllowlist::permits($googleUser->getEmail())) {
                    return redirect()->away(config('app.frontend_url') . '/auth/register?beta_blocked=1');
                }

                $base = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $googleUser->getName())) ?: 'user';
                $username = $base . rand(100, 9999);
                while (User::where('username', $username)->exists()) {
                    $username = $base . rand(1000, 99999);
                }

                $user = User::create([
                    'name'                => $googleUser->getName() ?: 'Member',
                    'username'            => $username,
                    'email'               => $googleUser->getEmail(),
                    'google_id'           => $googleUser->getId(),
                    'password'            => Hash::make(Str::random(40)),
                    'onboarding_completed'=> false,
                ]);
                // Google has already verified this email address — no need to re-verify.
                $user->forceFill(['email_verified_at' => now()])->save();
                app(\App\Services\UserAccountState::class)->startTrial($user);
                BetaAllowlist::markUsed($user->email);

                \App\Models\MealSlot::seedDefaultsFor($user->id);

                try {
                    Mail::to($user->email)->send(new TrialWelcomeMail($user));
                } catch (\Exception $e) {
                    // Don't fail signup if email fails
                }
            }
        }

        // Matches oauth-callback/page.tsx's auth_token cookie (max-age=2592000, 30 days).
        $token = $user->createToken('auth_token', ['*'], now()->addDays(30))->plainTextToken;

        return redirect()->away(config('app.frontend_url') . '/auth/oauth-callback?token=' . urlencode($token));
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['success' => true, 'message' => 'Logged out successfully.']);
    }

    public function user(Request $request)
    {
        return response()->json(['success' => true, 'data' => $this->userResponse($request->user())]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'                    => 'sometimes|string|max:255',
            'username'                => 'sometimes|nullable|string|max:40|alpha_dash|unique:users,username,' . $user->id,
            'bio'                     => 'sometimes|nullable|string|max:1000',
            'date_of_birth'           => 'sometimes|nullable|date|before:today',
            'gender'                  => 'sometimes|nullable|in:male,female,other',
            'height_cm'               => 'sometimes|nullable|numeric|min:50|max:300',
            'current_weight_kg'       => 'sometimes|nullable|numeric|min:10|max:500',
            'goal_weight_kg'          => 'sometimes|nullable|numeric|min:10|max:500',
            'activity_level'          => 'sometimes|nullable|in:sedentary,lightly_active,moderately_active,very_active,extra_active',
            'primary_goal'            => 'sometimes|nullable|in:lose_weight,maintain_weight,gain_muscle,improve_fitness,eat_healthier',
            'daily_water_goal_glasses'=> 'sometimes|integer|min:1|max:20',
            'daily_calorie_goal'      => 'sometimes|nullable|integer|min:1000|max:10000',
            'nickname'                => 'sometimes|nullable|string|max:60',
            // Account-settings switch and profile billboard — both previously had
            // UI with no persistence at all.
            'email_notifications'     => 'sometimes|boolean',
            'billboard'               => 'sometimes|nullable|array',
            'billboard.text'          => 'nullable|string|max:120',
            'billboard.font'          => 'nullable|string|max:40',
            'billboard.color'         => 'nullable|string|max:9',
            'billboard.background'    => 'nullable|string|max:9',
            'alternate_names'         => 'sometimes|nullable|array|max:10',
            'alternate_names.*.name'  => 'required|string|max:120',
            'alternate_names.*.type'  => 'nullable|in:maiden,previous,alternate',
        ]);

        $user->fill($validated);

        if (isset($validated['current_weight_kg']) || isset($validated['height_cm']) ||
            isset($validated['activity_level']) || isset($validated['primary_goal'])) {
            $calories = $user->calculateDailyCalories();
            $user->daily_calorie_goal   = $validated['daily_calorie_goal'] ?? $calories;
            $user->daily_protein_goal_g = round($user->daily_calorie_goal * 0.30 / 4);
            $user->daily_carbs_goal_g   = round($user->daily_calorie_goal * 0.40 / 4);
            $user->daily_fat_goal_g     = round($user->daily_calorie_goal * 0.30 / 9);
        }

        $user->save();

        return response()->json(['success' => true, 'data' => $this->userResponse($user), 'message' => 'Profile updated.']);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        if (!Hash::check($request->current_password, $request->user()->password)) {
            return response()->json(['success' => false, 'error' => 'Current password is incorrect.'], 422);
        }

        $request->user()->update(['password' => Hash::make($request->password)]);

        return response()->json(['success' => true, 'message' => 'Password changed successfully.']);
    }

    public function uploadAvatar(Request $request)
    {
        $request->validate(['avatar' => 'required|image|mimes:jpeg,jpg,png,webp|max:2048']);

        $user    = $request->user();
        $manager = new ImageManager(new Driver());
        $image   = $manager->decode($request->file('avatar'));
        $image->cover(400, 400);

        $path     = "avatars/{$user->id}.jpg";
        $fullPath = storage_path("app/public/{$path}");
        @mkdir(dirname($fullPath), 0775, true);
        $image->encode(new \Intervention\Image\Encoders\JpegEncoder(quality: 85))->save($fullPath);

        $user->update(['avatar' => $path]);

        return response()->json(['success' => true, 'data' => ['avatar_url' => $user->avatar_url], 'message' => 'Avatar uploaded.']);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        // Password::sendResetLink() sends the email synchronously — a real SMTP
        // failure (mailbox disabled, provider outage) previously bubbled up as
        // an uncaught exception and a raw 500. The reset flow must never reveal
        // whether an email exists either way, so on a genuine send failure we
        // log it for us to investigate but still answer the user with the same
        // honest, generic message rather than a crash.
        try {
            $status = Password::sendResetLink($request->only('email'));
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => 'We could not send that email right now. Please try again shortly.',
            ], 500);
        }

        return response()->json([
            'success' => $status === Password::RESET_LINK_SENT,
            'message' => __($status),
        ]);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token'    => 'required',
            'email'    => 'required|email',
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password)])->save();
                $user->tokens()->delete();
            }
        );

        return response()->json([
            'success' => $status === Password::PASSWORD_RESET,
            'message' => __($status),
        ], $status === Password::PASSWORD_RESET ? 200 : 422);
    }

    private function userResponse(User $user): array
    {
        return [
            'id'                       => $user->id,
            'name'                     => $user->name,
            'username'                 => $user->username,
            'email'                    => $user->email,
            'avatar_url'               => $user->avatar_url,
            'bio'                      => $user->bio,
            'nickname'                 => $user->nickname,
            'alternate_names'          => $user->alternate_names ?? [],
            'date_of_birth'            => $user->date_of_birth?->toDateString(),
            'gender'                   => $user->gender,
            'height_cm'                => $user->height_cm,
            'current_weight_kg'        => $user->current_weight_kg,
            'goal_weight_kg'           => $user->goal_weight_kg,
            'activity_level'           => $user->activity_level,
            'primary_goal'             => $user->primary_goal,
            'daily_calorie_goal'       => $user->daily_calorie_goal,
            'daily_protein_goal_g'     => $user->daily_protein_goal_g,
            'daily_carbs_goal_g'       => $user->daily_carbs_goal_g,
            'daily_fat_goal_g'         => $user->daily_fat_goal_g,
            'daily_water_goal_glasses' => $user->daily_water_goal_glasses,
            'email_notifications'      => (bool) $user->email_notifications,
            'billboard'                => $user->billboard,
            'subscription_status'      => $user->subscription_status,
            'is_on_trial'              => $user->isOnTrial(),
            'trial_days_remaining'     => $user->trialDaysRemaining(),
            'trial_ends_at'            => $user->trial_ends_at?->toIso8601String(),
            'onboarding_completed'     => $user->onboarding_completed,
            'member_since'             => $user->created_at->toDateString(),
            'is_admin'                 => (bool)$user->is_admin,
            'email_verified'           => (bool) $user->email_verified_at,
        ];
    }
}
