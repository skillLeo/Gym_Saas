<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\WaterLog;
use Illuminate\Http\Request;

class WaterLogController extends Controller
{
    private function getOrCreate(Request $request, string $date): WaterLog
    {
        $log = WaterLog::where('user_id', $request->user()->id)
            ->whereDate('logged_date', $date)
            ->first();
        if (!$log) {
            try {
                $log = WaterLog::create(['user_id' => $request->user()->id, 'logged_date' => $date, 'glasses_count' => 0, 'total_ounces' => 0]);
            } catch (\Exception $e) {
                $log = WaterLog::where('user_id', $request->user()->id)->whereDate('logged_date', $date)->first()
                    ?? new WaterLog(['user_id' => $request->user()->id, 'logged_date' => $date, 'glasses_count' => 0, 'total_ounces' => 0]);
            }
        }
        return $log;
    }

    public function show(Request $request)
    {
        $date = $request->input('date', now()->toDateString());
        $log  = $this->getOrCreate($request, $date);
        return response()->json(['success' => true, 'data' => $log]);
    }

    public function increment(Request $request)
    {
        $validated = $request->validate(['ounces' => 'nullable|numeric|min:1|max:16']);
        $ounces = $validated['ounces'] ?? 8;

        $log = $this->getOrCreate($request, now()->toDateString());
        $log->total_ounces   = min(320, $log->total_ounces + $ounces);
        $log->glasses_count  = (int) round($log->total_ounces / 8);
        $log->save();
        return response()->json(['success' => true, 'data' => $log]);
    }

    public function decrement(Request $request)
    {
        $validated = $request->validate(['ounces' => 'nullable|numeric|min:1|max:16']);
        $ounces = $validated['ounces'] ?? 8;

        $log = $this->getOrCreate($request, now()->toDateString());
        $log->total_ounces  = max(0, $log->total_ounces - $ounces);
        $log->glasses_count = (int) round($log->total_ounces / 8);
        $log->save();
        return response()->json(['success' => true, 'data' => $log]);
    }

    public function update(Request $request)
    {
        $request->validate(['total_ounces' => 'required|integer|min:0|max:320']);
        $log = $this->getOrCreate($request, now()->toDateString());
        $log->total_ounces  = $request->total_ounces;
        $log->glasses_count = (int) round($request->total_ounces / 8);
        $log->save();
        return response()->json(['success' => true, 'data' => $log]);
    }
}
