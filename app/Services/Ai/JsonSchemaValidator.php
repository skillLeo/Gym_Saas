<?php

namespace App\Services\Ai;

/**
 * A small, strict validator for the subset of JSON Schema this application
 * actually sends to the model.
 *
 * WHY THIS EXISTS AT ALL, GIVEN STRICT MODE
 * The provider's structured-output mode already guarantees the shape, so in
 * normal operation this will never reject anything. It is here because:
 *   - `ai.base_url` is configurable, so the thing answering is not guaranteed
 *     to be OpenAI;
 *   - a schema we send might be subtly wrong in a way strict mode accepts but
 *     our own code does not expect;
 *   - the alternative to validating is trusting arbitrary JSON straight into
 *     the food pipeline, and the whole point of the pipeline is that the model
 *     is not trusted with numbers.
 *
 * WHY NOT A LIBRARY
 * It would be a new Composer dependency on a shared host with a 2 GB disk
 * quota, to check four shapes. The supported subset is listed below and
 * anything outside it is REJECTED rather than ignored — a validator that
 * silently skips keywords it does not understand is worse than none, because
 * it reports success for things it never looked at.
 *
 * Supported: type (object/array/string/number/integer/boolean/null and unions
 * via an array of types), properties, required, additionalProperties: false,
 * items, enum, minimum, maximum, minItems, maxItems.
 */
class JsonSchemaValidator
{
    private const SUPPORTED = [
        'type', 'properties', 'required', 'additionalProperties', 'items',
        'enum', 'minimum', 'maximum', 'minItems', 'maxItems',
        // Accepted and ignored: annotations that carry no constraint.
        'description', 'title', '$schema',
    ];

    /** @var list<string> */
    private array $errors = [];

    /**
     * @return list<string> Empty when the value conforms.
     */
    public function validate(mixed $value, array $schema): array
    {
        $this->errors = [];
        $this->check($value, $schema, '$');

        return $this->errors;
    }

    // ------------------------------------------------------------- internals

    private function check(mixed $value, array $schema, string $path): void
    {
        foreach (array_keys($schema) as $keyword) {
            if (! in_array($keyword, self::SUPPORTED, true)) {
                $this->errors[] = "{$path}: schema uses unsupported keyword '{$keyword}'";

                return;
            }
        }

        if (isset($schema['type']) && ! $this->typeMatches($value, $schema['type'])) {
            $want = is_array($schema['type']) ? implode('|', $schema['type']) : $schema['type'];
            $this->errors[] = "{$path}: expected {$want}, got ".get_debug_type($value);

            // Bail out: every keyword below assumes the type is right, and
            // reporting "missing property" on a string is noise.
            return;
        }

        if (array_key_exists('enum', $schema) && ! in_array($value, $schema['enum'], true)) {
            $this->errors[] = "{$path}: value is not one of ".json_encode($schema['enum']);
        }

        if (is_int($value) || is_float($value)) {
            if (isset($schema['minimum']) && $value < $schema['minimum']) {
                $this->errors[] = "{$path}: {$value} is below the minimum of {$schema['minimum']}";
            }
            if (isset($schema['maximum']) && $value > $schema['maximum']) {
                $this->errors[] = "{$path}: {$value} is above the maximum of {$schema['maximum']}";
            }
        }

        if (is_array($value) && $this->isList($value)) {
            $this->checkList($value, $schema, $path);

            return;
        }

        if (is_array($value)) {
            $this->checkObject($value, $schema, $path);
        }
    }

    private function checkList(array $value, array $schema, string $path): void
    {
        if (isset($schema['minItems']) && count($value) < $schema['minItems']) {
            $this->errors[] = "{$path}: needs at least {$schema['minItems']} items";
        }
        if (isset($schema['maxItems']) && count($value) > $schema['maxItems']) {
            $this->errors[] = "{$path}: has more than {$schema['maxItems']} items";
        }

        if (isset($schema['items']) && is_array($schema['items'])) {
            foreach ($value as $i => $item) {
                $this->check($item, $schema['items'], "{$path}[{$i}]");
            }
        }
    }

    private function checkObject(array $value, array $schema, string $path): void
    {
        $properties = $schema['properties'] ?? [];

        foreach (($schema['required'] ?? []) as $name) {
            if (! array_key_exists($name, $value)) {
                $this->errors[] = "{$path}: missing required property '{$name}'";
            }
        }

        /*
         * The reason this validator is worth having. The food pipeline must
         * accept nothing but the food list, so an extra key is a rejection,
         * not something to drop quietly: an unexpected key is either a schema
         * mismatch or the model trying to say something it was not asked for.
         */
        if (($schema['additionalProperties'] ?? null) === false) {
            foreach (array_keys($value) as $name) {
                if (! array_key_exists($name, $properties)) {
                    $this->errors[] = "{$path}: unexpected property '{$name}'";
                }
            }
        }

        foreach ($properties as $name => $sub) {
            if (array_key_exists($name, $value) && is_array($sub)) {
                $this->check($value[$name], $sub, "{$path}.{$name}");
            }
        }
    }

    private function typeMatches(mixed $value, string|array $type): bool
    {
        foreach ((array) $type as $t) {
            $ok = match ($t) {
                'object'  => is_array($value) && ! $this->isList($value),
                'array'   => is_array($value) && $this->isList($value),
                'string'  => is_string($value),
                // A JSON number may arrive as either PHP type, and an integer
                // is a valid `number`. Booleans are excluded explicitly
                // because is_numeric-style checks let true through as 1.
                'number'  => (is_int($value) || is_float($value)) && ! is_bool($value),
                'integer' => is_int($value) && ! is_bool($value),
                'boolean' => is_bool($value),
                'null'    => $value === null,
                default   => false,
            };

            if ($ok) {
                return true;
            }
        }

        return false;
    }

    /**
     * An empty PHP array is ambiguous — it is both `[]` and `{}` once decoded.
     * Treated as a list, because every empty collection in these schemas is an
     * array (an empty `matches` list, for instance), and an object with no
     * properties is never something we ask for.
     */
    private function isList(array $value): bool
    {
        return $value === [] || array_is_list($value);
    }
}
