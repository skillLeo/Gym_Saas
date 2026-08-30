'use client';

/**
 * Role guard for everything under /admin.
 *
 * A layout rather than 28 separate page edits: it covers every current and
 * future sub-page automatically, so a new screen cannot ship unguarded.
 *
 * This is the client-side layer. The boundary that matters is the API —
 * 'admin' middleware refuses the requests outright.
 */

import { RoleGuard } from '@/components/auth/RoleGuard';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleGuard requires="admin">{children}</RoleGuard>;
}
