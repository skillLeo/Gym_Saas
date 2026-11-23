<?php

namespace App\Services\Ai;

use App\Models\AiUsageLog;
use App\Models\User;
use App\Services\Ai\Exceptions\AiInvalidResponse;
use App\Services\Ai\Exceptions\AiLimitReached;
use App\Services\Ai\Exceptions\AiUnavailable;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The only class in this application that talks to OpenAI.
 *
 * Nothing else may call the provider directly. Everything an AI feature needs
 * — the timeout, the single retry, schema validation, usage logging, the spend
 * cap — is enforced here, so a new feature gets all of it by construction
 * instead of by remembering. If a second class ever starts making HTTP calls
 * to the provider, the cap and the usage log stop being true.
 *
 * WHAT IS NEVER LOGGED
 * The API key, the prompt, the image, the audio, the transcript, and the
 * model's answer. Failures log the provider's status code and our own request
 * shape, never content. This is checked by a test (AiSecretsTest).
 *
 * WHY THESE CALLS ARE SYNCHRONOUS
 * The host cannot fork (no proc_open), so there is no queue worker to hand
 * work to; `queue.connection` is effectively sync. An AI call therefore
 * happens inside the member's own request, which is why the timeouts are short
 * and why max_output_tokens is capped.
 */
class AiClient
{
    /**
     * How long the browser will wait before it stops caring.
     *
     * `frontend/src/lib/aiFoodLog.ts` sets a 60-second axios timeout on the
     * analyse call. Work that runs past it is work nobody is waiting for: the
     * member has an error on screen and a manual-logging button, while a PHP
     * worker on a host with few of them is still held open.
     *
     * 55, not 60, to leave the response room to get back through the app. It
     * is what separates the two cases: text is 25 s, so two attempts and the
     * backoff come to 51.2 and fit; vision and transcription are 45 s, so two
     * come to 91.2 and do not.
     */
    private const CLIENT_PATIENCE_SECONDS = 55;

    public function __construct(
        private readonly AiGate $gate,
        private readonly JsonSchemaValidator $validator,
    ) {
    }

    /**
     * Ask the model for JSON matching $schema, and return it decoded.
     *
     * @param  string                     $feature  Recorded in ai_usage_logs.
     * @param  array                      $input    Responses-API `input` array.
     * @param  array                      $schema   JSON Schema (strict subset).
     * @param  'vision'|'text'            $kind     Which configured model to use.
     *
     * @throws AiLimitReached     A limit of ours; nothing was sent.
     * @throws AiUnavailable      No usable answer from the provider.
     * @throws AiInvalidResponse  An answer we will not use.
     */
    public function structured(
        string $feature,
        array $input,
        array $schema,
        string $schemaName,
        /*
         * REQUIRED, AND BEFORE $kind FOR THAT REASON.
         *
         * It was `?User $user = null` in last place, and the whole of
         * assertCallAllowed() sat inside `if ($user !== null)`. Every caller
         * does pass one, so nothing was wrong today — but the easy mistake
         * (add a caller, forget the last argument) silently switched off the
         * kill switch, the consent check, the daily limit and the spend cap at
         * once, and spent the client's money doing it. A parameter whose
         * absence disables every safety check should not be optional, so it is
         * not, and PHP will not allow a required parameter after an optional
         * one — hence the position.
         */
        User $user,
        string $kind = 'text',
    ): array {
        $this->assertCallAllowed($user, $feature);

        $model = (string) config("ai.models.{$kind}");

        $payload = [
            'model' => $model,
            'input' => $input,
            /*
             * Structured Outputs on the Responses API. `strict: true` is what
             * makes the model unable to answer with anything but this shape —
             * it is the mechanism that stops a prompt-injected "ignore your
             * instructions" from producing free-form text, because there is no
             * field in the schema for it to go in.
             */
            'text' => [
                'format' => [
                    'type'   => 'json_schema',
                    'name'   => $schemaName,
                    'strict' => true,
                    'schema' => $schema,
                ],
            ],
            'max_output_tokens' => (int) config('ai.max_output_tokens'),
            /*
             * Not sent to the provider, so the member's photo and words do not
             * accumulate in someone else's dashboard on top of being kept out
             * of our own database.
             */
            'store' => false,
        ];

        /*
         * Only sent when configured. The current models reject the parameter
         * outright with a 400 — see the note in config/ai.php. Omitting it is
         * the working default; it exists for older models that accept it.
         */
        if (config('ai.temperature') !== null) {
            $payload['temperature'] = (float) config('ai.temperature');
        }

        $started = microtime(true);

        [$response, $error] = $this->send(
            'POST',
            '/responses',
            $payload,
            (int) config("ai.timeouts.{$kind}"),
        );

        $latency = (int) round((microtime(true) - $started) * 1000);

        if ($error !== null) {
            $this->log($user, $feature, $model, null, null, 0.0, 'unavailable', $latency);

            throw new AiUnavailable($error);
        }

        $body   = $response->json() ?? [];
        $tokens = $this->tokensFrom($body);
        $cost   = $this->tokenCost($model, $tokens['input'], $tokens['output']);

        /*
         * The cost is recorded BEFORE the answer is validated, and the status
         * reflects what happened. A response we end up rejecting was still
         * generated and still billed, so it must count against the cap —
         * otherwise a run of unusable answers is free as far as our own
         * accounting is concerned, and the real bill arrives anyway.
         */
        try {
            $decoded = $this->decodeStructured($body, $schema);
        } catch (AiInvalidResponse $e) {
            $this->log($user, $feature, $model, $tokens['input'], $tokens['output'], $cost, 'invalid_response', $latency);

            throw $e;
        }

        $this->log($user, $feature, $model, $tokens['input'], $tokens['output'], $cost, 'ok', $latency);

        return $decoded;
    }

