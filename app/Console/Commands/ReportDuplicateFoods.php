<?php

namespace App\Console\Commands;

use App\Models\FoodItem;
use App\Models\FoodLogEntry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Lists food_items records that look like the same food stored more than once.
 *
 * READ-ONLY, ON PURPOSE. It opens no transaction, writes nothing and deletes
 * nothing. Merging duplicate foods means repointing food_log_entries, and
 * getting that wrong silently rewrites what members ate months ago — so the
 * decision stays with a person, and this only tells them what is there.
 *
 * Duplicates exist because two write paths disagreed about what made two
 * external foods the same. The disagreement is fixed, but rows created before
 * that are still in the table, and nothing in the app will tidy them on its
 * own.
 *
 *   php artisan foods:report-duplicates
 *   php artisan foods:report-duplicates --json
 */
class ReportDuplicateFoods extends Command
{
    protected $signature = 'foods:report-duplicates {--json : Machine-readable output}';

    protected $description = 'Report food records that look duplicated. Reads only; changes nothing.';

    public function handle(): int
    {
        $groups = $this->duplicateGroups();

        if ($this->option('json')) {
            $this->line(json_encode([
                'groups'          => $groups,
                'group_count'     => count($groups),
                'extra_rows'      => array_sum(array_map(fn ($g) => count($g['items']) - 1, $groups)),
                'generated_at'    => now()->toIso8601String(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('Duplicate food report — nothing has been changed.');
        $this->newLine();

        if ($groups === []) {
            $this->line('  No duplicates found.');
            $this->newLine();

            return self::SUCCESS;
        }

        foreach ($groups as $group) {
            $this->line("  <options=bold>{$group['reason']}</>: {$group['key']}");

            foreach ($group['items'] as $item) {
                $this->line(sprintf(
                    '    #%-6d %-44s source=%-6s entries=%-4d %s',
                    $item['id'],
                    mb_strimwidth($item['name'], 0, 44, '…'),
                    $item['food_source'] ?? '-',
                    $item['entries'],
                    $item['entries'] === 0 ? '(unused)' : '',
                ));
            }
            $this->newLine();
        }

        $extra = array_sum(array_map(fn ($g) => count($g['items']) - 1, $groups));

        $this->line(sprintf('  %d group(s), %d redundant record(s).', count($groups), $extra));
        $this->newLine();
        $this->comment('  Nothing was deleted or merged. A record with entries=0 is safe to');
        $this->comment('  remove by hand; one with entries is referenced by a member\'s journal');
        $this->comment('  and merging it means repointing those rows, which is a decision for');
        $this->comment('  a person, not a script.');
        $this->newLine();

        return self::SUCCESS;
    }

    /**
     * @return list<array{reason:string,key:string,items:list<array<string,mixed>>}>
     */
    private function duplicateGroups(): array
    {
        $groups = [];

        /*
         * Same external id, stored more than once. This is the shape the old
         * key mismatch produced: one row with a food_source and one without.
         */
        $byExternalId = FoodItem::query()
            ->whereNotNull('external_food_id')
            ->where('is_custom', false)
            ->select('external_food_id', DB::raw('COUNT(*) as n'))
            ->groupBy('external_food_id')
            ->having('n', '>', 1)
            ->pluck('external_food_id');

        foreach ($byExternalId as $externalId) {
            $groups[] = [
                'reason' => 'Same external food id',
                'key'    => (string) $externalId,
                'items'  => $this->describe(
                    FoodItem::where('external_food_id', $externalId)->where('is_custom', false)->get(),
                ),
            ];
        }

        /*
         * Same name, one row carrying an external id and another not. Produced
         * by the older bug where the id was dropped by validation entirely, so
         * a food logged before that fix has a nameless twin of itself.
         */
        $names = FoodItem::query()
            ->where('is_custom', false)
            ->select('name', DB::raw('COUNT(*) as n'), DB::raw('COUNT(external_food_id) as with_id'))
            ->groupBy('name')
            ->having('n', '>', 1)
            ->havingRaw('COUNT(external_food_id) < COUNT(*)')
            ->havingRaw('COUNT(external_food_id) > 0')
            ->pluck('name');

        foreach ($names as $name) {
            $groups[] = [
                'reason' => 'Same name, one row has no external id',
                'key'    => (string) $name,
                'items'  => $this->describe(
                    FoodItem::where('name', $name)->where('is_custom', false)->get(),
                ),
            ];
        }

        return $groups;
    }

    /** @return list<array<string,mixed>> */
    private function describe($items): array
    {
        return $items->map(fn (FoodItem $f) => [
            'id'               => $f->id,
            'name'             => $f->name,
            'brand'            => $f->brand,
            'external_food_id' => $f->external_food_id,
            'food_source'      => $f->food_source,
            'calories'         => $f->calories,
            // How much is at stake: a record nothing points at can simply go.
            'entries'          => FoodLogEntry::where('food_item_id', $f->id)->count(),
            'created_at'       => $f->created_at?->toIso8601String(),
        ])->values()->all();
    }
}
