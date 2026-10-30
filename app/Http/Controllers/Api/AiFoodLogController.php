<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FoodItem;
use App\Models\MealSlot;
use App\Services\Ai\AiClient;
use App\Services\Ai\Exceptions\AiException;
use App\Services\Ai\FoodAnalyzer;
use App\Services\Ai\MediaPreparer;
use App\Services\FoodJournal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Snap, Say and Type: photo, voice and typed food logging.
 *
 * TWO STEPS, ALWAYS. /analyze returns a draft and saves nothing; /confirm
 * writes what the member actually approved. There is no single-call path that
 * logs a meal straight from a photo, because the portion estimate is a guess
 * and a guess must be seen before it becomes a number in someone's journal.
 *
 * /confirm writes through FoodJournal, the same service manual logging uses,
 * so totals, streaks and badges behave identically — see that class.
 *
 * Uploads are never kept. The temp file PHP creates is read into memory and
 * deleted in a finally block; nothing is copied to storage, no filename is
 * logged, and the usage ledger records only numbers.
 */
class AiFoodLogController extends Controller
{
    public function __construct(
        private readonly FoodAnalyzer $analyzer,
        private readonly AiClient $client,
        private readonly MediaPreparer $media,
        private readonly FoodJournal $journal,
    ) {
    }

