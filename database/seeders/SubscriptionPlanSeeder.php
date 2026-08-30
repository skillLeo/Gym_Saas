<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

/**
 * The three plans, so a rebuilt database can still sell something.
 *
 * These rows were only ever created by `php artisan stripe:sync-plans`, which is
 * not part of seeding. After a `migrate:fresh --seed` the table was empty, so
 * `GET /plans` returned nothing and the membership page rendered a billing
 * toggle with **no plans underneath it** — the product could not be bought at
 * all, and nothing said why.
 *
 * `stripe_price_id` is deliberately left null here. A price id belongs to one
 * Stripe account, and hardcoding this project's would silently point a different
 * deployment at someone else's prices. `SubscriptionController::plans()` only
 * returns rows that have one, so these stay invisible until
 * `stripe:sync-plans` fills them in — the honest behaviour: a plan nobody can be
 * charged for is not offered.
 *
 * The amounts mirror what that command creates in Stripe. If they ever disagree,
 * the command wins: it writes both sides.
 */
class SubscriptionPlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'key'          => 'basic',
                'name'         => 'Basic',
                'description'  => 'Food and water logging, workout tracking, and progress charts.',
                'amount_cents' => 999,
                'interval'     => 'month',
                'sort_order'   => 1,
            ],
            [
                'key'          => 'premium',
                'name'         => 'Premium',
                'description'  => 'Everything in Basic, plus live sessions, meal planning, and the full video library.',
                'amount_cents' => 1999,
                'interval'     => 'month',
                'sort_order'   => 2,
            ],
            [
                'key'          => 'annual_vip',
                'name'         => 'Annual VIP',
                'description'  => 'Everything in Premium, billed yearly. Ten months for the price of twelve.',
                'amount_cents' => 19990,
                'interval'     => 'year',
                'sort_order'   => 3,
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(
                ['key' => $plan['key']],
                $plan + ['is_active' => true],
            );
        }

        $this->command->info('3 subscription plans seeded. Run `php artisan stripe:sync-plans` to link them to Stripe before they can be sold.');
    }
}
