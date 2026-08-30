import { redirect } from 'next/navigation';

/**
 * /food-log is legacy; /food-journal is canonical.
 * Server-side redirect replaces the previous client-side useEffect version,
 * which rendered an empty page first and then bounced — a visible flash.
 */
export default function FoodLogRedirect() {
  redirect('/food-journal');
}
