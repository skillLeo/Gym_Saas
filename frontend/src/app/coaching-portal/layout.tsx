'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Stethoscope, LogOut, Loader2 } from 'lucide-react';
import coachingApi from '@/lib/coachingApi';
import toast from 'react-hot-toast';

interface Physician {
  id: number;
  name: string;
  email: string;
  practice_name: string | null;
}

/**
 * The coaching portal is a completely separate product surface (§6.5.1) — no
 * AppShell, no bottom tab bar, no FAB, no member nav. It never imports member
 * layout components, so there is no code path by which a physician session
 * could render member social/messaging/recipe/video UI.
 *
 * Public routes (login, invite acceptance) render standalone. Everything else
 * requires a live physician session, checked against the server on every
 * mount — never just "a token exists in localStorage".
 */
export default function CoachingPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === '/coaching-portal/login' || pathname.startsWith('/coaching-portal/invite');

  const [physician, setPhysician] = useState<Physician | null>(null);
  const [checking, setChecking] = useState(!isPublic);

  useEffect(() => {
    if (isPublic) return;
    let cancelled = false;
    coachingApi.get('/me').then((res) => {
      if (cancelled) return;
      setPhysician(res.data.physician);
    }).catch(() => {
      if (cancelled) return;
      router.replace('/coaching-portal/login');
    }).finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => { cancelled = true; };
  }, [isPublic, pathname, router]);

  const logout = async () => {
    try { await coachingApi.post('/logout'); } catch { /* token may already be invalid */ }
    localStorage.removeItem('physician_token');
    localStorage.removeItem('physician_user');
    toast.success('Logged out.');
    router.replace('/coaching-portal/login');
  };

  if (isPublic) {
    return (
      <div data-section="coaching" className="min-h-screen bg-surface-base">
        {children}
      </div>
    );
  }

  if (checking) {
    return (
      <div data-section="coaching" className="min-h-screen bg-surface-base flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    );
  }

  if (!physician) return null; // redirecting

  return (
    <div data-section="coaching" className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-30 bg-surface-raised border-b border-border-subtle pt-safe">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-md bg-accent-surface flex items-center justify-center shrink-0">
              <Stethoscope size={17} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content-primary truncate">Coaching Portal</p>
              <p className="text-[11px] text-content-tertiary truncate">{physician.practice_name ?? physician.name}</p>
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Log out"
            className="h-10 w-10 shrink-0 rounded-md flex items-center justify-center text-content-tertiary hover:text-content-primary hover:bg-surface-sunken transition-colors"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
