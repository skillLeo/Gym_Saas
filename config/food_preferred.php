<?php

/*
|--------------------------------------------------------------------------
| The food we mean, when a member types a common word
|--------------------------------------------------------------------------
|
| Ranking a thousand candidates by name alone gets most foods right and a few
| stubbornly wrong. "Potato" found potato SKIN, "bacon" found TURKEY bacon,
| "salmon" found canned sockeye. Every one of those is a real USDA food whose
| name answers the query perfectly; no scoring rule separates them from the
| one a person means without knowing which food that is.
|
| So this says which food that is, for the words people log most. Each entry
| is a FoodData Central fdc_id, and a food named here is put first and marked
| so the member can see it was chosen deliberately. The other candidates are
| still offered in the dropdown, unchanged — this decides the default, not the
| options.
|
| Matched on the whole query after lowercasing and collapsing spaces, so this
| only ever fires on the exact word. "Chicken breast" matches; "grilled
| chicken breast with rice" does not, and falls through to ranking.
|
| TO EDIT: find the food at https://fdc.nal.usda.gov/, take the FDC ID from
| the URL, and put it here. The comment after each line is the description and
| calories per 100 g as imported, so a wrong id is visible on sight. There is
| a test that every id in this file exists locally and has a calorie value.
|
| Data: USDA FoodData Central, public domain (CC0 1.0).
|
*/

