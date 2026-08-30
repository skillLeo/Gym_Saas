<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\BodyStat;
use Illuminate\Http\Request;

class BodyStatController extends Controller
{
    public function index(Request $request)
    {
        $limit = min((int) ($request->limit ?? 12), 100);
        $stats = BodyStat::where('user_id', $request->user()->id)
            ->orderBy('logged_date', 'asc')
            ->limit($limit)
            ->get();
        return response()->json(['success' => true, 'data' => $stats]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'logged_date'    => 'required|date',
            'weight_lbs'     => 'nullable|numeric|min:0|max:1000',
            'body_fat_pct'   => 'nullable|numeric|min:0|max:100',
            'waist_inches'   => 'nullable|numeric|min:0|max:200',
            'hips_inches'    => 'nullable|numeric|min:0|max:200',
            'chest_inches'   => 'nullable|numeric|min:0|max:200',
            'arms_inches'    => 'nullable|numeric|min:0|max:200',
            'thighs_inches'  => 'nullable|numeric|min:0|max:200',
            'notes'          => 'nullable|string|max:500',
        ]);

        // Every measurement is nullable, so a POST carrying only a date passed
        // validation, wrote a row of all-nulls and answered "Stats saved!". That
        // is a success message for nothing having been saved, and the empty row
        // then shows up as a blank point on the progress chart. At least one
        // measurement has to be present for there to be anything to save.
        $measurements = ['weight_lbs', 'body_fat_pct', 'waist_inches', 'hips_inches',
                         'chest_inches', 'arms_inches', 'thighs_inches'];

        if (!collect($measurements)->contains(fn ($f) => ($validated[$f] ?? null) !== null)) {
            return response()->json([
                'success' => false,
                'message' => 'Enter at least one measurement.',
                'errors'  => ['weight_lbs' => ['Enter at least one measurement.']],
            ], 422);
        }

        $stat = BodyStat::updateOrCreate(
            ['user_id' => $request->user()->id, 'logged_date' => $validated['logged_date']],
            array_merge($validated, ['user_id' => $request->user()->id])
        );

        return response()->json(['success' => true, 'data' => $stat, 'message' => 'Stats saved!'], 201);
    }
}
