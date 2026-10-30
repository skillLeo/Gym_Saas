<?php

namespace App\Services\Ai\Exceptions;

use RuntimeException;

/**
 * Base class for every failure the AI layer can report.
 *
 * Callers are expected to catch these three subclasses and nothing else. The
 * point of the hierarchy is that a controller can tell the member something
 * true and specific without knowing anything about HTTP status codes from
 * OpenAI, and without any chance of an upstream error message — which may
 * quote our request back at us — reaching the browser.
 *
 * getMessage() is for our logs. clientMessage() is the only thing that should
 * ever be shown to a member.
 */
abstract class AiException extends RuntimeException
{
    /** Machine-readable code the frontend switches on. */
    abstract public function code(): string;

    /** HTTP status this failure should become. */
    abstract public function status(): int;

    /** Safe, plain-language text for the member. Never includes upstream detail. */
    abstract public function clientMessage(): string;
}