    /**
     * Identify foods from ONE of: a photo, a voice clip, or typed text.
     *
     * Nothing is saved. The response is a draft for the member to correct.
     */
    public function analyze(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['nullable', 'file', 'max:'.$this->kilobytes('max_image_bytes'), 'mimetypes:'.implode(',', config('ai.uploads.image_mimes'))],
            'audio' => ['nullable', 'file', 'max:'.$this->kilobytes('max_audio_bytes'), 'mimetypes:'.implode(',', config('ai.uploads.audio_mimes'))],
            'text'  => ['nullable', 'string', 'min:2', 'max:1000'],
        ]);

        $given = array_values(array_filter(
            ['image', 'audio', 'text'],
            fn (string $k) => $request->hasFile($k) || filled($request->input($k)),
        ));

        if (count($given) !== 1) {
            throw ValidationException::withMessages([
                'image' => $given === []
                    ? 'Send a photo, a voice recording, or a description of your meal.'
                    : 'Send only one of a photo, a voice recording, or a description.',
            ]);
        }

        $upload = $request->file('image') ?? $request->file('audio');

        try {
            $result = match ($given[0]) {
                'image' => $this->analyzeImage($request),
                'audio' => $this->analyzeAudio($request),
                'text'  => $this->analyzeText($request),
            };
        } catch (AiException $e) {
            return $this->aiFailure($e);
        } catch (RuntimeException $e) {
            // Unreadable upload: the member's problem to fix, not a server fault.
            return response()->json([
                'success'  => false,
                'error'    => $e->getMessage(),
                'code'     => 'unreadable_upload',
                'fallback' => 'manual',
            ], 422);
        } finally {
            /*
             * Runs whether the analysis succeeded, failed, or threw. The photo
             * is gone before the response leaves.
             */
            $this->media->discard($upload);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    /**
     * Write the member's corrected list to the food journal.
     *
     * Every number written comes from a USDA record or a food the member
     * themselves created — never from the model, and never from a figure the
     * client simply asserts. See resolveFood().
     */
    public function confirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'meal_slot_id' => 'required|integer|exists:meal_slots,id',
            'logged_date'  => 'required|date',
            'items'                       => 'required|array|min:1|max:20',
            'items.*.grams'               => 'nullable|numeric|min:0.1|max:5000',
            'items.*.servings'            => 'nullable|numeric|min:0.01|max:100',
            'items.*.food_item_id'        => 'nullable|integer|exists:food_items,id',
            'items.*.food'                => 'nullable|array',
            'items.*.food.external_food_id'     => 'nullable|string|max:64',
            'items.*.food.name'                 => 'required_with:items.*.food|string|max:255',
            'items.*.food.brand'                => 'nullable|string|max:255',
            'items.*.food.serving_qty'          => 'required_with:items.*.food|numeric|min:0.01',
            'items.*.food.serving_unit'         => 'required_with:items.*.food|string|max:50',
            'items.*.food.serving_weight_grams' => 'nullable|numeric|min:0',
            'items.*.food.calories'             => 'required_with:items.*.food|numeric|min:0',
            'items.*.food.protein_g'            => 'required_with:items.*.food|numeric|min:0',
            'items.*.food.carbs_g'              => 'required_with:items.*.food|numeric|min:0',
            'items.*.food.fat_g'                => 'required_with:items.*.food|numeric|min:0',
            'items.*.food.fiber_g'              => 'nullable|numeric|min:0',
            'items.*.food.sugar_g'              => 'nullable|numeric|min:0',
            'items.*.food.sodium_mg'            => 'nullable|numeric|min:0',
        ]);

        $user = $request->user();
        $slot = MealSlot::find($validated['meal_slot_id']);

        /*
         * The ownership check the whole endpoint turns on. `exists` only
         * proves the slot is real, not that it is theirs — without this, any
         * member could write into any other member's journal by guessing an id.
         */
        if (! $slot || ! $this->journal->ownsSlot($user, $slot)) {
            return response()->json([
                'success' => false,
                'error'   => 'Unauthorized.',
            ], 403);
        }

        $entries = [];

        // One transaction: a half-written meal is worse than a failed one,
        // because the member sees some of their food logged and has no way to
        // tell which part is missing.
        DB::transaction(function () use ($validated, $user, $slot, &$entries) {
            foreach ($validated['items'] as $i => $item) {
                $food     = $this->resolveFood($user, $item, $i);
                $servings = $this->servingsFor($food, $item, $i);

                $entries[] = $this->journal->log(
                    $user,
                    $slot,
                    $food,
                    $servings,
                    $validated['logged_date'],
                )->load('foodItem');
            }
        });

        return response()->json([
            'success' => true,
            'data'    => [
                'entries' => $entries,
                'totals'  => [
                    'calories'  => round(collect($entries)->sum('total_calories'), 1),
                    'protein_g' => round(collect($entries)->sum('total_protein_g'), 1),
                    'carbs_g'   => round(collect($entries)->sum('total_carbs_g'), 1),
                    'fat_g'     => round(collect($entries)->sum('total_fat_g'), 1),
                ],
            ],
            'message' => count($entries) === 1
                ? 'Added to your journal.'
                : count($entries).' items added to your journal.',
        ], 201);
    }

    // ------------------------------------------------------------- internals

    private function analyzeImage(Request $request): array
    {
        $file = $request->file('image');

        $result = $this->analyzer->fromImage(
            $request->user(),
            $this->media->imageToDataUrl($file),
        );

        return ['source' => 'image'] + $result;
    }

    private function analyzeAudio(Request $request): array
    {
        $file = $request->file('audio');

        $transcript = $this->client->transcribe(
            'food_analyze_audio',
            $file->getRealPath(),
            // A generic name, not the member's own filename, which on a phone
            // can carry a timestamp or a location-derived album title.
            'clip.'.($file->guessExtension() ?: 'webm'),
            $this->media->audioSeconds($file),
            $request->user(),
        );

        if (trim($transcript) === '') {
            // A successful call that heard nothing. Not an error, and not an
            // empty plate either — say which it was.
            return [
                'source'     => 'audio',
                'transcript' => '',
                'food_found' => false,
                'items'      => [],
                'food_database_unavailable' => false,
                'message'    => 'We could not make out any words in that recording. Try again somewhere quieter, or type what you ate.',
            ];
        }

        $result = $this->analyzer->fromText($request->user(), $transcript, 'food_analyze_audio');

        /*
         * The transcript is returned so the member can see what was heard. It
         * is not stored anywhere — not in the usage ledger, not in the log.
         * "Two eggs" misheard as "two legs" is otherwise invisible, and the
         * member would only see a baffling food list with no way to tell why.
         */
        return ['source' => 'audio', 'transcript' => $transcript] + $result;
    }

    private function analyzeText(Request $request): array
    {
        $result = $this->analyzer->fromText($request->user(), (string) $request->input('text'));

        return ['source' => 'text'] + $result;
    }

    /**
     * Which FoodItem this line refers to.
     *
     * Two ways in, and both end at a real record:
     *   food_item_id — an existing food, including the member's own custom
     *                  foods. Another member's private custom food is refused.
     *   food         — a USDA record from the draft, stored on first use.
     *
     * A line carrying neither is rejected. Accepting loose numbers here would
     * let a client post any calorie figure it liked and have it recorded as
     * though a food database had supplied it.
     */
    private function resolveFood($user, array $item, int $index): FoodItem
    {
        if (! empty($item['food_item_id'])) {
            $food = FoodItem::findOrFail($item['food_item_id']);

            // A custom food belongs to whoever made it.
            if ($food->is_custom && $food->created_by_user_id !== $user->id) {
                throw ValidationException::withMessages([
                    "items.{$index}.food_item_id" => 'That food is not available to your account.',
                ]);
            }

            return $food;
        }

        if (empty($item['food'])) {
            throw ValidationException::withMessages([
                "items.{$index}" => 'Each item needs either a chosen food or a food record.',
            ]);
        }

        $data = $item['food'];

        /*
         * Keyed on the external id and source when there is one, so two
         * genuinely different USDA foods that share a name stay separate.
         * The legacy /food-log/from-api endpoint matches on name alone and
         * collapses them — a known bug, pinned by the characterization test
         * and deliberately not inherited here.
         */
        $key = filled($data['external_food_id'] ?? null)
            ? ['external_food_id' => (string) $data['external_food_id'], 'food_source' => 'usda', 'is_custom' => false]
            : ['external_food_id' => null, 'name' => $data['name'], 'is_custom' => false];

        return FoodItem::firstOrCreate($key, [
            'name'                 => $data['name'],
            'brand'                => $data['brand'] ?? null,
            'food_source'          => filled($data['external_food_id'] ?? null) ? 'usda' : null,
            'serving_qty'          => $data['serving_qty'],
            'serving_unit'         => $data['serving_unit'],
            'serving_weight_grams' => $data['serving_weight_grams'] ?? null,
            'calories'             => $data['calories'],
            'protein_g'            => $data['protein_g'],
            'carbs_g'              => $data['carbs_g'],
            'fat_g'                => $data['fat_g'],
            'fiber_g'              => $data['fiber_g'] ?? null,
            'sugar_g'              => $data['sugar_g'] ?? null,
            'sodium_mg'            => $data['sodium_mg'] ?? null,
        ]);
    }

    /**
     * Grams or servings — one or the other, per line.
     *
     * Grams is what the AI flow speaks in, and converting needs a gram basis
     * on the food record. USDA foods always carry one (100 g). A custom food
     * may not, because serving_weight_grams is optional when the member
     * creates it — so that case is refused with a message that says what to
     * send instead, rather than silently treating grams as servings and
     * logging a wildly wrong number.
     */
    private function servingsFor(FoodItem $food, array $item, int $index): float
    {
        if (filled($item['servings'] ?? null)) {
            return (float) $item['servings'];
        }

        if (! filled($item['grams'] ?? null)) {
            throw ValidationException::withMessages([
                "items.{$index}.grams" => 'Each item needs a weight in grams, or a number of servings.',
            ]);
        }

        $basis = (float) ($food->serving_weight_grams ?? 0);

        if ($basis <= 0) {
            throw ValidationException::withMessages([
                "items.{$index}.grams" => "\"{$food->name}\" has no gram weight recorded, so it cannot be logged by weight. Send a number of servings instead.",
            ]);
        }

        return (float) $item['grams'] / $basis;
    }

    /** Laravel's `max` rule on a file is in kilobytes. */
    private function kilobytes(string $configKey): int
    {
        return (int) floor(((int) config("ai.uploads.{$configKey}")) / 1024);
    }

    private function aiFailure(AiException $e): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error'   => $e->clientMessage(),
            'code'    => $e->code(),
            // Every AI failure offers the manual route. The food journal is
            // never closed because an optional convenience is unavailable.
            'fallback' => 'manual',
        ], $e->status());
    }
}