    /**
     * Transcribe speech to text.
     *
     * @param  string      $path     Absolute path to a temporary audio file.
     * @param  float|null  $seconds  Duration, for the cost estimate. Null if unknown.
     *
     * @throws AiLimitReached|AiUnavailable
     */
    public function transcribe(
        string $feature,
        string $path,
        string $filename,
        /* Required, and before $seconds — see structured(). */
        User $user,
        ?float $seconds = null,
    ): string {
        $this->assertCallAllowed($user, $feature);

        $model   = (string) config('ai.models.transcribe');
        $started = microtime(true);

        [$response, $error] = $this->send(
            'POST',
            '/audio/transcriptions',
            [
                'model' => $model,
                /*
                 * Steering, not instructions. The provider treats `prompt` as a
                 * hint about vocabulary, which is exactly what is wanted here:
                 * food words are the ones most likely to be misheard.
                 */
                'prompt' => 'A short spoken note describing food and drink that was eaten, with quantities.',
            ],
            (int) config('ai.timeouts.transcribe'),
            attachment: ['path' => $path, 'name' => $filename],
        );

        $latency = (int) round((microtime(true) - $started) * 1000);

        if ($error !== null) {
            $this->log($user, $feature, $model, null, null, 0.0, 'unavailable', $latency);

            throw new AiUnavailable($error);
        }

        /*
         * Transcription is billed per minute, not per token, so there are no
         * token counts to record — see the migration on why those columns stay
         * null rather than being filled with zeros.
         */
        $cost = $this->minuteCost($model, $seconds);
        $body = $response->json() ?? [];
        $text = is_string($body['text'] ?? null) ? trim($body['text']) : '';

        if ($text === '') {
            // A successful call that produced no words: silence, or audio the
            // model could not make anything of. Billed, so it is logged as ok;
            // the caller decides what to tell the member.
            $this->log($user, $feature, $model, null, null, $cost, 'ok', $latency);

            return '';
        }

        $this->log($user, $feature, $model, null, null, $cost, 'ok', $latency);

        return $text;
    }

    // ------------------------------------------------------------- internals

    /**
     * @throws AiLimitReached
     */
    private function assertCallAllowed(User $user, string $feature): void
    {
        /*
         * Re-checked here even though the middleware has already run, so that
         * a controller which forgets the middleware cannot spend money. See
         * AiGate's class docblock.
         *
         * No null branch any more: $user is required by both public methods,
         * so there is no longer a way to arrive here with nothing to check.
         */
        if (($problem = $this->gate->accessProblem($user)) !== null) {
            // Not a limit — a permission fault that should have been caught
            // at the route. Logged as blocked so it is visible on the admin
            // screen, then reported as unavailable rather than leaking which
            // internal check failed.
            $this->log($user, $feature, 'n/a', null, null, 0.0, 'blocked', null);

            throw new AiUnavailable('AI call blocked by gate: '.$problem['code']);
        }

        $this->gate->assertWithinLimits($user);
    }

