<?php

namespace App\Services\ContentModeration;

use Illuminate\Database\Eloquent\Model;

/**
 * §6.4 — detection is architected behind this interface so Phase 11 can swap
 * in AI-based detection by adding one class and rebinding it in
 * AppServiceProvider, with no schema change and no change to any caller.
 * `KeywordScanner` is the only implementation today.
 */
interface ContentScanner
{
    /**
     * Scan the given content and create a `ContentFlag` row if it matches,
     * returning it — or null if nothing matched. Never deletes, hides, or
     * otherwise acts on the content itself; flagging and notifying is the
     * entire scope (§6.4 — "never auto-delete, auto-lock, or auto-moderate").
     */
    public function scan(Model $flaggable, string $text): ?\App\Models\ContentFlag;
}
