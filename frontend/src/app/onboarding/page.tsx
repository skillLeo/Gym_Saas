import { redirect } from 'next/navigation';

/**
 * Canonical onboarding lives at /auth/onboarding.
 *
 * This route previously held a SECOND, divergent onboarding form that only
 * updated the local Zustand store and never called POST /api/onboarding. A
 * user who completed it was marked onboarded in the browser but not in the
 * database, so the server bounced them straight back to onboarding on the next
 * login or on any other device.
 *
 * Server-side redirect: no flash, no client JS, no duplicate form to drift.
 */
export default function OnboardingRedirect() {
  redirect('/auth/onboarding');
}
