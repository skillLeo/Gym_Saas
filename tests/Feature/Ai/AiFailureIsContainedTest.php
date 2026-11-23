<?php

namespace Tests\Feature\Ai;

use App\Models\AiUsageLog;
use App\Models\FoodItem;
use App\Models\MealSlot;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\Ai\AiSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The AI features failing must not take anything else with them.
 *
 * They are an optional convenience bolted onto a food journal that worked
 * without them and has to keep working without them. The ways they can fail —
 * an admin pulling the kill switch, the month's budget running out, a missing
 * key, the provider being down — are all states this app will genuinely be in
 * at some point, and none of them is allowed to stop a member logging lunch.
 *
 * Each state is applied and then the ordinary member surfaces are walked.
 */
class AiFailureIsContainedTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private MealSlot $slot;
    private FoodItem $food;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ai.api_key'            => 'sk-svcacct-TESTONLY0000000000000000',
            'ai.consent_version'    => '1',
            'ai.retry.backoff_ms'   => 0,
            'services.usda.api_key' => 'TEST-USDA-KEY',
        ]);

        Http::preventStrayRequests();

        $this->user = User::factory()->create([
            'email_verified_at'   => now(),
            'trial_ends_at'       => now()->addDays(20),
            'ai_features_enabled' => true,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => '1',
        ]);

        MealSlot::seedDefaultsFor($this->user->id);
        $this->slot = MealSlot::where('user_id', $this->user->id)->orderBy('sort_order')->first();

        $this->food = FoodItem::create([
            'name' => 'Chicken breast, raw', 'serving_qty' => 100, 'serving_unit' => 'g',
            'serving_weight_grams' => 100, 'calories' => 120, 'protein_g' => 22.5,
            'carbs_g' => 0, 'fat_g' => 2.6, 'is_custom' => false,
        ]);

        Sanctum::actingAs($this->user);
    }

    // ----------------------------------------------------- failure states

    /** @return array<string, array{0: callable}> */
    public static function brokenStates(): array
    {
        return [
            'kill switch off' => [fn () => app(AiSettings::class)->set('ai_enabled', false)],

            'monthly cap reached' => [function () {
                app(AiSettings::class)->set('ai_monthly_cap_usd', 1);
                AiUsageLog::create([
                    'feature' => 'food_analyze_image', 'model' => 'gpt-6-luna',
                    'estimated_cost_usd' => 5, 'status' => 'ok',
                ]);
            }],

            'no api key' => [fn () => config(['ai.api_key' => null])],

            'daily limit used up' => [function () {
                app(AiSettings::class)->set('ai_daily_limit_per_user', 1);
                AiUsageLog::create([
                    'user_id' => User::first()->id, 'feature' => 'food_analyze_text',
                    'model' => 'gpt-6-luna', 'estimated_cost_usd' => 0.0001, 'status' => 'ok',
                ]);
            }],
        ];
    }

    #[DataProvider('brokenStates')]
    public function test_manual_food_logging_survives(callable $break): void
    {
        $break();

        $this->postJson('/api/food-log', [
            'food_item_id' => $this->food->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1.5,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.total_calories', 180);
    }

    /**
     * A meal already analysed and already corrected must still save.
     *
     * The limits exist to stop money being spent. /confirm spends none: the
     * analysis is paid for, the member has spent a minute fixing the portions,
     * and this writes journal rows exactly as manual logging does. It sat
     * behind the same gate as /analyze, so a daily count or a monthly cap
     * reached DURING the review — by the member's own second device, or by
     * another member pushing the shared cap over — answered 429 and the
     * frontend threw the whole reviewed draft away.
     *
     * The refusal saved nothing. The money was already gone.
     *
     * Only the limit states are exercised here. The kill switch and a
     * withdrawn consent legitimately close the whole feature, and are left
     * refusing.
     *
     * @return array<string, array{0: callable}>
     */
    public static function limitStates(): array
    {
        $all = self::brokenStates();

        return [
            'monthly cap reached' => $all['monthly cap reached'],
            'daily limit used up' => $all['daily limit used up'],
        ];
    }

    #[DataProvider('brokenStates')]
    public function test_the_journal_and_its_totals_survive(callable $break): void
    {
        $break();

        $this->getJson('/api/food-log?date=2026-10-30')->assertOk();
        $this->getJson('/api/food-log/summary?date=2026-10-30')->assertOk();
        $this->getJson('/api/food-log/history?period=week')->assertOk();
        $this->getJson('/api/meal-slots')->assertOk();
        $this->getJson('/api/food/recent')->assertOk();
    }

    #[DataProvider('brokenStates')]
    public function test_food_search_and_barcode_survive(callable $break): void
    {
        $break();

        Http::fake(['*api.nal.usda.gov*' => Http::response(['foods' => []])]);

        // These go to USDA, which has nothing to do with the AI provider.
        $this->getJson('/api/food/search?q=chicken')->assertOk();
        $this->getJson('/api/food/integration-status')->assertOk();

        // A barcode nothing matches is a 404 by design — "no such product" is
        // a real answer. What matters here is that it still ANSWERS rather
        // than erroring, so the assertion is on the endpoint working, not on
        // it finding something.
        $barcode = $this->getJson('/api/food/barcode/0123456789012');
        $this->assertContains($barcode->status(), [200, 404], 'barcode returned '.$barcode->status());
    }

    #[DataProvider('brokenStates')]
    public function test_logging_from_an_external_food_survives(callable $break): void
    {
        $break();

        $this->postJson('/api/food-log/from-api', [
            'food_data' => [
                'external_food_id' => '1102644', 'name' => 'Apples, raw',
                'serving_qty' => 100, 'serving_unit' => 'g',
                'calories' => 52, 'protein_g' => 0.3, 'carbs_g' => 13.8, 'fat_g' => 0.2,
            ],
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->assertStatus(201);
    }

    #[DataProvider('brokenStates')]
    public function test_a_custom_food_can_still_be_created(callable $break): void
    {
        $break();

        $this->postJson('/api/food/custom', [
            'name' => 'My own recipe', 'serving_qty' => 1, 'serving_unit' => 'bowl',
            'serving_weight_grams' => 400, 'calories' => 500, 'protein_g' => 30,
            'carbs_g' => 50, 'fat_g' => 15,
        ])->assertStatus(201);
    }

    #[DataProvider('brokenStates')]
    public function test_the_rest_of_the_app_survives(callable $break): void
    {
        $break();

        // A spread of member surfaces that have nothing to do with AI. If a
        // kill switch can reach these, it was wired far too widely.
        foreach ([
            '/api/dashboard',
            '/api/water-log?date=2026-10-30',
            '/api/fitness-logs',
            '/api/body-stats',
            '/api/fitness-goals',
            '/api/notifications',
            '/api/streaks/me',
            '/api/daily-steps',
        ] as $endpoint) {
            $this->getJson($endpoint)->assertOk();
        }
    }

    #[DataProvider('brokenStates')]
    public function test_the_ai_status_call_still_answers(callable $break): void
    {
        $break();

        // The frontend hides its entry point based on this. If it 500s in a
        // failure state, the journal page breaks for everyone who has the flag.
        $this->getJson('/api/ai/status')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    // ------------------------------------------- the AI routes themselves

    #[DataProvider('brokenStates')]
    public function test_the_ai_endpoints_refuse_cleanly_and_spend_nothing(callable $break): void
    {
        $break();

        $response = $this->postJson('/api/ai/food-log/analyze', ['text' => 'an apple']);

        // Never a 500: a known failure state must produce a known answer.
        $this->assertContains($response->status(), [403, 429], 'status was '.$response->status());
        $this->assertNotNull($response->json('code'));

        Http::assertNothingSent();
    }

    // ------------------------------------- a provider outage, mid-request

    public function test_a_provider_outage_leaves_the_journal_untouched(callable|null $break = null): void
    {
        Http::fake(['*/responses' => Http::response([], 503)]);

        $this->postJson('/api/ai/food-log/analyze', ['text' => 'an apple'])
            ->assertStatus(503)
            ->assertJsonPath('code', 'ai_unavailable')
            // The way out is always offered.
            ->assertJsonPath('fallback', 'manual');

        $this->assertDatabaseCount('food_log_entries', 0);

        // And the manual route still works immediately afterwards.
        $this->postJson('/api/food-log', [
            'food_item_id' => $this->food->id,
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'servings'     => 1,
        ])->assertStatus(201);
    }

    #[DataProvider('limitStates')]
    public function test_confirm_keeps_working_when_analyse_cannot(callable $break): void
    {
        $break();

        // Analysing is refused, because analysing is what costs money.
        $this->postJson('/api/ai/food-log/analyze', ['text' => 'an apple'])
            ->assertStatus(429)
            ->assertJsonPath('fallback', 'manual');

        // Saving the draft that was already paid for is not.
        $this->postJson('/api/ai/food-log/confirm', [
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'items'        => [['grams' => 100, 'food' => [
                'external_food_id' => '1102644', 'name' => 'Apples, raw',
                'serving_qty' => 100, 'serving_unit' => 'g', 'serving_weight_grams' => 100,
                'calories' => 52, 'protein_g' => 0.3, 'carbs_g' => 13.8, 'fat_g' => 0.2,
            ]]],
        ])->assertStatus(201);

        $this->assertDatabaseCount('food_log_entries', 1);

        Http::assertNothingSent();
    }

    public function test_confirm_is_still_refused_when_the_feature_is_switched_off(): void
    {
        /*
         * The limits are a spend control and confirm spends nothing. The kill
         * switch and consent are not spend controls — they are "this feature
         * is not running" and "this member did not agree to it" — and those
         * still close every AI route, including this one.
         */
        app(AiSettings::class)->set('ai_enabled', false);

        $this->postJson('/api/ai/food-log/confirm', [
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'items'        => [['food_item_id' => $this->food->id, 'grams' => 100]],
        ])->assertStatus(403);

        $this->user->forceFill(['ai_consent_at' => null, 'ai_consent_version' => null])->save();
        app(AiSettings::class)->set('ai_enabled', true);

        $this->postJson('/api/ai/food-log/confirm', [
            'meal_slot_id' => $this->slot->id,
            'logged_date'  => '2026-10-30',
            'items'        => [['food_item_id' => $this->food->id, 'grams' => 100]],
        ])->assertStatus(403);

        $this->assertDatabaseCount('food_log_entries', 0);
    }

    public function test_an_admin_can_see_usage_in_every_failure_state(): void
    {
        $admin = User::factory()->create([
            'email_verified_at' => now(), 'trial_ends_at' => now()->addDays(20), 'is_admin' => true,
        ]);

        foreach (self::brokenStates() as $name => [$break]) {
            SystemSetting::query()->delete();
            $break();

            Sanctum::actingAs($admin);

            // The screen an admin goes to when something is wrong must work
            // precisely when something is wrong.
            $this->getJson('/api/admin/ai-usage')->assertOk();
        }
    }
}
