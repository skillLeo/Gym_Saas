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

    public function search(Request $request)
    {
        $request->validate(['q' => 'required|string|min:1|max:200']);
        $query = $request->q;

        $cacheKey = 'nutritionix_search_' . md5($query);
        $results  = Cache::remember($cacheKey, 3600, function () use ($query, $request) {
            if (!$this->hasApiKeys()) {
                return $this->sampleFoods();
            }
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

    private function sampleFoods(): array
    {
        return [
            ['nutritionix_id'=>null,'name'=>'Chicken Breast','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>165,'protein_g'=>31,'carbs_g'=>0,'fat_g'=>3.6,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>74],
            ['nutritionix_id'=>null,'name'=>'Brown Rice (cooked)','brand'=>null,'serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>112,'protein_g'=>2.6,'carbs_g'=>23.5,'fat_g'=>0.9,'fiber_g'=>1.8,'sugar_g'=>0.4,'sodium_mg'=>5],
            ['nutritionix_id'=>null,'name'=>'Banana','brand'=>null,'serving_qty'=>1,'serving_unit'=>'medium','serving_weight_grams'=>118,'calories'=>89,'protein_g'=>1.1,'carbs_g'=>23,'fat_g'=>0.3,'fiber_g'=>2.6,'sugar_g'=>12,'sodium_mg'=>1],
            ['nutritionix_id'=>null,'name'=>'Whole Milk','brand'=>null,'serving_qty'=>240,'serving_unit'=>'ml','serving_weight_grams'=>244,'calories'=>149,'protein_g'=>8,'carbs_g'=>11.7,'fat_g'=>8,'fiber_g'=>0,'sugar_g'=>12.3,'sodium_mg'=>105],
            ['nutritionix_id'=>null,'name'=>'Egg','brand'=>null,'serving_qty'=>1,'serving_unit'=>'large','serving_weight_grams'=>50,'calories'=>72,'protein_g'=>6.3,'carbs_g'=>0.4,'fat_g'=>5,'fiber_g'=>0,'sugar_g'=>0.2,'sodium_mg'=>71],
        ];
    }
}
