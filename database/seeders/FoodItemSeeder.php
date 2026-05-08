<?php
namespace Database\Seeders;
use App\Models\FoodItem;
use Illuminate\Database\Seeder;

class FoodItemSeeder extends Seeder
{
    public function run(): void
    {
        $foods = [
            ['name'=>'Chicken Breast','serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>165,'protein_g'=>31,'carbs_g'=>0,'fat_g'=>3.6,'fiber_g'=>0,'sugar_g'=>0,'sodium_mg'=>74],
            ['name'=>'Brown Rice (cooked)','serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>112,'protein_g'=>2.6,'carbs_g'=>23.5,'fat_g'=>0.9,'fiber_g'=>1.8,'sugar_g'=>0.4,'sodium_mg'=>5],
            ['name'=>'Banana','serving_qty'=>1,'serving_unit'=>'medium','serving_weight_grams'=>118,'calories'=>89,'protein_g'=>1.1,'carbs_g'=>23,'fat_g'=>0.3,'fiber_g'=>2.6,'sugar_g'=>12,'sodium_mg'=>1],
            ['name'=>'Whole Milk','serving_qty'=>240,'serving_unit'=>'ml','serving_weight_grams'=>244,'calories'=>149,'protein_g'=>8,'carbs_g'=>11.7,'fat_g'=>8,'fiber_g'=>0,'sugar_g'=>12.3,'sodium_mg'=>105],
            ['name'=>'Egg','serving_qty'=>1,'serving_unit'=>'large','serving_weight_grams'=>50,'calories'=>72,'protein_g'=>6.3,'carbs_g'=>0.4,'fat_g'=>5,'fiber_g'=>0,'sugar_g'=>0.2,'sodium_mg'=>71],
            ['name'=>'Oatmeal (cooked)','serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>71,'protein_g'=>2.5,'carbs_g'=>12,'fat_g'=>1.5,'fiber_g'=>1.7,'sugar_g'=>0.3,'sodium_mg'=>49],
            ['name'=>'Greek Yogurt (plain, non-fat)','serving_qty'=>170,'serving_unit'=>'g','serving_weight_grams'=>170,'calories'=>100,'protein_g'=>17,'carbs_g'=>6,'fat_g'=>0.7,'fiber_g'=>0,'sugar_g'=>6,'sodium_mg'=>65],
            ['name'=>'Almonds','serving_qty'=>28,'serving_unit'=>'g','serving_weight_grams'=>28,'calories'=>164,'protein_g'=>6,'carbs_g'=>6,'fat_g'=>14,'fiber_g'=>3.5,'sugar_g'=>1.2,'sodium_mg'=>0],
            ['name'=>'Sweet Potato','serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>86,'protein_g'=>1.6,'carbs_g'=>20,'fat_g'=>0.1,'fiber_g'=>3,'sugar_g'=>4.2,'sodium_mg'=>55],
            ['name'=>'Broccoli','serving_qty'=>100,'serving_unit'=>'g','serving_weight_grams'=>100,'calories'=>34,'protein_g'=>2.8,'carbs_g'=>7,'fat_g'=>0.4,'fiber_g'=>2.6,'sugar_g'=>1.7,'sodium_mg'=>33],
        ];

        foreach ($foods as $food) {
            FoodItem::firstOrCreate(['name' => $food['name'], 'is_custom' => false], $food);
        }
    }
}