    /**
     * One HTTP attempt, plus one retry on 429, 5xx, or never reaching the
     * provider at all. A read timeout is retried only if a second attempt
     * still fits inside what the browser will wait for — see the catch block.
     *
     * Returns `[Response, null]` on success or `[null, string]` on failure, in
     * preference to throwing, so that the caller can log the usage row with an
     * accurate latency before raising anything. The failure string is for our
     * log only; the provider's own message is never shown to a member, because
     * it can quote our request back at us.
     *
     * @return array{0: Response|null, 1: string|null}
     */
    private function send(
        string $method,
        string $path,
        array $payload,
        int $timeout,
        ?array $attachment = null,
    ): array {
        $attempts  = max(1, (int) config('ai.retry.attempts'));
        $lastError = 'AI request failed.';
        $startedAt = microtime(true);

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            try {
                $request = Http::withToken((string) config('ai.api_key'))
                    ->timeout($timeout)
                    ->connectTimeout((int) config('ai.timeouts.connect'))
                    ->acceptJson();

                if ($attachment !== null) {
                    $request = $request->attach(
                        'file',
                        fopen($attachment['path'], 'r'),
                        $attachment['name'],
                    );
                    $response = $request->asMultipart()->post($this->url($path), $this->multipartFields($payload));
                } else {
                    $response = $request->send($method, $this->url($path), ['json' => $payload]);
                }

                if ($response->successful()) {
                    return [$response, null];
                }

                $status = $response->status();

                /*
                 * Retry only what retrying can fix. A 429 or a 5xx may well
                 * succeed a second later; a 400 means our request is wrong and
                 * a 401 means the key is wrong, and repeating either just
                 * doubles the latency before the same failure.
                 */
                $retryable = $status === 429 || $status >= 500;

                // Status code and error *type* only. The provider's message
                // body can contain fragments of what we sent it.
                Log::warning('AI request failed', [
                    'path'      => $path,
                    'status'    => $status,
                    'type'      => data_get($response->json(), 'error.type'),
                    'attempt'   => $attempt,
                    'retryable' => $retryable,
                ]);

                $lastError = "Provider returned HTTP {$status}.";

                if (! $retryable) {
                    return [null, $lastError];
                }
            } catch (\Throwable $e) {
                /*
                 * DNS, TLS, connection reset — or a read timeout, which is a
                 * different thing wearing the same exception.
                 *
                 * NEVER REACHING THE PROVIDER is cheap to retry: no request is
                 * in flight, nothing has been billed, and a second attempt a
                 * moment later genuinely does get through a blip.
                 *
                 * A READ TIMEOUT is not that. The provider took our request
                 * and is working on it; asking again does not make the first
                 * one stop, so it costs a second call and doubles the wait for
                 * an answer that was already late — and the member is watching
                 * a browser that gives up at 60 seconds.
                 *
                 * So a timeout is retried only when a second attempt still
                 * fits inside that. For text (25 s) it does: 25 + 1.2 + 25 is
                 * 51 seconds, and the measured spread is a median of 5.5 s
                 * against a 25 s ceiling, so a timeout there really is a bad
                 * moment rather than a slow model. For vision (45 s) it does
                 * not: 45 + 1.2 + 45 is 91 seconds of a PHP worker, on a host
                 * with few of them, for a member who left thirty seconds ago.
                 *
                 * Refusing both — which this did first — threw away the one
                 * that was worth having.
                 */
                $timedOut = $this->isTimeout($e);
                $elapsed  = microtime(true) - $startedAt;

                /*
                 * Judged on the CONFIGURED timeout, not on how long this
                 * attempt actually took. For a timeout those are the same
                 * number by definition, and using the measured one makes the
                 * rule untestable — a fake that fails instantly then "fits"
                 * and retries, which is the opposite of what happens in
                 * production.
                 */
                $wouldFit = ($timeout * 2) + ((int) config('ai.retry.backoff_ms') / 1000)
                    <= self::CLIENT_PATIENCE_SECONDS;

                Log::warning('AI request could not be completed', [
                    'path'       => $path,
                    'exception'  => $e::class,
                    'attempt'    => $attempt,
                    'timed_out'  => $timedOut,
                    'elapsed_ms' => (int) round($elapsed * 1000),
                    'retrying'   => ! $timedOut || $wouldFit,
                ]);

                $lastError = 'Could not reach the AI provider.';

                if ($timedOut && ! $wouldFit) {
                    return [null, $lastError];
                }
            }

            if ($attempt < $attempts) {
                usleep(max(0, (int) config('ai.retry.backoff_ms')) * 1000);
            }
        }

