'use client';

/**
 * Client-side role guard — the third and weakest of three layers.
 *
 *   1. API middleware (`admin` / `member`)  — the real boundary. 403s.
 *   2. Next.js middleware (`proxy.ts`)      — redirects on a role cookie.
 *   3. This                                 — catches the case the other two
 *                                             cannot: a client-side navigation
 *                                             that never hits the edge, and the
 *                                             moment before hydration finishes.
 *
 * Renders nothing of the page while it is deciding, so a member never sees a
 * flash of admin content before being moved.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

type Requirement = 'member' | 'admin';

export function RoleGuard({
  requires,
  children,
}: {
  requires: Requirement;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuthStore();

  // `user` is null on the very first render while the persisted store rehydrates.
  // Treat that as "not decided yet" rather than "not allowed", or every page
  // would bounce on load.
  const decided = user !== null;
  const allowed = !decided
    ? null
    : requires === 'admin'
      ? Boolean(user?.is_admin)
      : !user?.is_admin;

  useEffect(() => {
    if (allowed === false) {
      router.replace(requires === 'admin' ? '/dashboard?denied=admin_only' : '/admin?denied=member_only');
    }
  }, [allowed, requires, router]);

  if (allowed !== true) {
    return (
      <div className="flex items-center justify-center py-24" aria-live="polite">
        <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label="Checking access" />
      </div>
    );
  }

  return <>{children}</>;
}
