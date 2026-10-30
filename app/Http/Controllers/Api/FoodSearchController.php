<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\UsdaFoodData;
use Illuminate\Http\Request;

/**
 * Food lookup endpoints.
 *
 * Backed by USDA FoodData Central. This project previously used Nutritionix and
 * moved off it; see App\Services\UsdaFoodData for what that swap does and does
 * not carry over — in particular, FoodData Central has no natural-language
 * endpoint, so `nlp()` is now a local parser over the same search index.
 */
class FoodSearchController extends Controller
{
    public function __construct(private UsdaFoodData $usda)
    {
    }

    /**
     * Whether the food database is actually reachable.
     *
     * Barcode scanning, photo log and voice log all depend on it. They used to
     * advertise themselves as working and only surface the problem after the
     * member had done the work, so the screens ask this on mount.
     *
     * `nutritionix` is still returned, always false, purely so a stale cached
     * frontend bundle reads a defined value rather than `undefined` and decides
     * the database is connected. It can go once nothing reads it.
     */
    public function integrationStatus()
    {
        return response()->json([
            'configured'  => $this->usda->configured(),
            'provider'    => 'usda',
            'nutritionix' => false,
        ]);
    }

    /**
     * The member's own custom foods, matched against the same query.
     *
     * Without this a custom food is unreachable the moment it is created:
     * `/food/search` only ever asked the provider (or the built-in fallback),
     * and `/food/recent` only lists foods already logged — so a food you had
     * just invented appeared in neither. They come back first because they are
     * the member's own, and carry `is_custom` so the picker can badge them.
     */
    private function customFoods(Request $request, string $query): array
    {
        return \App\Models\FoodItem::where('created_by_user_id', $request->user()->id)
            ->where('is_custom', true)
            ->where('name', 'like', '%' . $query . '%')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn ($f) => [
                'external_food_id'     => null,
                'source'               => 'custom',
                'food_item_id'         => $f->id,
                'is_custom'            => true,
                'name'                 => $f->name,
                'brand'                => $f->brand,
                'serving_qty'          => (float) $f->serving_qty,
                'serving_unit'         => $f->serving_unit,
                'serving_weight_grams' => $f->serving_weight_grams ? (float) $f->serving_weight_grams : null,
                'calories'             => (float) $f->calories,
                'protein_g'            => (float) $f->protein_g,
                'carbs_g'              => (float) $f->carbs_g,
                'fat_g'                => (float) $f->fat_g,
                'fiber_g'              => $f->fiber_g !== null ? (float) $f->fiber_g : null,
                'sugar_g'              => $f->sugar_g !== null ? (float) $f->sugar_g : null,
                'sodium_mg'            => $f->sodium_mg !== null ? (float) $f->sodium_mg : null,
            ])
            ->all();
    }

    public function search(Request $request)
    {
        $request->validate(['q' => 'required|string|min:1|max:200']);
        $query = $request->q;
        $mine  = $this->customFoods($request, $query);

        // Barcode and the natural-language endpoint both return 503 "not
        // configured" when there is no API key, so the screens that use them can
        // say so. Search did not: it quietly fell back to a small built-in list
        // and returned an empty array for everything else, so searching "pizza"
        // looked exactly like "we have no pizza" rather than "food search is not
        // connected". Same fallback, but the caller is told which it is.
        if (! $this->usda->configured()) {
            return response()->json([
                'success'      => true,
                'configured'   => false,
                'provider'     => 'usda',
                'custom_count' => count($mine),
                'data'         => array_merge($mine, $this->sampleFoods($query)),
            ]);
        }

        $results = $this->usda->search($query);

        return response()->json([
            'success'      => true,
            'configured'   => true,
            'provider'     => 'usda',
            'custom_count' => count($mine),
            // Distinguishes "we asked and there is no such food" from "we could
            // not ask". Without it a rate-limited or unreachable provider is
            // indistinguishable from a genuinely empty result, and the picker
            // tells the member their food does not exist.
            'unavailable'  => $this->usda->unavailable,
            'data'         => array_merge($mine, $results),
        ]);
    }

    /**
     * Natural language, used by both the photo log and the voice log.
     *
     * Neither screen sends an image or audio: the photo log has the member type
     * a description, and the voice log transcribes speech in the browser. Both
     * arrive here as text.
     */
    public function nlp(Request $request)
    {
        $validated = $request->validate(['query' => 'required|string|max:500']);

        if (! $this->usda->configured()) {
            return response()->json([
                'success' => false,
                'error'   => 'The food database is not connected yet.',
            ], 503);
        }

        $parsed = $this->usda->parseNatural($validated['query']);

        if ($parsed['items'] === []) {
            return response()->json([
                'success' => false,
                'error'   => 'Could not match any food in that description. Try naming the foods more simply, for example "2 eggs and toast".',
            ], 422);
        }

        return response()->json([
            'success'    => true,
            'data'       => $parsed['items'],
            // Named so the screen can tell the member which parts of their
            // sentence were not understood, rather than silently dropping them.
            'unresolved' => $parsed['unresolved'],
        ]);
    }

    public function barcode(Request $request, string $barcode)
    {
        if (! $this->usda->configured()) {
            return response()->json([
                'success' => false,
                'error'   => 'The food database is not connected yet.',
            ], 503);
        }

        $result = $this->usda->barcode($barcode);

        if (! $result) {
            // A rate-limited lookup is not the same as a missing product, and
            // telling someone their food "is not in the database" when we simply
            // could not ask is the kind of wrong answer they act on.
            if ($this->usda->unavailable) {
                return response()->json([
                    'success' => false,
                    'error'   => 'The food database is busy right now. Try that scan again in a moment.',
                ], 503);
            }

            return response()->json([
                'success' => false,
                // FoodData Central only carries barcodes for branded products,
                // and its coverage is not exhaustive. Saying so is better than
                // implying the member scanned it wrong.
                'error'   => 'That barcode is not in the USDA food database. You can add it as a custom food instead.',
            ], 404);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    /**
     * A small built-in list, used only when no API key is configured so the
     * journal is not completely unusable during setup.
     */
    private function sampleFoods(string $query = ''): array
    {
        $all = [
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Chicken Breast','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>165,'protein_g'=>31,'carbs_g'=>0,'fat_g'=>3.6,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>74],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Brown Rice (cooked)','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>112,'protein_g'=>2.6,'carbs_g'=>23.5,'fat_g'=>0.9,'fiber_g'=>1.8,'sugar_g'=>0.4,'sodium_mg'=>5],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Banana','brand'=>null,'serving_qty'=>1,'serving_unit'=>'medium','serving_weight_grams'=>118,'calories'=>89,'protein_g'=>1.1,'carbs_g'=>23,'fat_g'=>0.3,'fiber_g'=>2.6,'sugar_g'=>12,'sodium_mg'=>1],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Whole Milk','brand'=>null,'serving_qty'=>240,'serving_unit'=>'ml','serving_weight_grams'=>244,'calories'=>149,'protein_g'=>8,'carbs_g'=>11.7,'fat_g'=>8,'fiber_g'=>0,'sugar_g'=>12.3,'sodium_mg'=>105],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Egg','brand'=>null,'serving_qty'=>1,'serving_unit'=>'large','serving_weight_grams'=>50,'calories'=>72,'protein_g'=>6.3,'carbs_g'=>0.4,'fat_g'=>5,'fiber_g'=>0,'sugar_g'=>0.2,'sodium_mg'=>71],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Oatmeal','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>71,'protein_g'=>2.5,'carbs_g'=>12,'fat_g'=>1.4,'fiber_g'=>1.7,'sugar_g'=>0,'sodium_mg'=>49],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Greek Yogurt','brand'=>null,'serving_qty'=>170,'serving_unit'=>'g','serving_weight_grams'=>170,'calories'=>100,'protein_g'=>17,'carbs_g'=>6,'fat_g'=>0.7,'fiber_g'=>0,'sugar_g'=>6,'sodium_mg'=>65],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Apple','brand'=>null,'serving_qty'=>1,'serving_unit'=>'medium','serving_weight_grams'=>182,'calories'=>95,'protein_g'=>0.5,'carbs_g'=>25,'fat_g'=>0.3,'fiber_g'=>4.4,'sugar_g'=>19,'sodium_mg'=>2],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Salmon','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>208,'protein_g'=>20,'carbs_g'=>0,'fat_g'=>13,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>59],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Sweet Potato','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>86,'protein_g'=>1.6,'carbs_g'=>20,'fat_g'=>0.1,'fiber_g'=>3,'sugar_g'=>4.2,'sodium_mg'=>55],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Almonds','brand'=>null,'serving_qty'=>28,'serving_unit'=>'g','serving_weight_grams'=>28,'calories'=>164,'protein_g'=>6,'carbs_g'=>6,'fat_g'=>14,'fiber_g'=>3.5,'sugar_g'=>1.2,'sodium_mg'=>0],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Broccoli','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>34,'protein_g'=>2.8,'carbs_g'=>7,'fat_g'=>0.4,'fiber_g'=>2.6,'sugar_g'=>1.7,'sodium_mg'=>33],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Orange Juice','brand'=>null,'serving_qty'=>240,'serving_unit'=>'ml','serving_weight_grams'=>249,'calories'=>112,'protein_g'=>1.7,'carbs_g'=>26,'fat_g'=>0.5,'fiber_g'=>0.5,'sugar_g'=>21,'sodium_mg'=>2],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'White Rice','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>130,'protein_g'=>2.7,'carbs_g'=>28,'fat_g'=>0.3,'fiber_g'=>0.4,'sugar_g'=>0,'sodium_mg'=>1],
            ['external_food_id'=>null,'source'=>'builtin','name'=>'Tuna (canned)','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>116,'protein_g'=>26,'carbs_g'=>0,'fat_g'=>1,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>333],
        ];

        if (empty($query)) {
            return array_slice($all, 0, 5);
        }

        $q = strtolower(trim($query));

        return array_values(array_filter($all, fn ($f) => str_contains(strtolower($f['name']), $q)));
    }
}
