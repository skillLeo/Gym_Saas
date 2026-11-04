<?php

/*
|--------------------------------------------------------------------------
| Everyday food names, translated for the food database
|--------------------------------------------------------------------------
|
| USDA FoodData Central is American and clinical. It has no "porridge", no
| "wholemeal" and no "courgette", and searching for them returns whatever
| happens to share a word — "porridge" found a 260 kcal loaf of oatmeal bread.
|
| Each entry here is an EXTRA search, not a replacement. The original words
| are searched too and every result is ranked together, so an alias can only
| add candidates, never hide the ones the member asked for. That is why an
| ambiguous one is safe to include: see "chips" below.
|
| Matching is word-by-word and case-insensitive, so "wholemeal" rewrites
| "wholemeal toast" to "whole wheat toast". Keys must be single lowercase
| words; values may be several words.
|
| Edit freely — it is read at runtime and nothing else needs changing.
|
*/

return [

    /*
    |----------------------------------------------------------------------
    | British and Irish names
    |----------------------------------------------------------------------
    */

    /*
     * Not "oatmeal": in the curated datasets the short "oatmeal" entries are
     * all oatmeal BREAD and oatmeal COOKIES. The cooked cereal a member means
     * is filed under "Cereals, oats, regular and quick, unenriched, cooked
     * with water" (71 kcal) — so the alias names the cereal, which also makes
     * "cereals" the leading word and beats "Oat bran, cooked".
     */
    'porridge'   => 'cereals oats cooked',

    'wholemeal'  => 'whole wheat',

    // Toast is toasted bread, and saying so reaches "Bread, whole-wheat"
    // instead of raw durum wheat. Applies word by word, so "wholemeal toast"
    // becomes "whole wheat bread toasted".
    'toast'      => 'bread toasted',
    'aubergine'  => 'eggplant',
    'courgette'  => 'zucchini',
    'coriander'  => 'cilantro',
    'rocket'     => 'arugula',
    'prawn'      => 'shrimp',
    'prawns'     => 'shrimp',
    'beetroot'   => 'beets',
    'sultanas'   => 'raisins',
    'yoghurt'    => 'yogurt',
    'swede'      => 'rutabaga',
    'mangetout'  => 'snow peas',
    'rashers'    => 'bacon',
    'gammon'     => 'ham',
    'mince'      => 'ground beef',

    /*
     * "Chips" means fries here and crisps in America, and both readings are
     * real. Because an alias only ADDS a search, both sets of candidates are
     * ranked together and the member sees both in the picker — so the
     * ambiguity costs nothing and resolves itself. "Crisps" is unambiguous.
     */
    'chips'      => 'french fries',
    'crisps'     => 'potato chips',

    /*
    |----------------------------------------------------------------------
    | Plurals and everyday spellings
    |----------------------------------------------------------------------
    |
    | Only words that mean one food and nothing else. Common words like
    | "spring", "joint" or "brew" are deliberately absent: they would fire on
    | queries that have nothing to do with the food meant, and every alias
    | costs an extra database query.
    |
    */

    'aubergines' => 'eggplant',
    'courgettes' => 'zucchini',
    'mash'       => 'mashed potatoes',
    'fizzy'      => 'carbonated beverage',

];
