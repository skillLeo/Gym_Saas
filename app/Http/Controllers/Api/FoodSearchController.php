<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FoodSearchController extends Controller
{
    private function headers(Request $request): array
    {
        $appId  = SystemSetting::get('nutritionix_app_id',  config('services.nutritionix.app_id'));
        $appKey = SystemSetting::get('nutritionix_app_key', config('services.nutritionix.app_key'));
        return [
            'x-app-id'        => $appId,
            'x-app-key'       => $appKey,
            'x-remote-user-id'=> (string) $request->user()->id,
        ];
    }

    private function hasApiKeys(): bool
    {
        $appId = SystemSetting::get('nutritionix_app_id', config('services.nutritionix.app_id'));
        return !empty($appId);
    }

    /**
     * Whether the food database is actually reachable.
     *
     * Barcode scanning, photo log and voice log all depend on Nutritionix. They
     * used to advertise themselves as working and only surface the problem
     * after the member had done the work, so the screens ask this on mount.
     */
    public function integrationStatus()
    {
        return response()->json(['nutritionix' => $this->hasApiKeys()]);
    }

    /**
     * The member's own custom foods, matched against the same query.
     *
     * Without this a custom food is unreachable the moment it is created:
     * `/food/search` only ever asked Nutritionix (or the built-in fallback), and
     * `/food/recent` only lists foods already logged — so a food you had just
     * invented appeared in neither. They come back first because they are the
     * member's own, and carry `is_custom` so the picker can badge them.
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
                'nutritionix_id'       => null,
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

        // Barcode lookup and the NLP endpoint both return 503 "not configured"
        // when there are no Nutritionix credentials, so the screens that use
        // them can say so. Search did not: it quietly fell back to a 15-item
        // built-in list and returned an empty array for everything else, so
        // searching "pizza" looked exactly like "we have no pizza" rather than
        // "food search is not connected". Same fallback, but the caller is now
        // told which of the two it is.
        $configured = $this->hasApiKeys();

        if (!$configured) {
            return response()->json([
                'success'    => true,
                'configured' => false,
                'custom_count' => count($mine),
                'data'       => array_merge($mine, $this->sampleFoods($query)),
            ]);
        }

        $cacheKey = 'nutritionix_search_' . md5($query);
        $results  = Cache::remember($cacheKey, 3600, function () use ($query, $request) {
            $response = Http::withHeaders($this->headers($request))
                ->get('https://trackapi.nutritionix.com/v2/search/instant', ['query' => $query]);

            if (!$response->successful()) return [];

            $data   = $response->json();
            $items  = [];

            foreach (($data['branded'] ?? []) as $food) {
                $items[] = $this->mapFood($food);
            }
            foreach (($data['common'] ?? []) as $food) {
                $items[] = $this->mapFood($food);
            }
            return array_slice($items, 0, 30);
        });

        return response()->json([
            'success'      => true,
            'configured'   => true,
            'custom_count' => count($mine),
            'data'         => array_merge($mine, $results),
        ]);
    }

    public function nlp(Request $request)
    {
        $validated = $request->validate(['query' => 'required|string|max:500']);

        if (!$this->hasApiKeys()) {
            return response()->json(['success' => false, 'error' => 'Nutritionix API not configured.'], 503);
        }

        $cacheKey = 'nutritionix_nlp_' . md5($validated['query']);
        $results  = Cache::remember($cacheKey, 3600, function () use ($validated, $request) {
            $response = Http::withHeaders($this->headers($request))
                ->post('https://trackapi.nutritionix.com/v2/natural/nutrients', [
                    'query' => $validated['query'],
                ]);
            if (!$response->successful()) return null;
            $foods = $response->json('foods') ?? [];
            return collect($foods)->map(fn($f) => $this->mapFood($f))->values()->toArray();
        });

        if ($results === null) {
            return response()->json(['success' => false, 'error' => 'Could not parse food text.'], 422);
        }

        return response()->json(['success' => true, 'data' => $results]);
    }

    public function barcode(Request $request, string $barcode)
    {
        if (!$this->hasApiKeys()) {
            return response()->json(['success' => false, 'error' => 'Nutritionix API not configured.'], 503);
        }

        $cacheKey = 'nutritionix_barcode_' . $barcode;
        $result   = Cache::remember($cacheKey, 86400, function () use ($barcode, $request) {
            $response = Http::withHeaders($this->headers($request))
                ->get('https://trackapi.nutritionix.com/v2/search/item', ['upc' => $barcode]);
            if (!$response->successful()) return null;
            $foods = $response->json('foods') ?? [];
            return count($foods) ? $this->mapFood($foods[0]) : null;
        });

        if (!$result) {
            return response()->json(['success' => false, 'error' => 'Product not found.'], 404);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    private function mapFood(array $food): array
    {
        return [
            'nutritionix_id'       => $food['nix_item_id'] ?? $food['food_name'] ?? null,
            'name'                 => $food['food_name'] ?? $food['item_name'] ?? 'Unknown',
            'brand'                => $food['brand_name'] ?? null,
            'serving_qty'          => $food['serving_qty'] ?? 1,
            'serving_unit'         => $food['serving_unit'] ?? 'serving',
            'serving_weight_grams' => $food['serving_weight_grams'] ?? null,
            'calories'             => $food['nf_calories'] ?? 0,
            'protein_g'            => $food['nf_protein'] ?? 0,
            'carbs_g'              => $food['nf_total_carbohydrate'] ?? 0,
            'fat_g'                => $food['nf_total_fat'] ?? 0,
            'fiber_g'              => $food['nf_dietary_fiber'] ?? null,
            'sugar_g'              => $food['nf_sugars'] ?? null,
            'sodium_mg'            => $food['nf_sodium'] ?? null,
        ];
    }

    private function sampleFoods(string $query = ''): array
    {
        $all = [
            ['nutritionix_id'=>null,'name'=>'Chicken Breast','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>165,'protein_g'=>31,'carbs_g'=>0,'fat_g'=>3.6,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>74],
            ['nutritionix_id'=>null,'name'=>'Brown Rice (cooked)','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>112,'protein_g'=>2.6,'carbs_g'=>23.5,'fat_g'=>0.9,'fiber_g'=>1.8,'sugar_g'=>0.4,'sodium_mg'=>5],
            ['nutritionix_id'=>null,'name'=>'Banana','brand'=>null,'serving_qty'=>1,'serving_unit'=>'medium','serving_weight_grams'=>118,'calories'=>89,'protein_g'=>1.1,'carbs_g'=>23,'fat_g'=>0.3,'fiber_g'=>2.6,'sugar_g'=>12,'sodium_mg'=>1],
            ['nutritionix_id'=>null,'name'=>'Whole Milk','brand'=>null,'serving_qty'=>240,'serving_unit'=>'ml','serving_weight_grams'=>244,'calories'=>149,'protein_g'=>8,'carbs_g'=>11.7,'fat_g'=>8,'fiber_g'=>0,'sugar_g'=>12.3,'sodium_mg'=>105],
            ['nutritionix_id'=>null,'name'=>'Egg','brand'=>null,'serving_qty'=>1,'serving_unit'=>'large','serving_weight_grams'=>50,'calories'=>72,'protein_g'=>6.3,'carbs_g'=>0.4,'fat_g'=>5,'fiber_g'=>0,'sugar_g'=>0.2,'sodium_mg'=>71],
            ['nutritionix_id'=>null,'name'=>'Oatmeal','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>71,'protein_g'=>2.5,'carbs_g'=>12,'fat_g'=>1.4,'fiber_g'=>1.7,'sugar_g'=>0,'sodium_mg'=>49],
            ['nutritionix_id'=>null,'name'=>'Greek Yogurt','brand'=>null,'serving_qty'=>170,'serving_unit'=>'g','serving_weight_grams'=>170,'calories'=>100,'protein_g'=>17,'carbs_g'=>6,'fat_g'=>0.7,'fiber_g'=>0,'sugar_g'=>6,'sodium_mg'=>65],
            ['nutritionix_id'=>null,'name'=>'Apple','brand'=>null,'serving_qty'=>1,'serving_unit'=>'medium','serving_weight_grams'=>182,'calories'=>95,'protein_g'=>0.5,'carbs_g'=>25,'fat_g'=>0.3,'fiber_g'=>4.4,'sugar_g'=>19,'sodium_mg'=>2],
            ['nutritionix_id'=>null,'name'=>'Salmon','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>208,'protein_g'=>20,'carbs_g'=>0,'fat_g'=>13,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>59],
            ['nutritionix_id'=>null,'name'=>'Sweet Potato','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>86,'protein_g'=>1.6,'carbs_g'=>20,'fat_g'=>0.1,'fiber_g'=>3,'sugar_g'=>4.2,'sodium_mg'=>55],
            ['nutritionix_id'=>null,'name'=>'Almonds','brand'=>null,'serving_qty'=>28,'serving_unit'=>'g','serving_weight_grams'=>28,'calories'=>164,'protein_g'=>6,'carbs_g'=>6,'fat_g'=>14,'fiber_g'=>3.5,'sugar_g'=>1.2,'sodium_mg'=>0],
            ['nutritionix_id'=>null,'name'=>'Broccoli','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>34,'protein_g'=>2.8,'carbs_g'=>7,'fat_g'=>0.4,'fiber_g'=>2.6,'sugar_g'=>1.7,'sodium_mg'=>33],
            ['nutritionix_id'=>null,'name'=>'Orange Juice','brand'=>null,'serving_qty'=>240,'serving_unit'=>'ml','serving_weight_grams'=>249,'calories'=>112,'protein_g'=>1.7,'carbs_g'=>26,'fat_g'=>0.5,'fiber_g'=>0.5,'sugar_g'=>21,'sodium_mg'=>2],
            ['nutritionix_id'=>null,'name'=>'White Rice','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>130,'protein_g'=>2.7,'carbs_g'=>28,'fat_g'=>0.3,'fiber_g'=>0.4,'sugar_g'=>0,'sodium_mg'=>1],
            ['nutritionix_id'=>null,'name'=>'Tuna (canned)','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>116,'protein_g'=>26,'carbs_g'=>0,'fat_g'=>1,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>333],
        ];

        if (empty($query)) return array_slice($all, 0, 5);

        $q = strtolower(trim($query));
        $filtered = array_filter($all, fn($f) => str_contains(strtolower($f['name']), $q));
        return array_values($filtered);
    }
}
