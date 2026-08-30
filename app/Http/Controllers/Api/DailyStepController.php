<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\DailyStep;
use Illuminate\Http\Request;

class DailyStepController extends Controller
{
    public function show(Request $request)
    {
        $date = $request->input('date', now()->toDateString());
        $log = DailyStep::firstOrCreate(
            ['user_id' => $request->user()->id, 'logged_date' => $date],
            ['steps' => 0, 'goal' => 10000]
        );
        return response()->json(['success' => true, 'data' => $log]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'steps' => 'nullable|integer|min:0|max:200000',
            'goal'  => 'nullable|integer|min:1000|max:200000',
        ]);
        $date = $request->input('date', now()->toDateString());
        $log = DailyStep::firstOrCreate(
            ['user_id' => $request->user()->id, 'logged_date' => $date],
            ['steps' => 0, 'goal' => 10000]
        );
        $log->update(array_filter($validated, fn($v) => $v !== null));
        return response()->json(['success' => true, 'data' => $log, 'message' => 'Steps updated!']);
    }
}
