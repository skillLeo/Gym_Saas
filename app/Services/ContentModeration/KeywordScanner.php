<?php

namespace App\Services\ContentModeration;

use App\Models\ContentFlag;
use App\Models\FlagKeyword;
use Illuminate\Database\Eloquent\Model;

/**
 * Simple keyword matching (§6.4) — case-insensitive substring match against
 * the admin-managed `flag_keywords` list. Multiple matches all get recorded
 * (`matched_terms`); severity is the highest of whatever matched, so one
 * high-severity hit among several low ones is never diluted.
 */
class KeywordScanner implements ContentScanner
{
    private const SEVERITY_RANK = ['low' => 1, 'medium' => 2, 'high' => 3];

    public function scan(Model $flaggable, string $text): ?ContentFlag
    {
        $keywords = FlagKeyword::where('is_active', true)->get(['term', 'severity']);
        if ($keywords->isEmpty()) {
            return null;
        }

        $haystack = mb_strtolower($text);
        $matched = [];
        $topSeverity = null;

        foreach ($keywords as $keyword) {
            if ($keyword->term === '' || ! str_contains($haystack, mb_strtolower($keyword->term))) {
                continue;
            }
            $matched[] = $keyword->term;
            if (! $topSeverity || self::SEVERITY_RANK[$keyword->severity] > self::SEVERITY_RANK[$topSeverity]) {
                $topSeverity = $keyword->severity;
            }
        }

        if (! $matched) {
            return null;
        }

        return ContentFlag::create([
            'flaggable_type' => $flaggable->getMorphClass(),
            'flaggable_id'   => $flaggable->getKey(),
            'reason'         => 'keyword',
            'matched_terms'  => $matched,
            'severity'       => $topSeverity,
            'status'         => 'pending',
        ]);
    }
}
