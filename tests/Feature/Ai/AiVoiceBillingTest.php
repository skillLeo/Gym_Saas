<?php

namespace Tests\Feature\Ai;

use App\Models\AiUsageLog;
use App\Models\MealSlot;
use App\Models\User;
use App\Services\Ai\MediaPreparer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * How many seconds of audio get billed.
 *
 * Transcription is priced per minute, so this decides both what the client is
 * charged against the monthly cap and how quickly that cap is reached. The
 * rule is: measure if you can, trust the client only if the file size backs
 * the claim up, and when in doubt bill the maximum rather than the minimum.
 */
class AiVoiceBillingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ai.api_key'                   => 'sk-svcacct-TESTONLY0000000000000000',
            'ai.consent_version'           => '1',
            'ai.uploads.max_audio_seconds' => 60,
        ]);

        Http::preventStrayRequests();
    }

    private function member(): User
    {
        $user = User::factory()->create([
            'email_verified_at'   => now(),
            'trial_ends_at'       => now()->addDays(20),
            'ai_features_enabled' => true,
            'ai_consent_at'       => now(),
            'ai_consent_version'  => '1',
        ]);

        MealSlot::seedDefaultsFor($user->id);

        return $user;
    }

    /** A real WAV whose header genuinely says $seconds. */
    private function wav(float $seconds): UploadedFile
    {
        $rate = 16000;
        $n    = (int) ($rate * $seconds);
        $data = str_repeat(pack('v', 1000), max(1, $n));

        $header = 'RIFF' . pack('V', 36 + strlen($data)) . 'WAVEfmt ' . pack('V', 16)
            . pack('v', 1) . pack('v', 1) . pack('V', $rate) . pack('V', $rate * 2)
            . pack('v', 2) . pack('v', 16) . 'data' . pack('V', strlen($data));

        $path = tempnam(sys_get_temp_dir(), 'wav') . '.wav';
        file_put_contents($path, $header . $data);

        return new UploadedFile($path, 'clip.wav', 'audio/wav', null, true);
    }

    /**
     * A WAV whose header claims a byte rate the audio does not have.
     *
     * The data is sized for a real 16 kHz mono clip of $seconds; only the
     * declared rate is wrong, which is exactly the forgery that matters —
     * duration is derived from (bytes / byteRate).
     */
    private function wavWithByteRate(float $seconds, int $declaredByteRate): UploadedFile
    {
        $rate = 16000;
        $data = str_repeat(pack('v', 1000), max(1, (int) ($rate * $seconds)));

        $header = 'RIFF' . pack('V', 36 + strlen($data)) . 'WAVEfmt ' . pack('V', 16)
            . pack('v', 1) . pack('v', 1) . pack('V', $rate) . pack('V', $declaredByteRate)
            . pack('v', 2) . pack('v', 16) . 'data' . pack('V', strlen($data));

        $path = tempnam(sys_get_temp_dir(), 'wav') . '.wav';
        file_put_contents($path, $header . $data);

        return new UploadedFile($path, 'clip.wav', 'audio/wav', null, true);
    }

    /**
     * An opaque blob of exactly $bytes, for the unit-level checks where the
     * precise size is the thing under test.
     */
    private function webm(int $bytes): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'webm') . '.webm';
        file_put_contents($path, str_repeat('x', $bytes));

        return new UploadedFile($path, 'clip.webm', 'audio/webm', null, true);
    }

    /**
     * A clip that survives the endpoint's mimetypes rule.
     *
     * The raw helper above is a run of 'x' characters, which is the right
     * shape for testing size arithmetic but is correctly refused as audio by
     * the upload validation. Laravel's fake carries a declared type.
     */
    private function uploadableWebm(int $kilobytes): UploadedFile
    {
        return UploadedFile::fake()->create('clip.webm', $kilobytes, 'audio/webm');
    }

    private function preparer(): MediaPreparer
    {
        return app(MediaPreparer::class);
    }

    // --------------------------------------------------- the file wins

    public function test_a_readable_header_beats_whatever_the_client_claims(): void
    {
        $file = $this->wav(4.0);

        // The client says half a second. The file says four. The file wins —
        // this is measured, not claimed.
        $this->assertSame(4.0, round($this->preparer()->billableAudioSeconds($file, 0.5), 1));
    }

    public function test_a_file_measurably_longer_than_the_maximum_is_refused(): void
    {
        /*
         * This used to be clamped to 60 and sent anyway, so a ten-minute clip
         * was transcribed in full and written into the ledger as one minute.
         * The cap is documented as bounding the per-call COST; clamping bounds
         * only the estimate, which is worse than having no cap, because the
         * monthly budget is measured against that estimate.
         */
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/longer than 60 seconds/');

        $this->preparer()->billableAudioSeconds($this->wav(90), null);
    }

    public function test_a_clip_at_the_maximum_is_still_accepted(): void
    {
        // The limit is a limit, not a margin: exactly 60 seconds is fine.
        $this->assertSame(
            60.0,
            round($this->preparer()->billableAudioSeconds($this->wav(60), null), 1),
        );
    }

    public function test_an_over_long_recording_is_refused_by_the_endpoint_not_billed(): void
    {
        $user = $this->member();
        Sanctum::actingAs($user);

        $this->postJson('/api/ai/food-log/analyze', [], [])
            ->assertStatus(422); // sanity: the endpoint is reachable

        $response = $this->post('/api/ai/food-log/analyze', [
            'audio' => $this->wav(120),
        ], ['Accept' => 'application/json']);

        $this->assertSame(422, $response->status());
        $this->assertStringContainsString('longer than 60 seconds', (string) $response->json('error'));
        $this->assertSame('manual', $response->json('fallback'));

        // Nothing was sent to the provider, so nothing was billed.
        Http::assertNothingSent();
        $this->assertSame(0, AiUsageLog::count());
    }

    public function test_a_forged_byte_rate_cannot_make_a_long_clip_look_short(): void
    {
        /*
         * The byte rate lives in a file the client supplied, so it is a claim
         * like any other. Writing an enormous one made a long recording
         * measure as about a second — and a header reading is trusted above
         * everything else, so that figure went straight into the ledger the
         * monthly cap is measured against.
         *
         * Out of range now reads as "unknown", which is billed at the full
         * allowed clip length. The expensive answer is the right one for a
         * file that is lying about itself.
         */
        $file = $this->wavWithByteRate(20.0, 50_000_000);

        $this->assertNull(
            $this->preparer()->billableAudioSeconds($file, null),
            'a forged byte rate was believed',
        );
    }

    public function test_a_byte_rate_too_small_to_be_audio_is_also_discarded(): void
    {
        // The opposite forgery: a tiny rate makes a short clip measure as hours.
        $this->assertNull(
            $this->preparer()->billableAudioSeconds($this->wavWithByteRate(2.0, 1), null),
        );
    }

    // ------------------------------------------- a plausible client claim

    public function test_a_plausible_claim_is_used_when_the_file_cannot_be_read(): void
    {
        // 4 seconds of ~32 kbps opus is about 16 KB. Plausible, so believed.
        $this->assertSame(
            4.0,
            round($this->preparer()->billableAudioSeconds($this->webm(16000), 4.0), 1),
        );
    }

    public function test_a_claim_over_the_maximum_is_clamped(): void
    {
        $this->assertSame(
            60.0,
            round($this->preparer()->billableAudioSeconds($this->webm(400000), 300), 1),
        );
    }

    // --------------------------------------------- implausible claims

    public function test_a_claim_too_short_for_the_file_is_discarded(): void
    {
        // 2 MB claimed as a tenth of a second implies ~160 Mbps. That is not a
        // recording, it is an attempt to be billed for almost nothing — and
        // being billed less means more calls before the monthly cap bites.
        $this->assertNull($this->preparer()->billableAudioSeconds($this->webm(2_000_000), 0.1));
    }

    public function test_a_claim_too_long_for_the_file_is_discarded(): void
    {
        // 500 bytes claimed as 50 seconds implies 80 bits per second. Nothing
        // records at that rate. Over-charges rather than under, but a wrong
        // number is still wrong.
        $this->assertNull($this->preparer()->billableAudioSeconds($this->webm(500), 50));
    }

    public function test_a_missing_or_nonsense_claim_falls_back_to_unknown(): void
    {
        foreach ([null, 'abc', 0, -5] as $claim) {
            $this->assertNull(
                $this->preparer()->billableAudioSeconds($this->webm(16000), $claim),
                'claim: ' . var_export($claim, true),
            );
        }
    }

    // ------------------------------------------------- what it costs

    public function test_a_discarded_claim_is_billed_at_the_full_clip_length(): void
    {
        Http::fake(['*/audio/transcriptions' => Http::response(['text' => 'an apple'])]);
        Sanctum::actingAs($this->member());

        $this->post('/api/ai/food-log/analyze', [
            'audio'            => $this->uploadableWebm(2048),
            'duration_seconds' => 0.1,
        ], ['Accept' => 'application/json']);

        // The transcription row specifically: the food analysis that follows
        // writes its own row, so sole() would be ambiguous.
        $transcribe = AiUsageLog::where('model', config('ai.models.transcribe'))->sole();

        // 60s at $0.0045/min. Unknown is the expensive answer, deliberately.
        $this->assertSame(0.0045, round($transcribe->estimated_cost_usd, 6));
    }

    public function test_a_believed_claim_is_billed_for_what_was_actually_said(): void
    {
        Http::fake([
            '*/audio/transcriptions' => Http::response(['text' => 'an apple']),
            '*/responses'            => Http::response([
                'status' => 'completed',
                'output' => [['content' => [['type' => 'output_text', 'text' => json_encode([
                    'food_found' => true,
                    'items'      => [[
                        'label' => 'apple', 'search_name' => 'apple', 'preparation' => 'raw', 'quantity' => 1, 'unit' => 'piece',
                        'grams' => 182, 'confidence' => 'high',
                    ]],
                ])]]]],
                'usage' => ['input_tokens' => 100, 'output_tokens' => 40],
            ]),
            '*api.nal.usda.gov*' => Http::response(['foods' => []]),
        ]);

        Sanctum::actingAs($this->member());

        $this->post('/api/ai/food-log/analyze', [
            'audio'            => $this->uploadableWebm(16),
            'duration_seconds' => 4.0,
        ], ['Accept' => 'application/json'])->assertOk();

        $transcribe = AiUsageLog::where('model', config('ai.models.transcribe'))->sole();

        // 4s at $0.0045/min = $0.0003 — a fifteenth of the old flat charge.
        $this->assertSame(0.0003, round($transcribe->estimated_cost_usd, 6));
    }

    public function test_an_absurd_duration_is_refused_by_validation(): void
    {
        Http::fake();
        Sanctum::actingAs($this->member());

        $this->post('/api/ai/food-log/analyze', [
            'audio'            => $this->uploadableWebm(16),
            'duration_seconds' => 99999,
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('duration_seconds');

        Http::assertNothingSent();
    }

    public function test_audio_still_works_with_no_duration_at_all(): void
    {
        // Backwards compatible: a client that never sends the field behaves
        // exactly as it did before, billed at the maximum.
        Http::fake(['*/audio/transcriptions' => Http::response(['text' => ''])]);
        Sanctum::actingAs($this->member());

        $this->post('/api/ai/food-log/analyze', [
            'audio' => $this->uploadableWebm(16),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(0.0045, round(AiUsageLog::sole()->estimated_cost_usd, 6));
    }
}
