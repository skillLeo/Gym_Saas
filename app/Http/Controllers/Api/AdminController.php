<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
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
        SystemSetting::set('nutritionix_app_id',  $v['nutritionix_app_id'],  'nutritionix', false);
        SystemSetting::set('nutritionix_app_key', $v['nutritionix_app_key'], 'nutritionix', true);
        return response()->json(['success' => true, 'message' => 'Nutritionix API keys saved.']);
    }

    public function testSmtp(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->assertAdmin($request);
        $to = $request->validate(['email' => 'required|email'])['email'];
        try {
            $smtp = SystemSetting::getRaw('smtp');
            if (!empty($smtp['mail_host'])) {
                config([
                    'mail.mailers.smtp.host'       => $smtp['mail_host'],
                    'mail.mailers.smtp.port'       => $smtp['mail_port'] ?? 587,
                    'mail.mailers.smtp.username'   => $smtp['mail_username'] ?? null,
                    'mail.mailers.smtp.password'   => $smtp['mail_password'] ?? null,
                    'mail.mailers.smtp.encryption' => $smtp['mail_encryption'] ?? 'tls',
                    'mail.from.address'            => $smtp['mail_from_address'] ?? config('mail.from.address'),
                    'mail.from.name'               => $smtp['mail_from_name'] ?? config('mail.from.name'),
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
}
