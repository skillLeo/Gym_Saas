<?php

namespace App\Services\Ai;

use App\Models\SystemSetting;

/**
 * The runtime knobs for the AI features.
 *
 * Every value is an admin-editable row in system_settings, falling back to
 * config('ai.defaults') when an admin has never saved the screen. The fallback
 * matters more than it looks: if these read straight from system_settings with
 * no default, a fresh install would see the kill switch as empty, read that as
 * falsey, and ship with every AI feature silently dead — or, with the opposite
 * sign convention, with no spend cap at all.
 *
 * Reads go through SystemSetting::get(), which hydrates a model so the
 * `encrypted` cast applies. None of these are secrets, but the column is
 * encrypted for all rows, so a query-builder ->value() read would hand back
 * ciphertext.
 */
class AiSettings
{
    public const GROUP = 'ai';

    /** Global kill switch. Off means no AI call happens anywhere, for anyone. */
    public function enabled(): bool
    {
        return $this->bool('ai_enabled');
    }

    /**
     * Beta mode: access is limited to members individually flagged by an admin.
     *
     * On by default, which is what lets the client try it on his own account
     * while every other member carries on with manual logging and cannot run
     * up the bill.
     */
    public function betaMode(): bool
    {
        return $this->bool('ai_beta_mode');
    }

    /** Month-to-date estimated spend ceiling, in USD. */
    public function monthlyCapUsd(): float
    {
        return (float) $this->raw('ai_monthly_cap_usd');
    }

    /** Successful AI logs one member may create per calendar day. */
    public function dailyLimitPerUser(): int
    {
        return (int) $this->raw('ai_daily_limit_per_user');
    }

    /** Calls one member may make per rolling minute. */
    public function perMinutePerUser(): int
    {
        return (int) $this->raw('ai_per_minute_per_user');
    }

    /** Everything, for the admin screen. */
    public function all(): array
    {
        return [
            'ai_enabled'              => $this->enabled(),
            'ai_beta_mode'            => $this->betaMode(),
            'ai_monthly_cap_usd'      => $this->monthlyCapUsd(),
            'ai_daily_limit_per_user' => $this->dailyLimitPerUser(),
            'ai_per_minute_per_user'  => $this->perMinutePerUser(),
        ];
    }

    public function set(string $key, mixed $value): void
    {
        // Booleans are stored as '1'/'0' so that bool() below reads them back
        // the same way regardless of the driver. Storing a PHP false would
        // persist an empty string, which is indistinguishable from "never set".
        if (is_bool($value)) {
            $value = $value ? '1' : '0';
        }

        SystemSetting::set($key, (string) $value, self::GROUP, false);
    }

    // ------------------------------------------------------------- internals

    private function raw(string $key): mixed
    {
        $default = config('ai.defaults.'.$key);
        $stored  = SystemSetting::get($key);

        // blank() rather than is_null(): an admin clearing the field leaves an
        // empty string, and casting that to a number gives 0 — which for a
        // spend cap means "never allow anything" and for a daily limit means
        // the same. Fall back to the configured default instead.
        return blank($stored) ? $default : $stored;
    }

    private function bool(string $key): bool
    {
        return filter_var($this->raw($key), FILTER_VALIDATE_BOOLEAN);
    }
}
