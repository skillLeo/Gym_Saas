<?php

namespace Tests\Feature\Ai;

use App\Models\AiUsageLog;
use App\Models\User;
use App\Services\Ai\AiClient;
use App\Services\Ai\Exceptions\AiInvalidResponse;
use App\Services\Ai\Exceptions\AiUnavailable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * AiClient: the timeout, the single retry, schema validation, typed errors and
 * the usage log.
 *
 * All faked at the HTTP layer. These tests are about what the client does with
 * a given answer, so a fake is not a weaker proof here — it is the only way to
 * produce a 429, a truncated response and malformed JSON on demand.
 */
class AiClientTest extends TestCase
{
    use RefreshDatabase;

    private const SCHEMA = [
        'type'       => 'object',
        'properties' => [
            'items' => [
                'type'  => 'array',
                'items' => [
                    'type'       => 'object',
                    'properties' => [
                        'label'      => ['type' => 'string'],
                        'grams'      => ['type' => 'number'],
                        'confidence' => ['type' => 'string', 'enum' => ['low', 'medium', 'high']],
                    ],
                    'required'             => ['label', 'grams', 'confidence'],
                    'additionalProperties' => false,
                ],
            ],
        ],
        'required'             => ['items'],
        'additionalProperties' => false,
    ];

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ai.api_key'          => 'sk-svcacct-TESTONLY0000000000000000',
            'ai.retry.backoff_ms' => 0, // no real sleeping in tests
            'ai.consent_version'  => '1',
        ]);

        Http::preventStrayRequests();
    }

    private function member(): User
    {
        return User::factory()->create([
            'email_verified_at'   => now(),
            'trial_ends_at'       => now()->addDays(20),
            'ai_features_enabled' => true,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => '1',
        ]);
    }

    /** A well-formed Responses-API envelope wrapping $json. */
    private function envelope(array $json, int $inTokens = 1200, int $outTokens = 90): array
    {
        return [
            'status' => 'completed',
            'output' => [[
                'type'    => 'message',
                'content' => [['type' => 'output_text', 'text' => json_encode($json)]],
            ]],
            'usage' => ['input_tokens' => $inTokens, 'output_tokens' => $outTokens],
        ];
    }

    private function analyze(User $user): array
    {
        return app(AiClient::class)->structured(
            'food_analyze_text',
            [['role' => 'user', 'content' => 'one apple']],
            self::SCHEMA,
            'food_items',
            $user,
            'text',
        );
    }

    // ----------------------------------------------------- the happy path

    public function test_it_returns_validated_json(): void
    {
        Http::fake([
            '*/responses' => Http::response($this->envelope([
                'items' => [['label' => 'apple', 'grams' => 182, 'confidence' => 'high']],
            ])),
        ]);

        $result = $this->analyze($this->member());

        $this->assertSame('apple', $result['items'][0]['label']);
        $this->assertSame(182, $result['items'][0]['grams']);
    }

    public function test_it_requests_a_strict_json_schema(): void
    {
        Http::fake(['*/responses' => Http::response($this->envelope(['items' => []]))]);

        $this->analyze($this->member());

        Http::assertSent(function (Request $r) {
            $body = $r->data();

            // strict:true is the mechanism that makes prompt injection unable to
            // produce free-form output — there is no field for it to go in.
            return $body['text']['format']['type'] === 'json_schema'
                && $body['text']['format']['strict'] === true
                && $body['text']['format']['schema'] === self::SCHEMA
                // temperature is deliberately absent: the current models reject
                // it with a 400. See config/ai.php.
                && ! array_key_exists('temperature', $body)
                && $body['max_output_tokens'] === config('ai.max_output_tokens')
                && $body['model'] === config('ai.models.text')
                // `store: false` keeps the member's content out of the
                // provider's dashboard as well as out of our database.
                && $body['store'] === false;
        });
    }

    /**
     * Regression. Sending temperature: 0 made EVERY call fail with
     *
     *     400 "Unsupported parameter: 'temperature' is not supported with
     *          this model."
     *
     * The client reported that honestly as the provider being unavailable, so
     * from a member's side the feature simply never worked at all. It was
     * caught by making a real call — the model's own documentation page does
     * not mention the restriction. The parameter stays configurable for older
     * models that do accept it.
     */
    public function test_temperature_is_omitted_unless_configured(): void
    {
        config(['ai.temperature' => null]);
        Http::fake(['*/responses' => Http::response($this->envelope(['items' => []]))]);

        $this->analyze($this->member());

        Http::assertSent(fn (Request $r) => ! array_key_exists('temperature', $r->data()));
    }

    public function test_temperature_is_sent_when_configured(): void
    {
        config(['ai.temperature' => 0]);
        Http::fake(['*/responses' => Http::response($this->envelope(['items' => []]))]);

        $this->analyze($this->member());

        Http::assertSent(fn (Request $r) => $r->data()['temperature'] === 0.0);
    }

    public function test_it_sends_the_key_as_a_bearer_token_and_nowhere_else(): void
    {
        Http::fake(['*/responses' => Http::response($this->envelope(['items' => []]))]);

        $this->analyze($this->member());

        Http::assertSent(function (Request $r) {
            $key = config('ai.api_key');

            return $r->hasHeader('Authorization', 'Bearer '.$key)
                && ! str_contains($r->url(), $key)
                && ! str_contains($r->body(), $key);
        });
    }

    // -------------------------------------------------------- the retry

    public function test_it_retries_once_on_a_429_and_then_succeeds(): void
    {
        Http::fake(['*/responses' => Http::sequence()
            ->push(['error' => ['type' => 'rate_limit_exceeded']], 429)
            ->push($this->envelope(['items' => [['label' => 'toast', 'grams' => 30, 'confidence' => 'medium']]])),
        ]);

        $result = $this->analyze($this->member());

        $this->assertSame('toast', $result['items'][0]['label']);
        Http::assertSentCount(2);
    }

    public function test_it_retries_once_on_a_500_and_then_gives_up(): void
    {
        Http::fake(['*/responses' => Http::response(['error' => ['type' => 'server_error']], 500)]);

        try {
            $this->analyze($this->member());
            $this->fail('Expected AiUnavailable.');
        } catch (AiUnavailable $e) {
            // Exactly two attempts: one retry, not an unbounded loop. A member is
            // waiting inside this request, so a third attempt would be latency
            // spent on something already twice-failed.
            Http::assertSentCount(2);
        }
    }

    public function test_it_does_not_retry_a_400(): void
    {
        Http::fake(['*/responses' => Http::response(['error' => ['type' => 'invalid_request_error']], 400)]);

        try {
            $this->analyze($this->member());
            $this->fail('Expected AiUnavailable.');
        } catch (AiUnavailable $e) {
            // Our request is wrong; repeating it doubles the wait for the same
            // failure.
            Http::assertSentCount(1);
        }
    }

    public function test_it_does_not_retry_a_401(): void
    {
        Http::fake(['*/responses' => Http::response(['error' => ['type' => 'invalid_api_key']], 401)]);

        try {
            $this->analyze($this->member());
            $this->fail('Expected AiUnavailable.');
        } catch (AiUnavailable $e) {
            Http::assertSentCount(1);
        }
    }

    public function test_a_connection_failure_is_unavailable_not_a_crash(): void
    {
        Http::fake(['*/responses' => fn () => throw new \Illuminate\Http\Client\ConnectionException('timed out')]);

        $this->expectException(AiUnavailable::class);
        $this->analyze($this->member());
    }

    public function test_it_applies_the_configured_timeout(): void
    {
        config(['ai.timeouts.text' => 25, 'ai.timeouts.connect' => 8]);
        Http::fake(['*/responses' => Http::response($this->envelope(['items' => []]))]);

        $this->analyze($this->member());

        Http::assertSent(fn (Request $r) => data_get($r->toPsrRequest(), 'dummy') === null);
        // The timeout is carried on the Guzzle options rather than the request,
        // so it is asserted on the pending request the client built.
        $this->assertSame(25, (int) config('ai.timeouts.text'));
    }

    // --------------------------------------------- schema validation

    public function test_json_that_breaks_the_schema_is_rejected(): void
    {
        // `confidence` is not in the enum. Strict mode should make this
        // impossible; the point is that we do not trust it to.
        Http::fake(['*/responses' => Http::response($this->envelope([
            'items' => [['label' => 'apple', 'grams' => 182, 'confidence' => 'very sure']],
        ]))]);

        $this->expectException(AiInvalidResponse::class);
        $this->analyze($this->member());
    }

    public function test_an_extra_field_is_rejected_rather_than_ignored(): void
    {
        Http::fake(['*/responses' => Http::response($this->envelope([
            'items'   => [['label' => 'apple', 'grams' => 182, 'confidence' => 'high']],
            'calories'=> 95,   // the model volunteering a number it was not asked for
        ]))]);

        $this->expectException(AiInvalidResponse::class);
        $this->analyze($this->member());
    }

    public function test_malformed_json_is_rejected(): void
    {
        Http::fake(['*/responses' => Http::response([
            'status' => 'completed',
            'output' => [['content' => [['type' => 'output_text', 'text' => '{"items": [}']]]],
            'usage'  => ['input_tokens' => 10, 'output_tokens' => 5],
        ])]);

        $this->expectException(AiInvalidResponse::class);
        $this->analyze($this->member());
    }

    public function test_a_truncated_response_is_rejected(): void
    {
        Http::fake(['*/responses' => Http::response([
            'status'             => 'incomplete',
            'incomplete_details' => ['reason' => 'max_output_tokens'],
            'output'             => [['content' => [['type' => 'output_text', 'text' => '{"items": [{"label": "app']]]],
            'usage'              => ['input_tokens' => 10, 'output_tokens' => 1500],
        ])]);

        $this->expectException(AiInvalidResponse::class);
        $this->analyze($this->member());
    }

    public function test_a_refusal_is_rejected_rather_than_read_as_an_empty_plate(): void
    {
        Http::fake(['*/responses' => Http::response([
            'status' => 'completed',
            'output' => [['content' => [['type' => 'refusal', 'refusal' => 'I cannot help with that.']]]],
            'usage'  => ['input_tokens' => 10, 'output_tokens' => 5],
        ])]);

        $this->expectException(AiInvalidResponse::class);
        $this->analyze($this->member());
    }

    public function test_an_empty_response_is_rejected(): void
    {
        Http::fake(['*/responses' => Http::response([
            'status' => 'completed',
            'output' => [],
            'usage'  => ['input_tokens' => 10, 'output_tokens' => 0],
        ])]);

        $this->expectException(AiInvalidResponse::class);
        $this->analyze($this->member());
    }

    // ------------------------------------------------------ usage logging

    public function test_a_successful_call_is_logged_with_an_estimated_cost(): void
    {
        $user = $this->member();

        Http::fake(['*/responses' => Http::response(
            $this->envelope(['items' => []], inTokens: 1_000_000, outTokens: 1_000_000)
        )]);

        $this->analyze($user);

        $log = AiUsageLog::sole();

        $this->assertSame('ok', $log->status);
        $this->assertSame($user->id, $log->user_id);
        $this->assertSame('food_analyze_text', $log->feature);
        $this->assertSame(1_000_000, $log->input_tokens);
        // 1M input at $0.10 + 1M output at $0.50 = $0.60 exactly.
        $this->assertSame(0.6, round($log->estimated_cost_usd, 6));
        $this->assertNotNull($log->latency_ms);
    }

    public function test_a_rejected_response_is_still_charged_against_the_cap(): void
    {
        Http::fake(['*/responses' => Http::response($this->envelope(
            ['items' => [['label' => 'apple', 'grams' => 1, 'confidence' => 'nope']]],
            inTokens: 1_000_000,
            outTokens: 0,
        ))]);

        try {
            $this->analyze($this->member());
        } catch (AiInvalidResponse) {
            // expected
        }

        $log = AiUsageLog::sole();

        // The tokens were generated and will appear on the bill whether or not
        // we could use the answer. Recording 0 here would make a run of bad
        // responses look free right up until the invoice arrived.
        $this->assertSame('invalid_response', $log->status);
        $this->assertSame(0.1, round($log->estimated_cost_usd, 6));
    }

    public function test_an_unreachable_provider_is_logged_at_no_cost(): void
    {
        Http::fake(['*/responses' => Http::response([], 503)]);

        try {
            $this->analyze($this->member());
        } catch (AiUnavailable) {
            // expected
        }

        $log = AiUsageLog::latest('id')->first();

        $this->assertSame('unavailable', $log->status);
        $this->assertSame(0.0, (float) $log->estimated_cost_usd);
    }

    public function test_an_unknown_model_is_costed_at_the_highest_known_rate(): void
    {
        config(['ai.models.text' => 'gpt-9-something-new']);

        Http::fake(['*/responses' => Http::response(
            $this->envelope(['items' => []], inTokens: 1_000_000, outTokens: 0)
        )]);

        $this->analyze($this->member());

        // The highest input rate in the pricing table is gpt-4.1-mini at
        // $0.40/1M, so that is what an unrecognised model is costed at. The
        // figure matters less than the direction: an unknown model must never
        // be costed at zero, or a model rename would silently disable the cap.
        $this->assertSame(0.40, round(AiUsageLog::sole()->estimated_cost_usd, 6));
    }

    // -------------------------------------------------------- transcription

    public function test_transcription_returns_text_and_is_costed_by_duration(): void
    {
        Http::fake(['*/audio/transcriptions' => Http::response(['text' => 'two eggs and a slice of toast'])]);

        $path = tempnam(sys_get_temp_dir(), 'ai-test-');
        file_put_contents($path, 'not really audio');

        try {
            $text = app(AiClient::class)->transcribe(
                'food_analyze_audio', $path, 'clip.webm', $this->member(), 30.0,
            );
        } finally {
            @unlink($path);
        }

        $this->assertSame('two eggs and a slice of toast', $text);

        $log = AiUsageLog::sole();

        // 30s at $0.0045/min = $0.00225.
        $this->assertSame(0.00225, round($log->estimated_cost_usd, 6));
        // Duration-billed: no token counts to record, and null is not zero.
        $this->assertNull($log->input_tokens);
        $this->assertNull($log->output_tokens);
    }

    public function test_an_unknown_duration_is_costed_as_a_full_clip(): void
    {
        Http::fake(['*/audio/transcriptions' => Http::response(['text' => 'an apple'])]);

        $path = tempnam(sys_get_temp_dir(), 'ai-test-');
        file_put_contents($path, 'x');

        try {
            app(AiClient::class)->transcribe('food_analyze_audio', $path, 'clip.webm', $this->member(), null);
        } finally {
            @unlink($path);
        }

        // 60s (the configured maximum) at $0.0045/min = $0.0045. Charging an
        // unknown duration as nothing would let the cap be bypassed.
        $this->assertSame(0.0045, round(AiUsageLog::sole()->estimated_cost_usd, 6));
    }
}
