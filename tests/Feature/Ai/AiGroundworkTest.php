<?php

namespace Tests\Feature\Ai;

use App\Models\AiUsageLog;
use App\Models\FoodItem;
use App\Models\MealSlot;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiSettings;
use App\Services\Ai\Exceptions\AiLimitReached;
use App\Services\Ai\Exceptions\AiUnavailable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Stage 1 groundwork: the flag, consent, the limits and the spend cap.
 *
 * Every test here is about whether a call is ALLOWED to happen. None of them
 * reach OpenAI: Http::fake() is asserted to have recorded nothing wherever the
 * expected outcome is a refusal, which is the only way to prove a guard stops
 * the spend rather than merely changing the status code after the money is
 * gone.
 *
 * The probe route stands in for the Stage 2 endpoints, which do not exist yet.
 * It carries the same middleware stack they will, so what is proven here is
 * the stack, not the probe.
 */
class AiGroundworkTest extends TestCase
{
    use RefreshDatabase;

    /** The key the tests run with. Fake, but shaped like the real thing. */
    private const FAKE_KEY = 'sk-svcacct-TESTONLY000000000000000000000000000000000000000';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ai.api_key'         => self::FAKE_KEY,
            'ai.consent_version' => '1',
        ]);

        // Nothing in this suite should reach the network. Any call that does is
        // a bug in a guard, and the fake makes that visible instead of silently
        // spending.
        Http::preventStrayRequests();
        Http::fake();

        Route::middleware(['auth:sanctum', 'member', 'ai.access'])
            ->post('/__test/ai-probe', fn () => response()->json(['success' => true, 'data' => 'reached']));
    }

    // ------------------------------------------------------------- helpers

    /** A member who can reach subscribed routes: verified, on an active trial. */
    private function member(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'email_verified_at' => now(),
            'trial_starts_at'   => now()->subDay(),
            'trial_ends_at'     => now()->addDays(20),
        ], $attributes));
    }

    private function enabledMember(): User
    {
        return $this->member([
            'ai_features_enabled' => true,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => '1',
        ]);
    }

    private function admin(): User
    {
        return $this->member(['is_admin' => true]);
    }

    private function probe(User $user)
    {
        Sanctum::actingAs($user);

        return $this->postJson('/__test/ai-probe');
    }

    /** Burn $amount of the monthly budget, as the logger would. */
    private function spend(float $amount, ?User $user = null): void
    {
        AiUsageLog::create([
            'user_id'            => $user?->id,
            'feature'            => 'food_analyze_image',
            'model'              => 'gpt-6-luna',
            'input_tokens'       => 1000,
            'output_tokens'      => 200,
            'estimated_cost_usd' => $amount,
            'status'             => 'ok',
            'latency_ms'         => 900,
        ]);
    }

    // ------------------------------------------- (a) the per-member flag

    public function test_member_without_the_flag_is_refused(): void
    {
        $user = $this->member([
            'ai_consent_at'      => now(),
            'ai_consent_version' => '1',
        ]);

        $this->probe($user)
            ->assertStatus(403)
            ->assertJsonPath('code', 'ai_not_enabled_for_user');

        Http::assertNothingSent();
    }

    public function test_the_flag_is_off_for_a_newly_created_member(): void
    {
        $this->assertFalse($this->member()->ai_features_enabled);
    }

    public function test_an_admin_can_switch_the_flag_on_for_one_member(): void
    {
        $member = $this->member([
            'ai_consent_at'      => now(),
            'ai_consent_version' => '1',
        ]);

        Sanctum::actingAs($this->admin());

        $this->postJson("/api/admin/users/{$member->id}/ai-features", ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('data.ai_features_enabled', true);

        $this->assertTrue($member->fresh()->ai_features_enabled);
        $this->probe($member->fresh())->assertOk();
    }

    public function test_a_member_cannot_switch_the_flag_on_for_themselves(): void
    {
        $user = $this->member();

        Sanctum::actingAs($user);

        $this->postJson("/api/admin/users/{$user->id}/ai-features", ['enabled' => true])
            ->assertStatus(403);

        $this->assertFalse($user->fresh()->ai_features_enabled);
    }

    public function test_beta_mode_off_lets_any_consenting_member_through(): void
    {
        app(AiSettings::class)->set('ai_beta_mode', false);

        $user = $this->member([
            'ai_consent_at'      => now(),
            'ai_consent_version' => '1',
        ]);

        $this->probe($user)->assertOk();
    }

    // ------------------------------------------------------ (c) consent

    public function test_no_call_is_possible_without_consent(): void
    {
        $user = $this->member(['ai_features_enabled' => true]);

        $this->probe($user)
            ->assertStatus(403)
            ->assertJsonPath('code', 'ai_consent_required');

        Http::assertNothingSent();
    }

    public function test_consent_is_recorded_with_a_timestamp_and_version(): void
    {
        $user = $this->member(['ai_features_enabled' => true]);

        Sanctum::actingAs($user);

        $this->postJson('/api/ai/consent', ['version' => '1', 'accepted' => true])
            ->assertOk();

        $user->refresh();
        $this->assertNotNull($user->ai_consent_at);
        $this->assertSame('1', $user->ai_consent_version);

        $this->probe($user)->assertOk();
    }

    public function test_consent_for_a_different_version_is_rejected(): void
    {
        $user = $this->member(['ai_features_enabled' => true]);

        Sanctum::actingAs($user);

        $this->postJson('/api/ai/consent', ['version' => '0', 'accepted' => true])
            ->assertStatus(409)
            ->assertJsonPath('code', 'ai_consent_version_mismatch');

        $this->assertNull($user->fresh()->ai_consent_at);
    }

    public function test_reworded_terms_invalidate_an_earlier_consent(): void
    {
        $user = $this->enabledMember();
        $this->probe($user)->assertOk();

        // The notice is rewritten and the version bumped.
        config(['ai.consent_version' => '2']);

        $this->probe($user)
            ->assertStatus(403)
            ->assertJsonPath('code', 'ai_consent_required');
    }

    public function test_a_member_can_withdraw_consent(): void
    {
        $user = $this->enabledMember();

        Sanctum::actingAs($user);
        $this->deleteJson('/api/ai/consent')->assertOk();

        $this->assertNull($user->fresh()->ai_consent_at);
        $this->probe($user->fresh())->assertStatus(403);
    }

    public function test_the_client_calls_the_gate_even_without_the_middleware(): void
    {
        // A controller that forgets `ai.access` must still not be able to spend.
        $user = $this->member(['ai_features_enabled' => true]); // no consent

        $this->expectException(AiUnavailable::class);

        try {
            app(AiClient::class)->structured(
                'food_analyze_text',
                [['role' => 'user', 'content' => 'an apple']],
                ['type' => 'object', 'properties' => [], 'additionalProperties' => false],
                'probe',
                'text',
                $user,
            );
        } finally {
            Http::assertNothingSent();
            $this->assertDatabaseHas('ai_usage_logs', [
                'user_id' => $user->id,
                'status'  => 'blocked',
            ]);
        }
    }

    // ------------------------------------------- (b) the cap and the limits

    public function test_reaching_the_cap_refuses_the_call(): void
    {
        app(AiSettings::class)->set('ai_monthly_cap_usd', 8.00);
        $this->spend(8.00);

        $this->probe($this->enabledMember())
            ->assertStatus(429)
            ->assertJsonPath('code', 'ai_limit_reached')
            ->assertJsonPath('reason', 'cap_reached')
            // The frontend relies on this to offer the manual route rather than
            // leaving the member at a dead end.
            ->assertJsonPath('fallback', 'manual');

        Http::assertNothingSent();
    }

    public function test_spend_below_the_cap_is_allowed(): void
    {
        app(AiSettings::class)->set('ai_monthly_cap_usd', 8.00);
        $this->spend(7.99);

        $this->probe($this->enabledMember())->assertOk();
    }

    public function test_last_months_spend_does_not_count_against_this_month(): void
    {
        app(AiSettings::class)->set('ai_monthly_cap_usd', 8.00);

        $this->spend(50.00);
        AiUsageLog::query()->update(['created_at' => now()->subMonth()->startOfMonth()]);

        $this->probe($this->enabledMember())->assertOk();
    }

    public function test_manual_food_logging_still_works_when_the_cap_is_reached(): void
    {
        app(AiSettings::class)->set('ai_monthly_cap_usd', 8.00);
        $this->spend(8.00);

        $user = $this->enabledMember();
        MealSlot::seedDefaultsFor($user->id);
        $slot = MealSlot::where('user_id', $user->id)->first();

        $food = FoodItem::create([
            'name' => 'Chicken breast, raw', 'serving_qty' => 100, 'serving_unit' => 'g',
            'serving_weight_grams' => 100, 'calories' => 120, 'protein_g' => 22.5,
            'carbs_g' => 0, 'fat_g' => 2.6, 'is_custom' => false,
        ]);

        Sanctum::actingAs($user);

        // The AI route is refused ...
        $this->postJson('/__test/ai-probe')->assertStatus(429);

        // ... and the ordinary journal is completely unaffected.
        $this->postJson('/api/food-log', [
            'food_item_id' => $food->id,
            'meal_slot_id' => $slot->id,
            'logged_date'  => now()->toDateString(),
            'servings'     => 1.5,
        ])->assertStatus(201)->assertJsonPath('success', true);

        $this->assertDatabaseHas('food_log_entries', [
            'user_id'        => $user->id,
            'food_item_id'   => $food->id,
            'total_calories' => 180,
        ]);

        // Food search and the summary endpoint are untouched too.
        $this->getJson('/api/food-log/summary?date='.now()->toDateString())->assertOk();
    }

    public function test_a_cap_of_zero_means_no_cap(): void
    {
        app(AiSettings::class)->set('ai_monthly_cap_usd', 0);
        $this->spend(500.00);

        $this->probe($this->enabledMember())->assertOk();
    }

    public function test_the_daily_limit_counts_only_successful_calls(): void
    {
        app(AiSettings::class)->set('ai_daily_limit_per_user', 2);
        app(AiSettings::class)->set('ai_per_minute_per_user', 0);

        $user = $this->enabledMember();

        // Two failures should not consume the member's allowance: an outage of
        // ours is not something to charge them for.
        foreach (['unavailable', 'invalid_response'] as $status) {
            AiUsageLog::create([
                'user_id' => $user->id, 'feature' => 'food_analyze_image',
                'model' => 'gpt-6-luna', 'estimated_cost_usd' => 0,
                'status' => $status, 'latency_ms' => 10,
            ]);
        }

        $this->probe($user)->assertOk();

        $this->spend(0.001, $user);
        $this->spend(0.001, $user);

        $this->probe($user)
            ->assertStatus(429)
            ->assertJsonPath('reason', 'daily_limit');
    }

    public function test_yesterdays_calls_do_not_count_against_today(): void
    {
        app(AiSettings::class)->set('ai_daily_limit_per_user', 1);
        app(AiSettings::class)->set('ai_per_minute_per_user', 0);

        $user = $this->enabledMember();
        $this->spend(0.001, $user);
        AiUsageLog::query()->update(['created_at' => now()->subDay()]);

        $this->probe($user)->assertOk();
    }

    public function test_the_per_minute_throttle_counts_every_attempt(): void
    {
        app(AiSettings::class)->set('ai_per_minute_per_user', 2);
        app(AiSettings::class)->set('ai_daily_limit_per_user', 0);

        $user = $this->enabledMember();

        // Failures DO count here — this is the limit that holds back abuse.
        foreach (range(1, 2) as $i) {
            AiUsageLog::create([
                'user_id' => $user->id, 'feature' => 'food_analyze_image',
                'model' => 'gpt-6-luna', 'estimated_cost_usd' => 0,
                'status' => 'unavailable', 'latency_ms' => 10,
            ]);
        }

        $this->probe($user)
            ->assertStatus(429)
            ->assertJsonPath('reason', 'rate_limit');
    }

    public function test_one_members_usage_does_not_limit_another(): void
    {
        app(AiSettings::class)->set('ai_daily_limit_per_user', 1);
        app(AiSettings::class)->set('ai_per_minute_per_user', 0);

        $heavy = $this->enabledMember();
        $this->spend(0.001, $heavy);
        $this->probe($heavy)->assertStatus(429);

        $this->probe($this->enabledMember())->assertOk();
    }

    public function test_the_gate_throws_a_typed_limit_error(): void
    {
        app(AiSettings::class)->set('ai_monthly_cap_usd', 1.00);
        $this->spend(1.00);

        $this->expectException(AiLimitReached::class);

        app(\App\Services\Ai\AiGate::class)->assertWithinLimits($this->enabledMember());
    }

    // --------------------------------------------------- the kill switch

    public function test_the_kill_switch_stops_every_call(): void
    {
        app(AiSettings::class)->set('ai_enabled', false);

        $this->probe($this->enabledMember())
            ->assertStatus(403)
            ->assertJsonPath('code', 'ai_disabled');

        Http::assertNothingSent();
    }

    public function test_the_kill_switch_does_not_affect_manual_logging(): void
    {
        app(AiSettings::class)->set('ai_enabled', false);

        $user = $this->enabledMember();
        MealSlot::seedDefaultsFor($user->id);

        Sanctum::actingAs($user);

        $this->getJson('/api/food-log?date='.now()->toDateString())->assertOk();
        $this->getJson('/api/meal-slots')->assertOk();
        $this->getJson('/api/food-log/summary?date='.now()->toDateString())->assertOk();
    }

    public function test_a_missing_api_key_is_reported_as_not_configured(): void
    {
        config(['ai.api_key' => null]);

        $this->probe($this->enabledMember())
            ->assertStatus(403)
            ->assertJsonPath('code', 'ai_not_configured');
    }

    public function test_an_admin_cannot_use_member_ai_features(): void
    {
        $this->probe($this->admin())->assertStatus(403);
    }

    // ------------------------------------------------ the admin usage page

    public function test_the_usage_page_is_admin_only(): void
    {
        Sanctum::actingAs($this->enabledMember());
        $this->getJson('/api/admin/ai-usage')->assertStatus(403);

        Sanctum::actingAs($this->admin());
        $this->getJson('/api/admin/ai-usage')->assertOk();
    }

    public function test_the_usage_page_reports_spend_against_the_cap(): void
    {
        app(AiSettings::class)->set('ai_monthly_cap_usd', 8.00);
        $user = $this->enabledMember();
        $this->spend(2.00, $user);

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/admin/ai-usage')
            ->assertOk()
            ->assertJsonPath('data.month.spent_usd', 2)
            ->assertJsonPath('data.month.cap_usd', 8)
            ->assertJsonPath('data.month.remaining_usd', 6)
            ->assertJsonPath('data.month.percent_used', 25)
            ->assertJsonPath('data.month.cap_reached', false)
            ->assertJsonPath('data.by_feature.0.feature', 'food_analyze_image')
            ->assertJsonPath('data.month.uncapped', false)
            ->assertJsonPath('data.top_users.0.user_id', $user->id)
            ->assertJsonPath('data.api_key_present', true);
    }

    public function test_a_cap_of_zero_is_reported_as_no_cap_rather_than_no_budget(): void
    {
        /*
         * Zero switches the cap OFF — that is what assertWithinLimits() does
         * and what the setting means. The usage page used to render it as
         * "$0.00 of $0.00, $0.00 left", which is how a screen says "you have
         * run out", above a feature that was in fact spending with no ceiling.
         * The most reassuring possible display of the least safe state.
         */
        app(AiSettings::class)->set('ai_monthly_cap_usd', 0);
        $this->spend(3.00, $this->enabledMember());

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/admin/ai-usage')
            ->assertOk()
            ->assertJsonPath('data.month.uncapped', true)
            ->assertJsonPath('data.month.cap_reached', false)
            // Null, not 0: "not applicable", which a screen can render as words.
            ->assertJsonPath('data.month.remaining_usd', null)
            ->assertJsonPath('data.month.percent_used', null)
            ->assertJsonPath('data.month.spent_usd', 3);
    }

    public function test_a_cap_of_zero_really_does_let_spending_through(): void
    {
        // The display fix above is only honest if this is what happens.
        app(AiSettings::class)->set('ai_monthly_cap_usd', 0);
        $user = $this->enabledMember();
        $this->spend(500.00, $user);

        Sanctum::actingAs($user);
        app(\App\Services\Ai\AiGate::class)->assertWithinLimits($user);

        $this->addToAssertionCount(1);
    }

    public function test_an_admin_can_change_the_cap_and_the_kill_switch(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/ai-usage/settings', [
            'ai_enabled'         => false,
            'ai_monthly_cap_usd' => 3.50,
        ])->assertOk()
            ->assertJsonPath('data.ai_enabled', false)
            ->assertJsonPath('data.ai_monthly_cap_usd', 3.5);

        $this->assertFalse(app(AiSettings::class)->enabled());
        $this->assertSame(3.5, app(AiSettings::class)->monthlyCapUsd());
    }

    public function test_an_absurd_cap_is_rejected(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/ai-usage/settings', ['ai_monthly_cap_usd' => 100000])
            ->assertStatus(422);
    }

    public function test_settings_fall_back_to_the_configured_defaults(): void
    {
        // Nothing saved yet: the defaults must apply, not zero or false. A cap
        // read as 0 would mean "no cap" and a switch read as false would mean
        // the feature was dead on a fresh install.
        $this->assertTrue(app(AiSettings::class)->enabled());
        $this->assertSame(8.00, app(AiSettings::class)->monthlyCapUsd());
        $this->assertSame(20, app(AiSettings::class)->dailyLimitPerUser());
    }

    public function test_a_cleared_setting_falls_back_rather_than_reading_as_zero(): void
    {
        SystemSetting::set('ai_monthly_cap_usd', '', 'ai', false);

        $this->assertSame(8.00, app(AiSettings::class)->monthlyCapUsd());
    }

    // ----------------------------------------------------- the status call

    public function test_status_tells_a_member_why_they_have_no_access(): void
    {
        Sanctum::actingAs($this->member());

        $this->getJson('/api/ai/status')
            ->assertOk()
            ->assertJsonPath('data.available', false)
            ->assertJsonPath('data.reason', 'ai_not_enabled_for_user')
            ->assertJsonPath('data.consent_required', false);
    }

    public function test_status_distinguishes_missing_consent_from_no_access(): void
    {
        Sanctum::actingAs($this->member(['ai_features_enabled' => true]));

        $this->getJson('/api/ai/status')
            ->assertOk()
            ->assertJsonPath('data.available', false)
            ->assertJsonPath('data.consent_required', true);
    }

    public function test_status_reports_the_remaining_daily_allowance(): void
    {
        app(AiSettings::class)->set('ai_daily_limit_per_user', 20);

        $user = $this->enabledMember();
        $this->spend(0.001, $user);

        Sanctum::actingAs($user);

        $this->getJson('/api/ai/status')
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.daily_remaining', 19);
    }
}
