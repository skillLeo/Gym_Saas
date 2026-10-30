<?php

namespace Tests\Feature\Ai;

use App\Models\User;
use App\Services\Ai\AiClient;
use App\Services\Ai\Exceptions\AiUnavailable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The API key must never appear in a response, a log line, or anything the
 * browser can read.
 *
 * This is the one Stage 1 requirement that cannot be satisfied by reading the
 * code, because a leak is usually something nobody wrote on purpose: an
 * exception message carrying the request, a debug dump of config, a provider
 * error echoed back verbatim. So the key used here is a distinctive sentinel
 * and the tests go looking for that exact string in the places it could
 * surface.
 */
class AiSecretsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Shaped like a real service-account key so that anything doing prefix
     * matching behaves as it would in production, but obviously fake.
     */
    private const SENTINEL = 'sk-svcacct-SENTINELnotarealkey00000000000000000000LEAKCANARY';

    private string $logPath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->logPath = storage_path('logs/ai-secrets-test.log');
        @unlink($this->logPath);

        config([
            'ai.api_key'          => self::SENTINEL,
            'ai.consent_version'  => '1',
            'ai.retry.backoff_ms' => 0,

            // A real file, so the assertion is against bytes on disk rather
            // than against a mocked logger that could be hiding the problem.
            'logging.default'              => 'ai_test',
            'logging.channels.ai_test'     => [
                'driver' => 'single',
                'path'   => $this->logPath,
                'level'  => 'debug',
            ],
        ]);

        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        @unlink($this->logPath);

        parent::tearDown();
    }

    private function member(bool $enabled = true): User
    {
        return User::factory()->create([
            'email_verified_at'   => now(),
            'trial_ends_at'       => now()->addDays(20),
            'ai_features_enabled' => $enabled,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => '1',
        ]);
    }

    private function logContents(): string
    {
        return is_file($this->logPath) ? (string) file_get_contents($this->logPath) : '';
    }

    private function assertNoLeak(string $haystack, string $where): void
    {
        $this->assertStringNotContainsString(self::SENTINEL, $haystack, "The API key leaked into {$where}.");

        // Also catch a partial print — a truncated key is still a leaked key,
        // and "sk-svcacct-SENTINEL…" is exactly what a naive masker produces.
        $this->assertStringNotContainsString(substr(self::SENTINEL, 0, 24), $haystack, "A truncated API key leaked into {$where}.");
    }

    // ------------------------------------------------- failures and logging

    public function test_a_provider_error_does_not_log_the_key(): void
    {
        // A hostile-shaped error: the provider echoing our own Authorization
        // header back inside its message. If anything logs the response body
        // verbatim, this is what leaks.
        Http::fake(['*/responses' => Http::response([
            'error' => [
                'type'    => 'invalid_request_error',
                'message' => 'Incorrect API key provided: '.self::SENTINEL,
            ],
        ], 401)]);

        try {
            app(AiClient::class)->structured(
                'food_analyze_text',
                [['role' => 'user', 'content' => 'an apple']],
                ['type' => 'object', 'properties' => ['ok' => ['type' => 'boolean']], 'required' => ['ok'], 'additionalProperties' => false],
                'probe',
                'text',
                $this->member(),
            );
            $this->fail('Expected AiUnavailable.');
        } catch (AiUnavailable $e) {
            // Not even the exception we raise internally may carry it.
            $this->assertNoLeak($e->getMessage(), 'the exception message');
            $this->assertNoLeak($e->clientMessage(), 'the member-facing message');
        }

        Log::shareContext([]); // flush
        $this->assertNoLeak($this->logContents(), 'the log file');

        // Prove the log was actually written to, so a passing assertion cannot
        // be the result of logging silently not happening at all.
        $this->assertStringContainsString('AI request failed', $this->logContents());
    }

    public function test_a_connection_exception_does_not_log_the_key(): void
    {
        // Guzzle puts the full request — headers included — into some exception
        // messages, which is the classic way a key reaches a log file.
        Http::fake([
            '*/responses' => fn () => throw new \Illuminate\Http\Client\ConnectionException(
                'cURL error 28: Operation timed out for https://api.openai.com/v1/responses with Authorization: Bearer '.self::SENTINEL
            ),
        ]);

        try {
            app(AiClient::class)->structured(
                'food_analyze_text',
                [['role' => 'user', 'content' => 'an apple']],
                ['type' => 'object', 'properties' => ['ok' => ['type' => 'boolean']], 'required' => ['ok'], 'additionalProperties' => false],
                'probe',
                'text',
                $this->member(),
            );
            $this->fail('Expected AiUnavailable.');
        } catch (AiUnavailable $e) {
            $this->assertNoLeak($e->getMessage(), 'the exception message');
        }

        $this->assertNoLeak($this->logContents(), 'the log file');
        $this->assertStringContainsString('could not be completed', $this->logContents());
    }

    public function test_a_schema_failure_does_not_log_the_key_or_the_members_food(): void
    {
        Http::fake(['*/responses' => Http::response([
            'status' => 'completed',
            'output' => [['content' => [['type' => 'output_text', 'text' => '{"ok": "yes"}']]]],
            'usage'  => ['input_tokens' => 10, 'output_tokens' => 5],
        ])]);

        try {
            app(AiClient::class)->structured(
                'food_analyze_text',
                [['role' => 'user', 'content' => 'a secret diary entry about my eating']],
                ['type' => 'object', 'properties' => ['ok' => ['type' => 'boolean']], 'required' => ['ok'], 'additionalProperties' => false],
                'probe',
                'text',
                $this->member(),
            );
        } catch (\App\Services\Ai\Exceptions\AiInvalidResponse) {
            // expected
        }

        $log = $this->logContents();

        $this->assertNoLeak($log, 'the log file');
        // The member's own words must not be in the log either.
        $this->assertStringNotContainsString('secret diary entry', $log);
    }

    // ----------------------------------------------------- HTTP responses

    public function test_the_member_status_endpoint_does_not_expose_the_key(): void
    {
        Sanctum::actingAs($this->member());

        $response = $this->getJson('/api/ai/status')->assertOk();

        $this->assertNoLeak($response->getContent(), 'the status response');
    }

    public function test_the_admin_usage_page_reports_only_whether_a_key_is_present(): void
    {
        $admin = User::factory()->create([
            'email_verified_at' => now(),
            'trial_ends_at'     => now()->addDays(20),
            'is_admin'          => true,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/ai-usage')
            ->assertOk()
            // A boolean is everything an admin needs to tell "not configured"
            // from "configured and failing", and it is the only safe answer.
            ->assertJsonPath('data.api_key_present', true);

        $this->assertNoLeak($response->getContent(), 'the admin usage response');
    }

    public function test_a_refused_ai_request_does_not_expose_the_key(): void
    {
        \Illuminate\Support\Facades\Route::middleware(['auth:sanctum', 'member', 'ai.access'])
            ->post('/__test/ai-probe', fn () => response()->json(['success' => true]));

        Sanctum::actingAs($this->member(enabled: false));

        $response = $this->postJson('/__test/ai-probe')->assertStatus(403);

        $this->assertNoLeak($response->getContent(), 'the 403 response');
    }

    // ---------------------------------------------------- the whole codebase

    public function test_no_php_source_file_contains_a_hardcoded_openai_key(): void
    {
        $roots = [app_path(), config_path(), database_path(), base_path('routes'), base_path('tests')];
        $offenders = [];

        foreach ($roots as $root) {
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));

            foreach ($files as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                $contents = (string) file_get_contents($file->getPathname());

                /*
                 * Real service-account and project keys. The test files here
                 * deliberately contain sk-svcacct-TESTONLY… and the sentinel
                 * above, so the pattern requires the long random tail a genuine
                 * key has and that those placeholders do not.
                 */
                if (preg_match('/sk-(?:svcacct|proj)-[A-Za-z0-9_\-]{80,}/', $contents)) {
                    $offenders[] = str_replace(base_path().DIRECTORY_SEPARATOR, '', $file->getPathname());
                }
            }
        }

        $this->assertSame([], $offenders, 'A key-shaped string is hardcoded in: '.implode(', ', $offenders));
    }

    public function test_the_key_is_read_from_config_and_never_from_env_directly(): void
    {
        /*
         * env() returns null once the config is cached, which is how a feature
         * that works locally dies on the server. Nothing outside config/ may
         * read OPENAI_API_KEY.
         */
        $offenders = [];

        foreach ([app_path(), base_path('routes')] as $root) {
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));

            foreach ($files as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                if (preg_match('/env\(\s*[\'"]OPENAI_API_KEY/', (string) file_get_contents($file->getPathname()))) {
                    $offenders[] = str_replace(base_path().DIRECTORY_SEPARATOR, '', $file->getPathname());
                }
            }
        }

        $this->assertSame([], $offenders, 'env() used for the API key in: '.implode(', ', $offenders));
    }
}
