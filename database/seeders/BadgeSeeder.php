<?php

namespace Database\Seeders;

use App\Models\Badge;
use Illuminate\Database\Seeder;

/**
 * Initial badge definitions (§4.5).
 *
 * Three activities — workout, meal logging, community engagement — each with a
 * weekly (7 consecutive days) and a monthly (28 consecutive days) tier.
 *
 * Every one of these is a row, not code. Adding a 14-day tier, or a fourth
 * activity that the streak engine already tracks, is an INSERT. Only a new
 * *kind* of rule needs a new evaluator.
 *
 * 28 rather than 30 for the month so the milestone is a whole number of weeks
 * and lands on the same weekday it started — "four straight weeks" is something
 * a member can actually picture.
 */
class BadgeSeeder extends Seeder
{
    public function run(): void
    {
        $activities = [
            'workout'    => ['label' => 'Workout',   'icon' => 'dumbbell', 'noun' => 'training'],
            'meal_log'   => ['label' => 'Nutrition', 'icon' => 'utensils', 'noun' => 'meal logging'],
            'engagement' => ['label' => 'Community', 'icon' => 'users',    'noun' => 'community'],
        ];

        $tiers = [
            ['days' => 7,  'tier' => 'bronze', 'suffix' => 'Week',  'sort' => 1,
             'describe' => fn ($n) => "Seven days of {$n} in a row."],
            ['days' => 28, 'tier' => 'gold',   'suffix' => 'Month', 'sort' => 2,
             'describe' => fn ($n) => "Four straight weeks of {$n}. This is the hard one."],
        ];

        $sort = 0;

        foreach ($activities as $activity => $meta) {
            foreach ($tiers as $tier) {
                $sort++;

                Badge::updateOrCreate(
                    ['key' => "{$activity}_{$tier['days']}_day"],
                    [
                        'name'          => "{$meta['label']} {$tier['suffix']}",
                        'description'   => ($tier['describe'])($meta['noun']),
                        'icon_name'     => $meta['icon'],
                        'tier'          => $tier['tier'],
                        'criteria_type' => 'consecutive_days',
                        'criteria'      => ['activity' => $activity, 'days' => $tier['days']],
                        'is_active'     => true,
                        'sort_order'    => $sort,
                    ],
                );
            }
        }

        // Demonstrates that the schema carries more than one rule shape without
        // a migration: this one counts distinct active days in a window rather
        // than requiring them to be consecutive.
        Badge::updateOrCreate(
            ['key' => 'consistent_month'],
            [
                'name'          => 'Consistent Month',
                'description'   => 'Active on 20 days in a calendar month, consecutive or not.',
                'icon_name'     => 'calendar-check',
                'tier'          => 'silver',
                'criteria_type' => 'active_days_in_month',
                'criteria'      => ['activity' => 'overall', 'days' => 20],
                'is_active'     => true,
                'sort_order'    => 99,
            ],
        );
    }
}
