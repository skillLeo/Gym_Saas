<?php

namespace App\Services\Ai;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\ImageManager;
use RuntimeException;

/**
 * Turns an uploaded photo or voice clip into something safe to send upstream.
 *
 * NOTHING HERE EVER REACHES DISK. Laravel has already written the upload to
 * the PHP temp directory by the time a controller sees it — that is the
 * framework's doing and cannot be prevented — but this class reads it into
 * memory, and the controller deletes the temp file in a finally block. No
 * copy is made under storage/, no filename is logged, and nothing is queued.
 *
 * PHOTOS ARE RE-ENCODED, NOT FORWARDED
 * The bytes sent to the provider are produced by GD from decoded pixels, so
 * every EXIF block the camera wrote is gone: GPS coordinates, the device
 * serial, the original timestamp. A member photographing lunch at home should
 * not be handing their home's latitude to an AI vendor, and stripping EXIF by
 * deleting known tags leaves whatever tags you did not think of. Re-encoding
 * keeps only the pixels.
 *
 * Re-encoding also bounds cost: input image tokens scale with dimensions, so
 * capping the long edge caps the per-call price.
 */
class MediaPreparer
{
    /**
     * Re-encode an uploaded photo and return it as a data URL.
     *
     * @throws RuntimeException when the file is not a usable image.
     */
    public function imageToDataUrl(UploadedFile $file): string
    {
        $maxEdge = (int) config('ai.uploads.image_max_edge');

        try {
            // decode(), not read(): this version of Intervention has no read()
            // method. Same call the rest of the app already uses for avatars
            // and resource thumbnails.
            $image = (new ImageManager(new Driver()))->decode($file);
        } catch (\Throwable $e) {
            // A file can pass a mime check and still not decode — a renamed
            // document, a truncated upload, or an image format GD was not
            // built with. Treat it as bad input, not as a server fault.
            throw new RuntimeException('That file could not be read as an image.', 0, $e);
        }

        /*
         * scaleDown, not scale: it never enlarges. Upscaling a small photo
         * would add no detail for the model while multiplying the image tokens
         * we pay for.
         */
        $image->scaleDown($maxEdge, $maxEdge);

        $jpeg = (string) $image->encode(new JpegEncoder(quality: 80));

        return 'data:image/jpeg;base64,'.base64_encode($jpeg);
    }

    /**
     * Longest edge of an uploaded image, or null if it cannot be determined.
     * Used for reporting, never for a decision.
     *
     * @return array{0:int,1:int}|null
     */
    public function dimensions(UploadedFile $file): ?array
    {
        $size = @getimagesize($file->getRealPath());

        return $size === false ? null : [(int) $size[0], (int) $size[1]];
    }

    /*
     * Plausible bytes-per-second for a voice clip, used to sanity-check a
     * duration the client reports.
     *
     * The ceiling is the one that matters. Transcription is billed per minute,
     * so a client claiming a shorter clip than it really sent would be charged
     * less and could make more calls before the monthly cap stopped them. A
     * claim that implies more than ~512 kbps is not a recording, it is an
     * attempt to pay less — or a bug — and either way it is discarded.
     *
     * The floor catches the opposite mistake: a claim so long that the file
     * could not possibly contain it. That only over-charges us, but a wrong
     * number is a wrong number.
     */
    private const MAX_BYTES_PER_SECOND = 64000;   // ~512 kbps
    private const MIN_BYTES_PER_SECOND = 400;     // ~3 kbps

