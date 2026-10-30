<?php

namespace App\Services\Ai\Exceptions;

/**
 * We could not get an answer out of the provider at all: timeout, network
 * failure, 5xx, or a 429 that survived the retry.
 *
 * This is explicitly NOT "no food found". The distinction is the same one the
 * USDA service already makes, and for the same reason: "we could not look that
 * up just now" and "that does not exist" are different facts, and a member
 * acts on them differently. Reporting a provider outage as an empty result
 * would have a member believing the photo contained no food.
 */
class AiUnavailable extends AiException
{
    public function code(): string
    {
        return 'ai_unavailable';
    }

    public function status(): int
    {
        return 503;
    }

    public function clientMessage(): string
    {
        return 'The food recognition service is not responding right now. This is temporary — nothing you entered was lost. You can log this meal manually in the meantime.';
    }
}
