<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TrialWelcomeMail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name'                  => 'required|string|max:255',
            'email'                 => 'required|string|email|max:255|unique:users',
            'password'              => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $user = User::create([
            'name'                => $validated['name'],
            'email'               => $validated['email'],
            'password'            => Hash::make($validated['password']),
            'trial_starts_at'     => now(),
            'trial_ends_at'       => now()->addDays(30),
            'subscription_status' => 'trial',
            'onboarding_completed'=> false,
        ]);

        try {
            Mail::to($user->email)->send(new TrialWelcomeMail($user));
        } catch (\Exception $e) {
            // Don't fail registration if email fails
        }

        $token = $user->createToken('auth_token')->plainTextToken;

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

        $user  = Auth::user();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'data'    => ['token' => $token, 'user' => $this->userResponse($user)],
            'message' => 'Login successful.',
        ]);
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
        $request->validate(['avatar' => 'required|image|max:2048']);

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

        $status = Password::sendResetLink($request->only('email'));

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
            'email'                    => $user->email,
            'avatar_url'               => $user->avatar_url,
            'bio'                      => $user->bio,
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
            'subscription_status'      => $user->subscription_status,
            'is_on_trial'              => $user->isOnTrial(),
            'trial_days_remaining'     => $user->trialDaysRemaining(),
            'trial_ends_at'            => $user->trial_ends_at?->toIso8601String(),
            'onboarding_completed'     => $user->onboarding_completed,
            'member_since'             => $user->created_at->toDateString(),
            'is_admin'                 => (bool)$user->is_admin,
        ];
    }
}
