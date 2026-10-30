<?php

namespace App\Services\Ai\Exceptions;

/**
 * A limit of OURS stopped the call before it was made: the monthly spend cap,
 * the member's daily allowance, or the per-minute throttle.
 *
 * Nothing was sent to the provider and nothing was charged. Manual logging is
 * completely unaffected, and the message must say so — a member who reads
 * "limit reached" and assumes the food journal is closed for the day has been
 * misled by us.
 */
class AiLimitReached extends AiException
{
    public function __construct(
        string $message,
        private readonly string $reason,
        private readonly string $clientMessage,
    ) {
        parent::__construct($message);
    }

    /** cap_reached | daily_limit | rate_limit */
    public function reason(): string
    {
        return $this->reason;
    }

    public function code(): string
    {
        return 'ai_limit_reached';
    }

    public function status(): int
    {
        return 429;
    }

    public function clientMessage(): string
    {
        return $this->clientMessage;
    }
}
