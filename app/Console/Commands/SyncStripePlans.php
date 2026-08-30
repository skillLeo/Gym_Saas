<?php

namespace App\Console\Commands;

use App\Models\SubscriptionPlan;
use Illuminate\Console\Command;
use Stripe\Price;
use Stripe\Product;
use Stripe\Stripe;

/**
 * Creates the three tiers in Stripe and mirrors them into `subscription_plans`.
 *
 * Idempotent — safe to re-run on every deploy. Products are matched by a
 * `plan_key` metadata field and prices by `lookup_key`, so a second run finds
 * what the first created instead of duplicating it.
 *
 * Stripe prices are immutable: an amount cannot be edited. When a price changes
 * here, a new Price is created and the lookup key is transferred to it
 * (`transfer_lookup_key`), leaving the old price intact so existing subscribers
 * keep billing at the rate they signed up on.
 */
class SyncStripePlans extends Command
{
    protected $signature   = 'stripe:sync-plans {--dry-run : Show what would change without writing to Stripe}';
    protected $description = 'Create/sync subscription plans in Stripe and the local database';

    /**
     * Canonical plan definitions.
     *
     * Annual VIP is priced at exactly 10x the Premium monthly rate, so "2 months
     * free" is literally true rather than marketing rounding.
     */
    private const PLANS = [
        [
            'key'          => SubscriptionPlan::KEY_BASIC,
            'name'         => 'Basic',
            'description'  => 'Food and water logging, workout tracking, and progress charts.',
            'amount_cents' => 999,
            'interval'     => 'month',
            'lookup_key'   => 'basic_monthly',
            'sort_order'   => 1,
            'features'     => [
                'Food and water journal',
                'Workout logging',
                'Body stats and progress charts',
                'Recipe library',
            ],
        ],
        [
            'key'          => SubscriptionPlan::KEY_PREMIUM,
            'name'         => 'Premium',
            'description'  => 'Everything in Basic, plus live sessions, meal planning, and the full video library.',
            'amount_cents' => 1999,
            'interval'     => 'month',
            'lookup_key'   => 'premium_monthly',
            'sort_order'   => 2,
            'features'     => [
                'Everything in Basic',
                'Full video library',
                'Live sessions',
                'Meal planning and shopping lists',
                'Community groups and messaging',
            ],
        ],
        [
            'key'          => SubscriptionPlan::KEY_ANNUAL_VIP,
            'name'         => 'Annual VIP',
            'description'  => 'Everything in Premium, billed yearly. Ten months for the price of twelve.',
            'amount_cents' => 19990,
            'interval'     => 'year',
            'lookup_key'   => 'annual_vip_yearly',
            'sort_order'   => 3,
            'features'     => [
                'Everything in Premium',
                'Two months free versus monthly billing',
                'Priority support',
                'Early access to new programmes',
            ],
        ],
    ];

    public function handle(): int
    {
        $secret = config('services.stripe.secret');
        if (blank($secret)) {
            $this->error('STRIPE_SECRET is not set. Nothing to sync.');

            return self::FAILURE;
        }

        Stripe::setApiKey($secret);
        $dryRun = (bool) $this->option('dry-run');

        foreach (self::PLANS as $definition) {
            $this->syncPlan($definition, $dryRun);
        }

        $this->newLine();
        $this->info($dryRun ? 'Dry run complete — nothing was written.' : 'Plans synced.');

        return self::SUCCESS;
    }

    private function syncPlan(array $definition, bool $dryRun): void
    {
        $this->line("→ {$definition['name']} ({$definition['key']})");

        $product = $this->findOrCreateProduct($definition, $dryRun);
        $price   = $this->findOrCreatePrice($definition, $product, $dryRun);

        if ($dryRun) {
            return;
        }

        SubscriptionPlan::updateOrCreate(
            ['key' => $definition['key']],
            [
                'name'            => $definition['name'],
                'description'     => $definition['description'],
                'stripe_price_id' => $price?->id,
                'amount_cents'    => $definition['amount_cents'],
                'currency'        => 'USD',
                'interval'        => $definition['interval'],
                'features'        => $definition['features'],
                'is_active'       => true,
                'sort_order'      => $definition['sort_order'],
            ]
        );

        $this->line('    local plan row updated');
    }

    private function findOrCreateProduct(array $definition, bool $dryRun): ?Product
    {
        // Stripe cannot filter products by metadata, so scan active products.
        // There are three of them; this is not a hot path.
        $existing = collect(Product::all(['active' => true, 'limit' => 100])->data)
            ->first(fn (Product $p) => ($p->metadata['plan_key'] ?? null) === $definition['key']);

        if ($existing) {
            $this->line("    product exists: {$existing->id}");

            return $existing;
        }

        if ($dryRun) {
            $this->line('    would CREATE product');

            return null;
        }

        $product = Product::create([
            'name'        => $definition['name'],
            'description' => $definition['description'],
            'metadata'    => ['plan_key' => $definition['key']],
        ]);
        $this->line("    product created: {$product->id}");

        return $product;
    }

    private function findOrCreatePrice(array $definition, ?Product $product, bool $dryRun): ?Price
    {
        $existing = collect(Price::all([
            'lookup_keys' => [$definition['lookup_key']],
            'active'      => true,
            'limit'       => 1,
        ])->data)->first();

        $matches = $existing
            && $existing->unit_amount === $definition['amount_cents']
            && $existing->currency === 'usd'
            && ($existing->recurring->interval ?? null) === $definition['interval'];

        if ($matches) {
            $this->line("    price exists: {$existing->id} ({$this->money($definition['amount_cents'])}/{$definition['interval']})");

            return $existing;
        }

        if ($existing) {
            $this->warn(sprintf(
                '    price changed: %s → %s — creating a new price; existing subscribers keep the old rate',
                $this->money($existing->unit_amount),
                $this->money($definition['amount_cents'])
            ));
        }

        if ($dryRun || !$product) {
            $this->line('    would CREATE price');

            return null;
        }

        $price = Price::create([
            'product'     => $product->id,
            'unit_amount' => $definition['amount_cents'],
            'currency'    => 'usd',
            'recurring'   => ['interval' => $definition['interval']],
            'lookup_key'  => $definition['lookup_key'],
            // Move the lookup key off the superseded price so this one is
            // authoritative for future lookups.
            'transfer_lookup_key' => true,
        ]);
        $this->line("    price created: {$price->id} ({$this->money($definition['amount_cents'])}/{$definition['interval']})");

        return $price;
    }

    private function money(int $cents): string
    {
        return '$' . number_format($cents / 100, 2);
    }
}
