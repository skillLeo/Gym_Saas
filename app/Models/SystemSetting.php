<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    /**
     * Placeholder returned by getGroup() in place of a secret's real value.
     *
     * Callers that write settings back must treat this as "unchanged" —
     * otherwise a load-then-save cycle stores the mask as the actual secret.
     */
    public const MASK = '••••••••';

    protected $fillable = ['key', 'value', 'group', 'is_secret'];

    /**
     * `value` is encrypted at rest (launch-blocker fix — previously plaintext).
     * Laravel's `encrypted` cast decrypts transparently on read and encrypts on
     * write, but only when the value passes through Eloquent attribute access.
     * It does NOT apply to query-builder scalar helpers like `->value('value')`
     * — that reads the raw ciphertext straight from the column. Every read path
     * below therefore hydrates a model (`->first()`) rather than using
     * `->value()`/`->pluck()` on the `value` column.
     */
    protected $casts = ['is_secret' => 'boolean', 'value' => 'encrypted'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::where('key', $key)->first()?->value ?? $default;
    }

    public static function set(string $key, mixed $value, string $group = 'general', bool $isSecret = false): void
    {
        static::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'group' => $group, 'is_secret' => $isSecret]
        );
    }

    public static function getGroup(string $group): array
    {
        return static::where('group', $group)
            ->get()
            ->mapWithKeys(fn($s) => [$s->key => $s->is_secret ? self::MASK : $s->value])
            ->toArray();
    }

    public static function getRaw(string $group): array
    {
        return static::where('group', $group)
            ->get()
            ->mapWithKeys(fn($s) => [$s->key => $s->value])
            ->toArray();
    }
}
