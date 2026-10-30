<?php

namespace App\Services\Ai\Exceptions;

/**
 * The provider answered, but not with something we are willing to use: invalid
 * JSON, or JSON that failed the schema.
 *
 * Treated as a hard failure rather than something to patch up. A half-understood
 * food list is worse than no food list, because the member would be reviewing
 * numbers that came from nowhere. Strict mode on the provider side should make
 * this impossible; this exists because "should be impossible" is not a
 * guarantee, and because the base URL is configurable.
 */
class AiInvalidResponse extends AiException
{
    public function code(): string
    {
        return 'ai_invalid_response';
    }

    public function status(): int
    {
        return 502;
    }

    public function clientMessage(): string
    {
        return 'The food recognition service sent back something we could not read. Nothing was saved. Please try again, or log this meal manually.';
    }
}