        return [null, $lastError];
    }

    /**
     * Did this failure happen because the provider ran out of time, rather
     * than because we never reached it?
     *
     * Both arrive as the same ConnectionException, so the message is the only
     * thing that separates them. Matched on the words cURL and Guzzle use
     * rather than on a cURL error number, because the number is not carried
     * through Laravel's wrapper.
     *
     * Wrong in the safe direction: a transport failure this fails to
     * recognise as a timeout is merely retried once, which is what used to
     * happen to all of them.
     */
    private function isTimeout(\Throwable $e): bool
    {
        $message = mb_strtolower($e->getMessage());

        foreach (['timed out', 'timeout', 'operation too slow'] as $needle) {
            if (str_contains($message, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function url(string $path): string
    {
        return rtrim((string) config('ai.base_url'), '/').$path;
    }

    /** Multipart fields must be scalars; nested payloads are not used here. */
    private function multipartFields(array $payload): array
    {
        return array_map(static fn ($v) => is_scalar($v) ? (string) $v : json_encode($v), $payload);
    }

    /**
     * Pull the model's JSON out of a Responses-API envelope and validate it.
     *
     * @throws AiInvalidResponse
     */
    private function decodeStructured(array $body, array $schema): array
    {
        /*
         * `incomplete` means it ran into max_output_tokens mid-answer. The JSON
         * is then truncated, and truncated JSON about food is the one thing
         * this feature must never half-accept.
         */
        if (($body['status'] ?? null) === 'incomplete') {
            throw new AiInvalidResponse(
                'Response incomplete: '.(string) data_get($body, 'incomplete_details.reason', 'unknown'),
            );
        }

        $text = null;

        foreach (($body['output'] ?? []) as $item) {
            foreach (($item['content'] ?? []) as $part) {
                /*
                 * A refusal is a deliberate "no" from the model, not a
                 * malfunction, but there is no food list in it — so it cannot
                 * be used and must not be silently turned into an empty plate.
                 */
                if (($part['type'] ?? null) === 'refusal') {
                    throw new AiInvalidResponse('Model refused the request.');
                }

                if (($part['type'] ?? null) === 'output_text' && isset($part['text'])) {
                    $text = ($text ?? '').$part['text'];
                }
            }
        }

        if ($text === null || trim($text) === '') {
            throw new AiInvalidResponse('Response contained no output text.');
        }

        $decoded = json_decode($text, true);

        if (! is_array($decoded)) {
            throw new AiInvalidResponse('Response was not valid JSON: '.json_last_error_msg());
        }

        $errors = $this->validator->validate($decoded, $schema);

        if ($errors !== []) {
            // The schema path is safe to log — it describes our own schema, not
            // the member's content.
            Log::warning('AI response failed schema validation', ['errors' => array_slice($errors, 0, 5)]);

            throw new AiInvalidResponse('Response did not match the schema.');
        }

        return $decoded;
    }

    /** @return array{input:int|null,output:int|null} */
    private function tokensFrom(array $body): array
    {
        $usage = $body['usage'] ?? [];

        return [
            'input'  => isset($usage['input_tokens']) ? (int) $usage['input_tokens'] : null,
            'output' => isset($usage['output_tokens']) ? (int) $usage['output_tokens'] : null,
        ];
    }

    /**
     * Estimated dollars for a token-billed call.
     *
     * An unknown model falls back to the most expensive entry in the table
     * rather than to zero. A zero would make an unrecognised model — which is
     * exactly what a model rename produces — appear free, and the spend cap
     * would never trigger however many calls were made.
     */
    private function tokenCost(string $model, ?int $input, ?int $output): float
    {
        $table = (array) config('ai.pricing.tokens');
        $rates = $table[$model] ?? null;

        if ($rates === null) {
            $rates = [
                'input'  => max(array_column($table, 'input') ?: [1.0]),
                'output' => max(array_column($table, 'output') ?: [5.0]),
            ];

            Log::warning('No pricing entry for AI model; estimating at the highest known rate', [
                'model' => $model,
            ]);
        }

        return round(
            (($input ?? 0) / 1_000_000) * $rates['input']
            + (($output ?? 0) / 1_000_000) * $rates['output'],
            6,
        );
    }

    /** Estimated dollars for a duration-billed call. */
    private function minuteCost(string $model, ?float $seconds): float
    {
        $table = (array) config('ai.pricing.per_minute');
        $rate  = $table[$model] ?? (max($table ?: [0.01]));

        // An unknown duration is charged as the full allowed clip rather than
        // as nothing, for the same reason as the token fallback above.
        $seconds ??= (float) config('ai.uploads.max_audio_seconds');

        return round(($seconds / 60) * $rate, 6);
    }

    private function log(
        ?User $user,
        string $feature,
        string $model,
        ?int $input,
        ?int $output,
        float $cost,
        string $status,
        ?int $latencyMs,
    ): void {
        try {
            AiUsageLog::create([
                'user_id'            => $user?->id,
                'feature'            => $feature,
                'model'              => $model,
                'input_tokens'       => $input,
                'output_tokens'      => $output,
                'estimated_cost_usd' => $cost,
                'status'             => $status,
                'latency_ms'         => $latencyMs,
            ]);
        } catch (\Throwable $e) {
            /*
             * Never let bookkeeping break the member's request. A failed insert
             * does mean this call escapes the cap, so it is logged loudly —
             * silently losing usage rows would make the cap drift from reality
             * with nothing to show why.
             */
            Log::error('Could not write AI usage log', ['exception' => $e::class]);
        }
    }
}
