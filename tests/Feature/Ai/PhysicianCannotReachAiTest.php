<?php

namespace Tests\Feature\Ai;

use App\Models\MealSlot;
use App\Models\Physician;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * A physician's token must not reach the AI food endpoints.
 *
 * WHY THIS IS NOT OBVIOUS. Physicians are a separate authenticatable with
 * their own table, their own guard and their own login — they never appear in
 * `users`. But Sanctum's personal access tokens are POLYMORPHIC: the token
 * row stores a tokenable type and id, and `auth:sanctum` authenticates
 * whatever that row points at. It does not check the token against the
 * guard's configured provider.
 *
 * So "they are a different model" is not by itself a reason these routes are
 * closed to them, and the only honest way to know is to issue a real token
 * from the real login controller and call the endpoints with it.
 *
 * What makes it matter: the AI endpoints spend the client's money and write
 * into a MEMBER'S food journal. A physician reaching them would be spending
 * from the shared monthly cap, and `confirm` resolves the meal slot against
 * `$request->user()` — a caller who is not a member has no slots of their own,
 * which is a confused state rather than a safe one.
 */
class PhysicianCannotReachAiTest extends TestCase
{
    use RefreshDatabase;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ai.api_key'         => 'sk-svcacct-TESTONLY0000000000000000',
            'ai.consent_version' => '1',
        ]);

        Http::preventStrayRequests();

        $physician = Physician::create([
            'name'      => 'Dr Example',
            'email'     => 'dr@example.com',
            'password'  => 'a-long-enough-password',
            'practice_name'  => 'Example Practice',
            'practice_phone' => '+1 555 0100',
            'is_active' => true,
        ]);

        // The real token, from the real issuing call — not a fake guard.
        $this->token = $physician->createToken('coaching-portal', ['*'], now()->addHours(24))->plainTextToken;
    }

    /** @return array<string, array{0: string, 1: string, 2: array<string,mixed>}> */
    public static function aiEndpoints(): array
    {
        return [
            'analyze' => ['post', '/api/ai/food-log/analyze', ['text' => 'two eggs and toast']],
            'confirm' => ['post', '/api/ai/food-log/confirm', [
                'meal_slot_id' => 1,
                'logged_date'  => '2026-11-23',
                'items'        => [['grams' => 100, 'food' => [
                    'external_food_id' => '173944', 'name' => 'Bananas, raw',
                    'serving_qty' => 100, 'serving_unit' => 'g', 'serving_weight_grams' => 100,
                    'calories' => 89, 'protein_g' => 1.1, 'carbs_g' => 22.8, 'fat_g' => 0.3,
                ]]],
            ]],
            'status'  => ['get', '/api/ai/status', []],
            'consent' => ['post', '/api/ai/consent', ['version' => '1']],
        ];
    }

    /** @dataProvider aiEndpoints */
    #[\PHPUnit\Framework\Attributes\DataProvider('aiEndpoints')]
    public function test_a_physician_token_is_refused(string $method, string $uri, array $payload): void
    {
        // A member exists and owns slot 1, so a refusal cannot be mistaken for
        // "there was nothing there anyway".
        $member = User::factory()->create([
            'email_verified_at'   => now(),
            'trial_ends_at'       => now()->addDays(20),
            'ai_features_enabled' => true,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => '1',
        ]);
        MealSlot::seedDefaultsFor($member->id);

        $response = $this->json($method, $uri, $payload, [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $this->assertContains(
            $response->status(),
            [401, 403],
            "{$uri} answered {$response->status()} to a physician token",
        );

        // Nothing was spent and nothing was written.
        Http::assertNothingSent();
        $this->assertDatabaseCount('food_log_entries', 0);
    }

    public function test_a_physician_token_cannot_read_another_persons_food_journal(): void
    {
        /*
         * The surrounding surfaces, not only the AI ones. If the polymorphic
         * token did authenticate here, the AI endpoints would be the least of
         * it — these return the member's own meals.
         */
        foreach (['/api/food-log?date=2026-11-23', '/api/food-log/summary?date=2026-11-23', '/api/meal-slots'] as $uri) {
            $status = $this->getJson($uri, ['Authorization' => 'Bearer '.$this->token])->status();

            $this->assertContains($status, [401, 403], "{$uri} answered {$status}");
        }
    }
}
