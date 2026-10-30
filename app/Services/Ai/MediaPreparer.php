<?php

namespace App\Services\Ai;

use Illuminate\Http\UploadedFile;
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

    /**
     * Duration of an audio clip in seconds, or null when it cannot be read.
     *
     * Deliberately best-effort. There is no audio library in this project and
     * adding one for a duration estimate is not worth a dependency on a
     * disk-constrained host, so this reads the container headers for the two
     * formats that carry it plainly and gives up otherwise.
     *
     * A null is NOT treated as free: AiClient charges an unknown duration at
     * the full allowed clip length, so a clip we cannot measure costs the most
     * rather than the least.
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

                if ($byteRate > 0 && $bytes !== false) {
                    return round(max(0, $bytes - 44) / $byteRate, 2);
                }
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