return [
    'almonds'          => 170567,   // Nuts, almonds  (579 kcal)
    'apple'            => 171688,   // Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)  (52 kcal)
    'apple juice'      => 167771,   // Apple juice, canned or bottled, unsweetened, with added ascorbic acid  (46 kcal)
    'apricot'          => 171697,   // Apricots, raw  (48 kcal)
    'asparagus'        => 168389,   // Asparagus, raw  (20 kcal)
    'aubergine'        => 169228,   // Eggplant, raw  (25 kcal)
    'avocado'          => 171705,   // Avocados, raw, all commercial varieties  (160 kcal)
    'bacon'            => 167712,   // Pork, cured, bacon, cooked, broiled, pan-fried or roasted, reduced sodium  (541 kcal)
    'bagel'            => 174899,   // Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)  (264 kcal)
    'baked beans'      => 175182,   // Beans, baked, canned, plain or vegetarian  (94 kcal)
    'banana'           => 173944,   // Bananas, raw  (89 kcal)
    'beetroot'         => 169145,   // Beets, raw  (43 kcal)
    'black beans'      => 175237,   // Beans, black, mature seeds, cooked, boiled, with salt  (132 kcal)
    'blackberries'     => 173946,   // Blackberries, raw  (43 kcal)
    'blueberries'      => 171711,   // Blueberries, raw  (57 kcal)
    'bread'            => 325871,   // Bread, white, commercially prepared  (270 kcal)
    'broccoli'         => 170379,   // Broccoli, raw  (34 kcal)
    'brown rice'       => 169704,   // Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)  (123 kcal)
    'butter'           => 173410,   // Butter, salted  (717 kcal)
    'butternut squash' => 169295,   // Squash, winter, butternut, raw  (45 kcal)
    'cabbage'          => 169975,   // Cabbage, raw  (25 kcal)
    'carrot'           => 170393,   // Carrots, raw  (41 kcal)
    'cashews'          => 170162,   // Nuts, cashew nuts, raw  (553 kcal)
    'cauliflower'      => 169986,   // Cauliflower, raw  (25 kcal)
    'celery'           => 169988,   // Celery, raw  (14 kcal)
    'cheddar cheese'   => 328637,   // Cheese, cheddar  (408 kcal)
    'cherries'         => 171719,   // Cherries, sweet, raw  (63 kcal)
    'chicken breast'   => 171477,   // Chicken, broilers or fryers, breast, meat only, cooked, roasted  (165 kcal)
    'chicken thigh'    => 172387,   // Chicken, broilers or fryers, thigh, meat only, cooked, fried  (218 kcal)
    'chickpeas'        => 173799,   // Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, with salt  (164 kcal)
    'chocolate'        => 170274,   // Candies, chocolate, dark, NFS (45-59% cacao solids 90%; 60-69% cacao solids 5%; 70-85% cacao solids 5%)  (550 kcal)
    'cod'              => 171956,   // Fish, cod, Atlantic, cooked, dry heat  (105 kcal)
    'coffee'           => 171890,   // Beverages, coffee, brewed, prepared with tap water  (1 kcal)
    'cottage cheese'   => 172182,   // Cheese, cottage, lowfat, 2% milkfat  (81 kcal)
    'courgette'        => 169291,   // Squash, summer, zucchini, includes skin, raw  (17 kcal)
    'couscous'         => 169700,   // Couscous, cooked  (112 kcal)
    'cream'            => 170859,   // Cream, fluid, heavy whipping  (340 kcal)
    'cucumber'         => 168409,   // Cucumber, with peel, raw  (15 kcal)
    'dates'            => 168191,   // Dates, medjool  (277 kcal)
    'egg'              => 173424,   // Egg, whole, cooked, hard-boiled  (155 kcal)
    'eggplant'         => 169228,   // Eggplant, raw  (25 kcal)
    'feta'             => 173420,   // Cheese, feta  (265 kcal)
    'garlic'           => 169230,   // Garlic, raw  (149 kcal)
    'grapes'           => 174683,   // Grapes, red or green (European type, such as Thompson seedless), raw  (69 kcal)
    'greek yogurt'     => 330137,   // Yogurt, Greek, plain, nonfat  (61 kcal)
    'green beans'      => 169961,   // Beans, snap, green, raw  (31 kcal)
    'ground beef'      => 174035,   // Beef, ground, 85% lean meat / 15% fat, loaf, cooked, baked  (240 kcal)
    'ham'              => 173863,   // Ham, sliced, pre-packaged, deli meat (96%fat free, water added)  (107 kcal)
    'honey'            => 169640,   // Honey  (304 kcal)
    'hummus'           => 174289,   // Hummus, commercial  (237 kcal)
    'kale'             => 168421,   // Kale, raw  (35 kcal)
    'kidney beans'     => 175242,   // Beans, kidney, red, mature seeds, cooked, boiled, with salt  (127 kcal)
    'kiwi'             => 168153,   // Kiwifruit, green, raw  (61 kcal)
    'lemon'            => 167746,   // Lemons, raw, without peel  (29 kcal)
    'lentils'          => 175254,   // Lentils, mature seeds, cooked, boiled, with salt  (114 kcal)
    'lettuce'          => 169247,   // Lettuce, cos or romaine, raw  (17 kcal)
    'lime'             => 168155,   // Limes, raw  (30 kcal)
    'mango'            => 169910,   // Mangos, raw  (60 kcal)
    'melon'            => 169092,   // Melons, cantaloupe, raw  (34 kcal)
    'milk'             => 171265,   // Milk, whole, 3.25% milkfat, with added vitamin D  (61 kcal)
    'mince'            => 174035,   // Beef, ground, 85% lean meat / 15% fat, loaf, cooked, baked  (240 kcal)
    'mozzarella'       => 170845,   // Cheese, mozzarella, whole milk  (299 kcal)
    'mushrooms'        => 169251,   // Mushrooms, white, raw  (22 kcal)
    'noodles'          => 168919,   // Noodles, egg, cooked, enriched, with added salt  (138 kcal)
    // "Oats" is the dry grain someone weighs out; "porridge" below is the
    // cooked dish. Same food, four times the calories per 100 g, so they must
    // not point at the same entry.
    'oats'             => 169705,   // Oats, whole grain, dry  (389 kcal)
    'olive oil'        => 171413,   // Oil, olive, salad or cooking  (884 kcal)
    'onion'            => 170000,   // Onions, raw  (40 kcal)
    'orange'           => 169097,   // Oranges, raw, all commercial varieties  (47 kcal)
    'orange juice'     => 169098,   // Orange juice, raw (Includes foods for USDA's Food Distribution Program)  (45 kcal)
    'parmesan'         => 171247,   // Cheese, parmesan, grated  (420 kcal)
    'pasta'            => 169751,   // Pasta, cooked, enriched, with added salt  (157 kcal)
    'peach'            => 169928,   // Peaches, yellow, raw  (39 kcal)
    'peanut butter'    => 324860,   // Peanut butter, smooth style, with salt  (597 kcal)
    'peanuts'          => 172430,   // Peanuts, all types, raw  (567 kcal)
    'pear'             => 169118,   // Pears, raw  (57 kcal)
    'peas'             => 170419,   // Peas, green, raw  (81 kcal)
    'pepper'           => 170108,   // Peppers, sweet, red, raw  (26 kcal)
    'pineapple'        => 169124,   // Pineapple, raw, all varieties  (50 kcal)
    'plum'             => 169949,   // Plums, raw  (46 kcal)
    'pork chop'        => 168243,   // Pork, fresh, loin, center rib (chops), bone-in, separable lean only, cooked, braised  (208 kcal)
    'porridge'         => 173905,   // Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt  (71 kcal)
    'potato'           => 170026,   // Potatoes, flesh and skin, raw  (77 kcal)
    'prawns'           => 175180,   // Crustaceans, shrimp, cooked  (99 kcal)
    'quinoa'           => 168917,   // Quinoa, cooked  (120 kcal)
    'raisins'          => 168166,   // Raisins, seeded  (296 kcal)
    'raspberries'      => 167755,   // Raspberries, raw  (52 kcal)
    'rice'             => 168878,   // Rice, white, long-grain, regular, enriched, cooked  (130 kcal)
    'salmon'           => 175168,   // Fish, salmon, Atlantic, farmed, cooked, dry heat  (206 kcal)
    'sausage'          => 174579,   // Sausage, pork and beef, fresh, cooked  (396 kcal)
    'shrimp'           => 175180,   // Crustaceans, shrimp, cooked  (99 kcal)
    'skimmed milk'     => 171269,   // Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)  (34 kcal)
    'spaghetti'        => 169751,   // Pasta, cooked, enriched, with added salt  (157 kcal)
    'spinach'          => 168462,   // Spinach, raw  (23 kcal)
    'steak'            => 169455,   // Beef, loin, top loin steak, boneless, lip off, separable lean only, trimmed to 0" fat, choice, cooked, grilled  (211 kcal)
    'strawberries'     => 167762,   // Strawberries, raw  (32 kcal)
    'sugar'            => 169655,   // Sugars, granulated  (387 kcal)
    'sweet potato'     => 168482,   // Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)  (86 kcal)
    'sweetcorn'        => 169998,   // Corn, sweet, yellow, raw  (86 kcal)
    'toast'            => 174925,   // Bread, white, commercially prepared, toasted  (290 kcal)
    'tofu'             => 172475,   // Tofu, raw, firm, prepared with calcium sulfate  (144 kcal)
    'tomato'           => 170457,   // Tomatoes, red, ripe, raw, year round average  (18 kcal)
    'tortilla'         => 167535,   // Tortillas, ready-to-bake or -fry, flour, shelf stable  (297 kcal)
    'tuna'             => 334194,   // Fish, tuna, light, canned in water, drained solids  (90 kcal)
    'turkey breast'    => 172876,   // Turkey, breast, from whole bird, meat only, with added solution, raw  (102 kcal)
    'vegetable oil'    => 171025,   // Oil, sunflower, linoleic, (approx. 65%)  (884 kcal)
    'walnuts'          => 170187,   // Nuts, walnuts, english  (654 kcal)
    'watermelon'       => 167765,   // Watermelon, raw  (30 kcal)
    'white bread'      => 325871,   // Bread, white, commercially prepared  (270 kcal)
    'white rice'       => 168878,   // Rice, white, long-grain, regular, enriched, cooked  (130 kcal)
    'whole milk'       => 171265,   // Milk, whole, 3.25% milkfat, with added vitamin D  (61 kcal)
    'wholemeal bread'  => 172688,   // Bread, whole-wheat, commercially prepared  (252 kcal)
    'wholemeal toast'  => 172689,   // Bread, whole-wheat, commercially prepared, toasted  (306 kcal)
    'yogurt'           => 171284,   // Yogurt, plain, whole milk  (61 kcal)
    'zucchini'         => 169291,   // Squash, summer, zucchini, includes skin, raw  (17 kcal)
];
