<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Keyword and date search across the member's own private messages (§5.5).
 *
 * Scoping is the security-critical part: results are restricted to
 * conversations the requesting member is actually a participant in, enforced
 * server-side with a join against `conversation_participants`. A client-supplied
 * conversation id is never trusted.
 */
class MessageSearchController extends Controller
{
    private const PER_PAGE = 20;

    /** Named ranges the UI offers, in days. `custom` uses explicit dates. */
    private const RANGES = ['30' => 30, '90' => 90, '365' => 365];

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q'          => 'required|string|min:2|max:200',
            'range'      => 'nullable|in:30,90,365,custom,all',
            'from'       => 'nullable|date',
            'to'         => 'nullable|date|after_or_equal:from',
            'page'       => 'nullable|integer|min:1',
        ]);

        $userId = $request->user()->id;
        $term   = trim($validated['q']);

        $query = Message::query()
            // The scope. Every result must belong to a conversation this member
            // participates in — joined, not filtered after the fact, so there is
            // no window where another member's messages are even selected.
            ->join('conversation_participants as cp', function ($join) use ($userId) {
                $join->on('cp.conversation_id', '=', 'messages.conversation_id')
                     ->where('cp.user_id', '=', $userId);
            })
            ->select('messages.*');

        $this->applyDateRange($query, $validated);
        $usedFulltext = $this->applyKeyword($query, $term);
        $page = $validated['page'] ?? 1;

        // The FULLTEXT index has two failure modes, and BOTH are silent to the
        // member unless handled here:
        //
        //  1. Stale — an unclean MySQL shutdown leaves InnoDB's auxiliary
        //     tables inconsistent. MATCH then matches NOTHING and raises no
        //     error, so the member sees "no results" for a word they can read
        //     on screen. (This actually happened during development.)
        //  2. Missing — if the index is dropped, MATCH throws rather than
        //     returning zero, which surfaces as a 500.
        //
        // Either way, search falls back to the substring path: correct but
        // slower beats confidently wrong or broken.
        try {
            $results = $this->paginate($query, $page);
        } catch (\Illuminate\Database\QueryException $e) {
            Log::error('Message FULLTEXT query failed; falling back to substring search', [
                'error' => $e->getMessage(),
            ]);
            $results      = $this->paginate($this->substringQuery($userId, $term, $validated), $page);
            $usedFulltext = false;
        }

        if ($usedFulltext && $results->total() === 0) {
            $retry = $this->paginate($this->substringQuery($userId, $term, $validated), $page);

            if ($retry->total() > 0) {
                Log::warning('FULLTEXT returned nothing where LIKE matched; the index likely needs rebuilding', [
                    'term'    => $term,
                    'matches' => $retry->total(),
                ]);

                $results      = $retry;
                $usedFulltext = false;
            }
        }

        return response()->json([
            'data' => collect($results->items())->map(fn (Message $m) => [
                'id'              => $m->id,
                'conversation_id' => $m->conversation_id,
                'content'         => $m->content,
                // Pre-computed so the UI does not have to re-implement matching.
                'snippet'         => $this->snippet($m->content, $term),
                'created_at'      => $m->created_at,
                'sender'          => [
                    'id'     => $m->sender?->id,
                    'name'   => $m->sender?->name,
                    'avatar' => $m->sender?->avatar_url,
                    'is_me'  => $m->sender_id === $userId,
                ],
                'with' => $m->conversation?->participants
                    ->firstWhere('id', '!=', $userId)?->only(['id', 'name']),
            ]),
            'meta' => [
                'total'        => $results->total(),
                'current_page' => $results->currentPage(),
                'last_page'    => $results->lastPage(),
                // Surfaced so the caveat below is visible rather than hidden.
                'match_mode'   => $usedFulltext ? 'fulltext' : 'substring',
            ],
        ]);
    }

    private function paginate($query, int $page)
    {
        return $query
            ->with(['sender:id,name,avatar', 'conversation.participants:id,name,avatar'])
            ->orderByDesc('messages.created_at')
            ->paginate(self::PER_PAGE, ['*'], 'page', $page);
    }

    /**
     * The substring path, scoped identically to the indexed one.
     *
     * Built fresh rather than reusing the fulltext builder, because a query
     * that already carries a MATCH clause cannot have it removed.
     */
    private function substringQuery(int $userId, string $term, array $validated)
    {
        $query = Message::query()
            ->join('conversation_participants as cp', function ($join) use ($userId) {
                $join->on('cp.conversation_id', '=', 'messages.conversation_id')
                     ->where('cp.user_id', '=', $userId);
            })
            ->select('messages.*');

        $this->applyDateRange($query, $validated);

        $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $term) . '%';

        return $query->where('messages.content', 'like', $like);
    }

    /**
     * Keyword matching.
     *
     * FULLTEXT with MATCH…AGAINST is the indexed path. MySQL's default
     * `innodb_ft_min_token_size` is 3, so shorter terms — and terms that are
     * entirely stopwords — return nothing at all from the index. Rather than
     * silently showing "no results" for a term the member can see on screen,
     * those fall back to LIKE and the response says which mode ran.
     *
     * The LIKE path escapes `%` and `_`; unescaped, a single `%` would return
     * every message the member has ever sent or received.
     *
     * @return bool whether the indexed path was used
     */
    private function applyKeyword($query, string $term): bool
    {
        $shortest = collect(preg_split('/\s+/', $term, -1, PREG_SPLIT_NO_EMPTY))
            ->map(fn ($w) => mb_strlen($w))
            ->min() ?? 0;

        if ($shortest >= 4 && !str_contains($term, '"')) {
            // Boolean mode so multi-word terms behave predictably, with each
            // word required rather than merely preferred.
            $boolean = collect(preg_split('/\s+/', $term, -1, PREG_SPLIT_NO_EMPTY))
                ->map(fn ($w) => '+' . str_replace(['+', '-', '*', '(', ')', '~', '<', '>'], '', $w) . '*')
                ->implode(' ');

            $query->whereRaw('MATCH (messages.content) AGAINST (? IN BOOLEAN MODE)', [$boolean]);

            return true;
        }

        $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $term) . '%';
        $query->where('messages.content', 'like', $like);

        return false;
    }

    private function applyDateRange($query, array $v): void
    {
        $range = $v['range'] ?? 'all';

        if ($range === 'custom') {
            if (!empty($v['from'])) {
                $query->where('messages.created_at', '>=', Carbon::parse($v['from'])->startOfDay());
            }
            if (!empty($v['to'])) {
                $query->where('messages.created_at', '<=', Carbon::parse($v['to'])->endOfDay());
            }

            return;
        }

        if (isset(self::RANGES[$range])) {
            $query->where('messages.created_at', '>=', now()->subDays(self::RANGES[$range]));
        }
    }

    /**
     * A short window of text around the first match, so a result is scannable
     * without opening the conversation.
     */
    private function snippet(string $content, string $term, int $radius = 60): string
    {
        $pos = mb_stripos($content, $term);

        if ($pos === false) {
            // Fulltext matched a stem or one word of several; fall back to the
            // opening of the message rather than showing nothing.
            return mb_strimwidth($content, 0, $radius * 2, '…');
        }

        $start   = max(0, $pos - $radius);
        $snippet = mb_substr($content, $start, $radius * 2 + mb_strlen($term));

        return ($start > 0 ? '…' : '') . $snippet . ($start + mb_strlen($snippet) < mb_strlen($content) ? '…' : '');
    }
}
