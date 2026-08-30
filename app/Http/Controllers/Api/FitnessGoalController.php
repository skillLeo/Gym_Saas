<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\FitnessGoal;
use Illuminate\Http\Request;

class FitnessGoalController extends Controller
{
    public function index(Request $request)
    {
        $goals = FitnessGoal::where('user_id', $request->user()->id)
            ->orderByRaw('completed ASC, created_at DESC')
            ->get();
        return response()->json(['success' => true, 'data' => $goals]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'           => 'required|string|max:255',
            'category'        => 'nullable|string|max:50',
            'goal_type'       => 'nullable|in:weight,body_fat,calorie,workout_frequency,steps,custom',
            // Bounds must stay within the DB columns' precision (decimal(10,2) = max
            // 99999999.99) so an out-of-range value is rejected here with a clean
            // validation error instead of reaching the DB and throwing a raw SQL exception.
            'target_value'    => 'required|numeric|min:0|max:999999.99',
            'current_value'   => 'nullable|numeric|min:0|max:999999.99',
            'unit'            => 'nullable|string|max:50',
            'deadline'        => 'nullable|date',
            'icon_name'       => 'nullable|string|max:60',
            'color'           => 'nullable|string|max:20',
            'lower_is_better' => 'nullable|boolean',
        ]);

        $goal = FitnessGoal::create(array_merge($validated, [
            'user_id'   => $request->user()->id,
            'goal_type' => $validated['goal_type'] ?? 'custom',
        ]));
        return response()->json(['success' => true, 'data' => $goal, 'message' => 'Goal added!'], 201);
    }

    public function update(Request $request, FitnessGoal $fitnessGoal)
    {
        if ($fitnessGoal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'title'         => 'sometimes|string|max:255',
            'category'      => 'sometimes|string|max:50',
            'target_value'  => 'sometimes|numeric|min:0|max:999999.99',
            'current_value' => 'sometimes|numeric|min:0|max:999999.99',
            'unit'          => 'sometimes|string|max:50',
            'deadline'      => 'sometimes|nullable|date',
            'icon_name'     => 'sometimes|nullable|string|max:60',
            'color'         => 'sometimes|string|max:20',
            'completed'     => 'sometimes|boolean',
        ]);

        $fitnessGoal->update($validated);
        return response()->json(['success' => true, 'data' => $fitnessGoal->fresh(), 'message' => 'Goal updated!']);
    }

    public function destroy(Request $request, FitnessGoal $fitnessGoal)
    {
        if ($fitnessGoal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }
        $fitnessGoal->delete();
        return response()->json(['success' => true, 'message' => 'Goal deleted.']);
    }
}
