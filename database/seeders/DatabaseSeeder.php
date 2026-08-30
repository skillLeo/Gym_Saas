<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            // Before the users: a rebuilt database with no plans cannot sell
            // anything, and the membership page renders a toggle with nothing
            // under it.
            SubscriptionPlanSeeder::class,
            ResourceCategorySeeder::class,
            FoodItemSeeder::class,
            TestUserSeeder::class,
            AdminUserSeeder::class,
            RecipeSeeder::class,
            VideoSeeder::class,
            LiveSessionSeeder::class,
            // These three existed as files but were never called, so a seeded
            // database came up with `badges`, `motivational_messages` and
            // `coupon_offers` all empty — and the features that read them had
            // nothing to show. Nothing awards a badge that does not exist, the
            // motivational scheduler has no message to send, and the conversion
            // funnel has no offer to make. Same shape as the missing plans and
            // the unapproved recipes: a legitimate `migrate --seed` leaving a
            // feature silently inert with no error to explain why.
            BadgeSeeder::class,
            MotivationalMessageSeeder::class,
            CouponOfferSeeder::class,
        ]);
    }
}
