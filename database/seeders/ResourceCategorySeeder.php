<?php

namespace Database\Seeders;

use App\Models\ResourceCategory;
use Illuminate\Database\Seeder;

/**
 * Categories for the resources library.
 *
 * A resource must belong to one, so with the table empty an admin cannot upload
 * anything at all — the third thing found to be missing after a
 * `migrate:fresh --seed`, alongside verified accounts and subscription plans.
 * Each time the command left a legitimate feature unusable with nothing on
 * screen explaining why.
 *
 * No files are seeded, only the shelves to put them on. Inventing resources
 * would be fabricated content; an empty library with real categories is honest.
 */
class ResourceCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Programmes',   'slug' => 'programmes',   'icon_name' => 'dumbbell',    'description' => 'Training plans and workout guides.',        'sort_order' => 1],
            ['name' => 'Nutrition',    'slug' => 'nutrition',    'icon_name' => 'utensils',    'description' => 'Meal guides, macro sheets and shopping lists.', 'sort_order' => 2],
            ['name' => 'Getting started','slug' => 'getting-started','icon_name' => 'book-open','description' => 'Everything a new member needs in week one.', 'sort_order' => 3],
            ['name' => 'Forms',        'slug' => 'forms',        'icon_name' => 'folder',      'description' => 'Waivers, intake forms and paperwork.',      'sort_order' => 4],
        ];

        foreach ($categories as $category) {
            ResourceCategory::updateOrCreate(
                ['slug' => $category['slug']],
                $category + ['is_active' => true],
            );
        }

        $this->command->info(count($categories) . ' resource categories seeded.');
    }
}
