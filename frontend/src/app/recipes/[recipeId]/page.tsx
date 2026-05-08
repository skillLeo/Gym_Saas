import RecipeDetailPageClient from './RecipeDetailPageClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [
    { recipeId: 'r1' },
    { recipeId: 'r2' },
    { recipeId: 'r3' },
    { recipeId: 'r4' },
    { recipeId: 'r5' },
    { recipeId: 'r6' },
  ];
}

export default function Page() {
  return <RecipeDetailPageClient />;
}
