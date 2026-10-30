<?php

/*
|--------------------------------------------------------------------------
| AI features
|--------------------------------------------------------------------------
|
| Everything the AI features need, in one place. Nothing here is read by the
| frontend: the key is server-side only and no endpoint ever returns it.
|
| MODEL NAMES ARE NEVER HARDCODED IN CODE. They are read from here so that a
| model rename or a price change is an .env edit, not a deploy of new PHP.
| OpenAI retires model snapshots on a published schedule, and the previous
| generation of transcription models (gpt-4o-mini-transcribe and
| gpt-4o-transcribe) is already marked deprecated in their docs — so the
| application must assume these strings will change.
|
*/

return [

    'provider' => env('AI_PROVIDER', 'openai'),

    /*
     * Server-side only. Never logged, never returned in a response, never
     * passed to the browser. Read it through config('ai.api_key').
     */
    'api_key' => env('OPENAI_API_KEY'),

    'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),

    /*
     * Model choices, and why. Checked against OpenAI's live docs on
     * 30 Oct 2026 rather than taken from memory.
     *
     * vision / text — gpt-6-luna
     *   $0.10 per 1M input, $0.50 per 1M output: the cheapest model OpenAI
     *   publishes that supports BOTH of the things this feature cannot work
     *   without. Its documented feature list is:
     *       streaming, structured_outputs, function_calling, file_search,
     *       image_input, web_search, prompt_caching
     *   `image_input` is what lets it read a photo of a plate, and
     *   `structured_outputs` is what lets us demand a strict JSON schema so
     *   the model physically cannot answer with prose. gpt-5-nano is cheaper
     *   at $0.05/$0.40 but is a text model, so it cannot do Snap at all.
     *
     *   The same model is used for typed input. It could be swapped for a
     *   nano model via AI_TEXT_MODEL to shave a fraction of a cent, but food
     *   parsing quality is worth more than that here and one model means one
     *   set of behaviour to reason about.
     *
     * transcribe — gpt-transcribe
     *   $0.0045 per minute, and the model OpenAI's speech-to-text guide
     *   currently names as recommended. NOT gpt-4o-mini-transcribe: that is
     *   $0.003/min and looks like the cheaper option, but its model page
     *   reports status "Deprecated", along with both of its snapshots. Saving
     *   $0.0015 a minute is not worth building on something being switched off.
     */
    'models' => [
        'vision'     => env('AI_VISION_MODEL', 'gpt-6-luna'),
        'text'       => env('AI_TEXT_MODEL', 'gpt-6-luna'),
        'transcribe' => env('AI_TRANSCRIBE_MODEL', 'gpt-transcribe'),
    ],

    /*
     * Timeouts.
     *
     * These are deliberately short. The host runs the queue in-process with no
     * proc_open, so an AI call happens inside the member's own HTTP request —
     * there is no worker to hand it to. A slow call is therefore a member
     * staring at a spinner, and PHP's own max_execution_time is the hard
     * ceiling behind all of this.
     */
    'timeouts' => [
        'connect'    => (int) env('AI_CONNECT_TIMEOUT', 8),
        'vision'     => (int) env('AI_VISION_TIMEOUT', 45),
        'text'       => (int) env('AI_TEXT_TIMEOUT', 25),
        'transcribe' => (int) env('AI_TRANSCRIBE_TIMEOUT', 45),
    ],

    /* One retry only, on 429 and 5xx. Milliseconds to wait before it. */
    'retry' => [
        'attempts'    => 2,
        'backoff_ms'  => (int) env('AI_RETRY_BACKOFF_MS', 1200),
    ],

    /*
     * Hard ceiling on output tokens per call.
     *
     * This is a cost control, not a quality setting. Output is five times the
     * price of input on these models, and the only thing we ask for is a short
     * JSON list of foods — a few hundred tokens. Without a ceiling, one
     * malformed exchange that sends the model into a loop is billed in full.
     */
    'max_output_tokens' => (int) env('AI_MAX_OUTPUT_TOKENS', 1500),

    /*
     * Sampling temperature, or null to omit the parameter entirely.
     *
     * NULL BY DEFAULT, AND THAT IS NOT LAZINESS. The current models reject it:
     *
     *     400 invalid_request_error
     *     "Unsupported parameter: 'temperature' is not supported with this model."
     *
     * Found by making a real call, not by reading the docs — which do not say
     * so on the model page. Sending temperature: 0 made every single request
     * fail with a 400, which the client correctly reported as the provider
     * being unavailable; the feature would have been dead on arrival.
     *
     * Set AI_TEMPERATURE=0 only if AI_TEXT_MODEL is pointed at an older model
     * that accepts it (gpt-4o-mini, gpt-4.1-mini). Determinism is desirable
     * here — identifying a plate has a right answer — but not at the price of
     * every call failing.
     */
    'temperature' => env('AI_TEMPERATURE') === null ? null : (float) env('AI_TEMPERATURE'),

    'uploads' => [
        /*
         * 5 MB, matching the brief. Images are re-encoded and stripped of EXIF
         * server-side before they go anywhere, so this is a limit on what we
         * accept from the network, not on what we forward.
         */
        'max_image_bytes' => (int) env('AI_MAX_IMAGE_BYTES', 5 * 1024 * 1024),
        'image_mimes'     => ['image/jpeg', 'image/png', 'image/webp'],

        /*
         * 60 seconds of speech. OpenAI's own limit is 25 MB per file, which is
         * far more audio than anyone will speak into a food journal; the
         * duration cap is ours, to bound the per-call cost.
         */
        'max_audio_bytes'   => (int) env('AI_MAX_AUDIO_BYTES', 10 * 1024 * 1024),
        'max_audio_seconds' => (int) env('AI_MAX_AUDIO_SECONDS', 60),
        'audio_mimes'       => [
            'audio/webm', 'video/webm',          // MediaRecorder's default output
            'audio/mp4', 'audio/x-m4a', 'audio/m4a',
            'audio/mpeg', 'audio/mp3',
            'audio/wav', 'audio/x-wav', 'audio/wave',
        ],

        /* Longest edge the server will forward, after its own re-encode. */
        'image_max_edge' => (int) env('AI_IMAGE_MAX_EDGE', 1280),
    ],

    /*
     * Pricing, in US dollars, used only to ESTIMATE spend. It is not billing
     * data: OpenAI's invoice is the truth. The point of estimating is to stop
     * spending before a surprise, so the numbers are kept slightly pessimistic
     * and an unknown model falls back to the most expensive entry rather than
     * to zero — a zero would make an unrecognised model look free and sail
     * straight through the cap.
     */
    'pricing' => [
        /* Per 1,000,000 tokens. */
        'tokens' => [
            'gpt-6-luna'      => ['input' => 0.10, 'output' => 0.50],
            'gpt-5.6-luna'    => ['input' => 0.20, 'output' => 1.20],
            'gpt-5-nano'      => ['input' => 0.05, 'output' => 0.40],
            'gpt-5-mini'      => ['input' => 0.25, 'output' => 2.00],
            'gpt-4.1-nano'    => ['input' => 0.10, 'output' => 0.40],
            'gpt-4.1-mini'    => ['input' => 0.40, 'output' => 1.60],
            'gpt-4o-mini'     => ['input' => 0.15, 'output' => 0.60],
        ],

        /* Per minute of audio, for models billed by duration. */
        'per_minute' => [
            'gpt-transcribe'          => 0.0045,
            'gpt-4o-transcribe'       => 0.006,
            'gpt-4o-mini-transcribe'  => 0.003,
            'whisper-1'               => 0.006,
        ],
    ],

    /*
     * Defaults for the limits. Every one of these is overridable from the
     * admin panel at runtime (system_settings, group "ai"); these values are
     * only what applies before an admin has ever touched the screen.
     */
    'defaults' => [
        'ai_enabled'               => true,
        'ai_beta_mode'             => true,   // only per-user-flagged members
        'ai_monthly_cap_usd'       => 8.00,
        'ai_daily_limit_per_user'  => 20,
        'ai_per_minute_per_user'   => 4,
    ],

    /*
     * Bump this when the wording of the consent notice changes materially.
     * Consent is stored with the version that was shown, so an existing member
     * is asked again rather than being treated as having agreed to text they
     * never saw.
     */
    'consent_version' => env('AI_CONSENT_VERSION', '1'),
];