    /**
     * How many seconds of audio to bill for.
     *
     * Order of trust, most to least:
     *   1. The file's own header, where the format carries one. Nothing the
     *      client says can override it — this is measured, not claimed.
     *   2. The duration the client reports, if the file size makes it
     *      plausible. MediaRecorder produces webm, whose duration is not in a
     *      place this can cheaply read, so without this a real 4-second clip
     *      was billed as a full 60.
     *   3. Null, meaning "unknown". AiClient charges that at the full allowed
     *      clip length, so a clip nobody can measure costs the most rather
     *      than the least.
     *
     * Always clamped to the configured maximum, so a client cannot bill us for
     * more than the endpoint would have accepted.
     *
     * @throws RuntimeException when the file is measurably longer than the cap.
     */
    public function billableAudioSeconds(UploadedFile $file, mixed $clientSeconds = null): ?float
    {
        $max = (float) config('ai.uploads.max_audio_seconds');

        if (($fromHeader = $this->audioSeconds($file)) !== null) {
            /*
             * MEASURED LONGER THAN THE CAP MEANS REFUSE IT, NOT BILL LESS.
             *
             * This used to be min($fromHeader, $max): a 10-minute clip was
             * forwarded to the provider in full and recorded as 60 seconds.
             * The cap is described in config/ai.php as bounding the per-call
             * cost; clamping bounds only the ESTIMATE, which is worse than not
             * capping at all — the ledger under-reports real spend, and the
             * monthly cap is measured against the ledger.
             *
             * The browser stops recording at 55 seconds, so nothing over the
             * cap arrives from the app as built. Something over it is a
             * different client, or a bug in this one, and both deserve an
             * answer rather than a quiet overspend.
             */
            if ($fromHeader > $max) {
                throw new RuntimeException(
                    'That recording is longer than '.(int) $max.' seconds. Record a shorter one, or type what you ate.'
                );
            }

            return $fromHeader;
        }

        if (! is_numeric($clientSeconds)) {
            return null;
        }

        $claimed = (float) $clientSeconds;

        if ($claimed <= 0) {
            return null;
        }

        $bytes = (int) $file->getSize();

        if ($bytes > 0) {
            $impliedBytesPerSecond = $bytes / $claimed;

            if ($impliedBytesPerSecond > self::MAX_BYTES_PER_SECOND
                || $impliedBytesPerSecond < self::MIN_BYTES_PER_SECOND) {
                // Not plausible for this file. Fall back to "unknown", which
                // bills at the maximum — the safe direction to be wrong in.
                Log::warning('Implausible client audio duration discarded', [
                    'implied_bytes_per_second' => (int) $impliedBytesPerSecond,
                ]);

                return null;
            }
        }

        return min($claimed, $max);
    }

    /**
     * Duration read from the file itself, or null when the format does not
     * make it cheap to find.
     *
     * Deliberately best-effort. There is no audio library in this project and
     * adding one for a duration estimate is not worth a dependency on a
     * disk-constrained host, so this reads the container header for the one
     * format that carries it plainly and gives up otherwise.
     */
    public function audioSeconds(UploadedFile $file): ?float
    {
        $path = $file->getRealPath();

        if (! is_readable($path)) {
            return null;
        }

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return null;
        }

        try {
            $head = fread($handle, 4096);
            if ($head === false || $head === '') {
                return null;
            }

            // WAV: byte rate and data size are in fixed header positions.
            if (str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WAVE') {
                $byteRate = unpack('V', substr($head, 28, 4))[1] ?? 0;
                $bytes    = filesize($path);

                /*
                 * The byte rate is a number in a file the client supplied, so
                 * it is a claim like any other and gets the same plausibility
                 * test. Writing a huge one into the header made a long clip
                 * measure as about a second, and because a header reading is
                 * trusted above everything else, that figure went straight
                 * into the ledger the monthly cap is measured against.
                 *
                 * Out of range, and this returns null — "unknown" — which is
                 * billed at the full allowed clip length. The expensive answer
                 * is the right one for a file that is lying about itself.
                 */
                if ($byteRate >= self::MIN_BYTES_PER_SECOND
                    && $byteRate <= self::MAX_BYTES_PER_SECOND
                    && $bytes !== false) {
                    return round(max(0, $bytes - 44) / $byteRate, 2);
                }

                return null;
            }
        } finally {
            fclose($handle);
        }

        return null;
    }

    /**
     * Delete a temporary upload now, rather than waiting for PHP to do it at
     * the end of the request.
     *
     * Called from a finally block, so it runs whether the analysis succeeded,
     * failed, or threw. Failures are swallowed: a member whose photo was
     * analysed correctly should not get an error because a temp file was
     * already gone.
     */
    public function discard(?UploadedFile $file): void
    {
        if ($file === null) {
            return;
        }

        $path = $file->getRealPath();

        if (is_string($path) && $path !== '' && is_file($path)) {
            @unlink($path);
        }
    }
}
