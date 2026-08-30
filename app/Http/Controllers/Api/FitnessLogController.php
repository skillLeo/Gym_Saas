<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\FitnessLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FitnessLogController extends Controller
{
    public function index(Request $request)
    {
        $query = FitnessLog::where('user_id', $request->user()->id)
            ->orderBy('logged_date', 'desc')
            ->orderBy('id', 'desc');

        if ($request->type && $request->type !== 'All') {
            $query->where('category', $request->type);
        }
        if ($request->days) {
            $query->where('logged_date', '>=', now()->subDays((int) $request->days)->toDateString());
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        return response()->json(['success' => true, 'data' => $query->paginate($perPage)]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'exercise_name'          => 'required|string|max:255',
            'category'               => 'nullable|string|max:50',
            'duration_minutes'       => 'nullable|integer|min:1|max:1440',
            'calories_burned'        => 'nullable|integer|min:0|max:10000',
            'logged_date'            => 'required|date',
            'notes'                  => 'nullable|string|max:1000',
            'distance_miles'         => 'nullable|numeric|min:0|max:1000',
            'exercises'              => 'nullable|array',
            'exercises.*.name'       => 'required_with:exercises|string|max:255',
            'exercises.*.sets'       => 'required_with:exercises|array',
            'exercises.*.sets.*.reps'   => 'nullable|numeric|min:1|max:1000',
            'exercises.*.sets.*.weight' => 'nullable|numeric|min:0|max:5000',
            'exercises.*.sets.*.done'   => 'nullable|boolean',
        ]);

        $log = FitnessLog::create(array_merge($validated, ['user_id' => $request->user()->id]));
        return response()->json(['success' => true, 'data' => $log, 'message' => 'Workout saved!'], 201);
    }

    public function destroy(Request $request, FitnessLog $fitnessLog)
    {
        if ($fitnessLog->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'error' => 'Unauthorized.'], 403);
        }
        $fitnessLog->delete();
        return response()->json(['success' => true, 'message' => 'Workout deleted.']);
    }

    public function summary(Request $request)
    {
        $user        = $request->user();
        $startOfWeek = now()->startOfWeek(Carbon::MONDAY)->toDateString();

        $weekLogs = FitnessLog::where('user_id', $user->id)
            ->where('logged_date', '>=', $startOfWeek)
            ->where('logged_date', '<=', now()->addDay()->toDateString())
            ->get();

        $activeDates = $weekLogs->map(fn($l) => $l->logged_date instanceof Carbon
            ? $l->logged_date->toDateString()
            : substr((string) $l->logged_date, 0, 10)
        )->unique()->values()->toArray();

        $weekActivity = [];
        for ($i = 0; $i < 7; $i++) {
            $date           = now()->startOfWeek(Carbon::MONDAY)->addDays($i)->toDateString();
            $weekActivity[] = in_array($date, $activeDates);
        }

        return response()->json(['success' => true, 'data' => [
            'workouts'      => $weekLogs->count(),
            'minutes'       => (int) $weekLogs->sum('duration_minutes'),
            'calories'      => (int) $weekLogs->sum('calories_burned'),
            'active_days'   => $weekLogs->pluck('logged_date')->unique()->count(),
            'week_activity' => $weekActivity,
        ]]);
    }

    public function history(Request $request)
    {
        $days  = match($request->period) { 'week' => 7, '3months' => 90, default => 30 };
        $user  = $request->user();
        // Extend range by 1 day on each side to handle UTC vs user timezone differences
        $start = now()->subDays($days)->toDateString();
        $end   = now()->addDay()->toDateString();

        $rawLogs = FitnessLog::where('user_id', $user->id)
            ->whereBetween('logged_date', [$start, $end])
            ->get();

        $logs = $rawLogs->groupBy(fn($r) => $r->logged_date instanceof Carbon ? $r->logged_date->toDateString() : substr((string) $r->logged_date, 0, 10));

        // Build result: last $days days ending tomorrow (covers all timezones)
        $result = [];
        for ($i = $days - 1; $i >= -1; $i--) {
            $date  = now()->subDays($i)->toDateString();
            $group = $logs->get($date, collect());

            $volume = 0;
            foreach ($group as $entry) {
                foreach (($entry->exercises ?? []) as $exercise) {
                    foreach (($exercise['sets'] ?? []) as $set) {
                        $volume += ((float) ($set['reps'] ?? 0)) * ((float) ($set['weight'] ?? 0));
                    }
                }
            }

            $result[] = [
                'date'     => $date,
                'calories' => (int) $group->sum('calories_burned'),
                'duration' => (int) $group->sum('duration_minutes'),
                'workouts' => $group->count(),
                'volume'   => round($volume, 1),
                'distance' => round((float) $group->sum('distance_miles'), 2),
            ];
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function streak(Request $request)
    {
        $user  = $request->user();
        $today    = now()->toDateString();
        $tomorrow = now()->addDay()->toDateString();

        // All unique active dates DESC (include tomorrow to cover users ahead of UTC)
        $allDatesDesc = FitnessLog::where('user_id', $user->id)
            ->orderBy('logged_date', 'desc')
            ->pluck('logged_date')
            ->map(fn($d) => $d instanceof Carbon ? $d->toDateString() : substr((string) $d, 0, 10))
            ->unique()
            ->values();

        // Current streak — treat tomorrow as today for timezone handling
        $currentStreak = 0;
        $checkDate     = now()->addDay();
        if (!$allDatesDesc->contains($tomorrow) && !$allDatesDesc->contains($today)) {
            $checkDate->subDay();
        } elseif ($allDatesDesc->contains($tomorrow)) {
            // user is ahead of UTC, tomorrow is their today
        } else {
            $checkDate = now();
        }
        while ($allDatesDesc->contains($checkDate->toDateString())) {
            $currentStreak++;
            $checkDate->subDay();
        }

        // Longest streak (sort ASC)
        $allDatesAsc = $allDatesDesc->reverse()->values();
        $longestStreak = 0;
        $tempStreak    = 0;
        $prevDate      = null;

        foreach ($allDatesAsc as $dateStr) {
            $curr = Carbon::parse($dateStr);
            if ($prevDate === null || $curr->diffInDays(Carbon::parse($prevDate)) === 1) {
                $tempStreak++;
            } else {
                $tempStreak = 1;
            }
            $longestStreak = max($longestStreak, $tempStreak);
            $prevDate      = $dateStr;
        }
        $longestStreak = max($longestStreak, $currentStreak);

        // Stats
        $totalWorkouts = FitnessLog::where('user_id', $user->id)->count();
        $thisMonth     = FitnessLog::where('user_id', $user->id)
            ->whereMonth('logged_date', now()->month)
            ->whereYear('logged_date', now()->year)
            ->count();

        // 84-day activity grid (include tomorrow for timezone coverage)
        $startGrid = now()->subDays(83)->toDateString();
        $endGrid   = now()->addDay()->toDateString();
        $gridLogs  = FitnessLog::where('user_id', $user->id)
            ->whereBetween('logged_date', [$startGrid, $endGrid])
            ->selectRaw('DATE(logged_date) as logged_date, COUNT(*) as workout_count')
            ->groupBy(DB::raw('DATE(logged_date)'))
            ->get()
            ->keyBy(fn($r) => is_string($r->logged_date) ? substr($r->logged_date, 0, 10) : $r->logged_date->toDateString());

        $activityGrid = [];
        for ($i = 83; $i >= -1; $i--) {
            $date           = now()->subDays($i)->toDateString();
            $row            = $gridLogs->get($date);
            $activityGrid[] = [
                'date'      => $date,
                'active'    => $row !== null,
                'intensity' => $row ? min(3, (int) $row->workout_count) : 0,
            ];
        }

        // Monthly data (last 6 months)
        $monthlyData = [];
        for ($i = 5; $i >= 0; $i--) {
            $month         = now()->subMonths($i);
            $count         = FitnessLog::where('user_id', $user->id)
                ->whereMonth('logged_date', $month->month)
                ->whereYear('logged_date', $month->year)
                ->count();
            $monthlyData[] = ['month' => $month->format('M'), 'workouts' => $count];
        }

        return response()->json(['success' => true, 'data' => [
            'current_streak' => $currentStreak,
            'longest_streak' => $longestStreak,
            'total_workouts' => $totalWorkouts,
            'this_month'     => $thisMonth,
            'activity_grid'  => $activityGrid,
            'monthly_data'   => $monthlyData,
        ]]);
    }
}
