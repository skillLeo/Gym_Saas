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
                $log = WaterLog::create(['user_id' => $request->user()->id, 'logged_date' => $date, 'glasses_count' => 0]);
            } catch (\Exception $e) {
                $log = WaterLog::where('user_id', $request->user()->id)->whereDate('logged_date', $date)->first()
                    ?? new WaterLog(['user_id' => $request->user()->id, 'logged_date' => $date, 'glasses_count' => 0]);
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
        $log = $this->getOrCreate($request, now()->toDateString());
        $log->glasses_count = min(20, $log->glasses_count + 1);
        $log->save();
        return response()->json(['success' => true, 'data' => $log]);
    }

    public function decrement(Request $request)
    {
        $log = $this->getOrCreate($request, now()->toDateString());
        $log->glasses_count = max(0, $log->glasses_count - 1);
        $log->save();
        return response()->json(['success' => true, 'data' => $log]);
    }

    public function update(Request $request)
    {
        $request->validate(['glasses_count' => 'required|integer|min:0|max:20']);
        $log = $this->getOrCreate($request, now()->toDateString());
        $log->glasses_count = $request->glasses_count;
        $log->save();
        return response()->json(['success' => true, 'data' => $log]);
    }
}
