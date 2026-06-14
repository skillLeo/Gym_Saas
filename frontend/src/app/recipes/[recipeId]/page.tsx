import RecipeDetailPageClient from './RecipeDetailPageClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return ['r1','r2','r3','r4','r5','r6','r7','r8','r9','r10','r11','r12','r13','r14','r15'].map(id => ({ recipeId: id }));
}

export default function Page() {
  return <RecipeDetailPageClient />;
}
