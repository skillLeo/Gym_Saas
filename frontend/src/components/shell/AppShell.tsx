'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { isAuthenticated } from '@/lib/auth';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useI18nStore } from '@/store/i18nStore';
import { Bell, LogOut } from 'lucide-react';

import { RequireSubscription } from '@/components/subscription/SubscriptionGate';

import { BottomTabBar } from './BottomTabBar';
import { MoreSheet } from './MoreSheet';
import { Fab } from './Fab';
import { PwaProvider } from './PwaProvider';
import { useUnreadCounts, type UnreadCounts } from './useUnreadCounts';
import { SIDEBAR_MAIN, SIDEBAR_ACCOUNT, SIDEBAR_ADMIN, navFor, sectionForPath, activeNavHref, type NavItem } from './nav-config';

interface AppShellProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Highlight exactly one destination. See `activeNavHref` — the old
 * `startsWith` check lit up every ancestor, so `/social/friends` selected both
 * Community and Friends at the same time.
 */
function isActiveHref(pathname: string, href: string) {
  return activeNavHref(pathname) === href;
}

/**
 * Sidebar nav list.
 *
 * MUST stay at module scope. It previously lived inside AppShell's render body,
 * which made React treat it as a brand-new component type on every render and
 * unmount/remount the whole sidebar. `useUnreadCounts` polls every 60s, so the
 * desktop sidebar was silently remounting once a minute — losing focus and
 * throwing away DOM work. (react-hooks/static-components)
 */
function NavList({
  items,
  pathname,
  counts,
}: {
  items: NavItem[];
  pathname: string;
  counts: UnreadCounts;
}) {
  const { t } = useI18nStore();

  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActiveHref(pathname, item.href);
        const badge = item.badge ? counts[item.badge] : 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 h-10 px-3 rounded-sm text-body transition-colors duration-150',
                active
                  ? 'bg-accent-surface text-accent font-semibold'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-sunken'
              )}
            >
              <Icon name={item.icon} size="md" strokeWidth={active ? 2 : 1.75} />
              <span className="flex-1 truncate">{item.labelKey ? t(item.labelKey) : item.label}</span>
              {badge > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center tabular">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The single app shell for every authenticated page.
 *
 * Mobile (< lg): native-style frame — bottom tab bar, contextual FAB, More
 * sheet. Desktop (lg+): sidebar layout.
 *
 * Replaces AppSidebarLayout / DashboardShell / MobileBottomNav / Navbar, which
 * now delegate here so all 57 consumer files keep working unchanged.
 */
/**
 * Routes that stay reachable without an active subscription.
 *
 * Without this the gate is a trap: a lapsed member would be blocked from the
 * very pages they need in order to pay. Mirrors ALLOWED_PREFIXES in the
 * server-side EnsureSubscriptionActive middleware — if the two disagree, a page
 * renders and then every request it makes fails.
 */
const UNGATED = ['/membership', '/auth', '/onboarding', '/offline', '/settings', '/profile'];

function isUngated(pathname: string): boolean {
  return UNGATED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Gate lives here rather than in DashboardShell because three different
 * wrappers (DashboardShell, AppSidebarLayout, and route-group layouts) all
 * funnel into AppShell. Gating any one of them leaves the others open — the
 * dashboard reached the app through AppSidebarLayout and skipped the gate
 * entirely when it was wired one level up.
 */
export default function AppShell(props: AppShellProps) {
  const pathname = usePathname() ?? '';

  if (isUngated(pathname)) return <AppShellInner {...props} />;

  return (
    <RequireSubscription>
      <AppShellInner {...props} />
    </RequireSubscription>
  );
}

function AppShellInner({ children, fullWidth = false }: AppShellProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const { accentColor } = useLayoutStore();
  const { t } = useI18nStore();

  const [mounted, setMounted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const counts = useUnreadCounts(mounted);

  // The cached user is persisted to localStorage and was only ever written at
  // sign-in, so anything the server changed since — subscribing, above all — did
  // not reach the browser until the next login. Re-read it once per page load.
  // Every screen that renders a trial badge or plan name depends on this.
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Preserved verbatim from AppSidebarLayout — this is the app's auth gate and
  // its behavior must not change (Rule 1).
  useEffect(() => {
    useLayoutStore.persist.rehydrate();
    useI18nStore.persist.rehydrate();
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace('/auth/login');
      return;
    }
    if (user && !user.email_verified) {
      router.replace('/auth/verify-email');
      return;
    }
    // /auth/onboarding is canonical — the old /onboarding route never
    // persisted to the API, so users sent there were never marked onboarded
    // server-side and looped back on the next login.
    if (user && !user.onboarding_completed) router.replace('/auth/onboarding');
  }, [user, router]);

  // User-chosen accent override from the theme customizer. This writes
  // directly onto <html>, which is global and outlives this component — the
  // cleanup here is what stops a signed-in member's chosen color from
  // silently carrying over onto the public login/landing pages after they
  // log out, which must always show the real brand orange, not whatever
  // color a previous session happened to leave behind.
  useEffect(() => {
    if (!accentColor) return;
    document.documentElement.style.setProperty('--accent', accentColor);
    document.documentElement.style.setProperty('--orange', accentColor); // legacy alias
    return () => {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--orange');
    };
  }, [accentColor]);

  // Close the More sheet on navigation so it never lingers over a new page.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* best-effort: log out locally regardless */
    }
    document.cookie = 'auth_token=; path=/; max-age=0';
    document.cookie = 'user_role=; path=/; max-age=0';
    logout();
    router.replace('/auth/login');
  };

  return (
    <div
      data-section={sectionForPath(pathname)}
      className="min-h-dvh bg-surface-base"
    >
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 z-30 bg-surface-raised border-r border-border-subtle">
        <div className="h-16 px-4 flex items-center border-b border-border-subtle shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <span className="h-9 w-9 rounded-sm bg-accent text-white font-display text-body flex items-center justify-center shrink-0">
              MX
            </span>
            <span className="font-display text-h3 text-content-primary truncate">
              My EXtreme Trainer
            </span>
          </Link>
        </div>

        {/* `no-scrollbar` hides the scrollbar chrome but keeps the element
            scrollable (wheel, trackpad, keyboard and touch all still work) —
            the sidebar is a fixed-height column whose nav can overflow. */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 flex flex-col gap-5">
          {/* Staff do not get the member's own food diary and workout log. */}
          <NavList items={navFor(SIDEBAR_MAIN, !!user?.is_admin)} pathname={pathname} counts={counts} />

          <div className="flex flex-col gap-1.5">
            <h2 className="text-overline font-semibold uppercase text-content-tertiary px-3">
              {t('settings.account')}
            </h2>
            <NavList items={navFor(SIDEBAR_ACCOUNT, !!user?.is_admin)} pathname={pathname} counts={counts} />
          </div>

          {user?.is_admin && (
            <div className="flex flex-col gap-1.5">
              <h2 className="text-overline font-semibold uppercase text-content-tertiary px-3">
                Admin
              </h2>
              <NavList items={SIDEBAR_ADMIN} pathname={pathname} counts={counts} />
            </div>
          )}
        </nav>

        <div className="border-t border-border-subtle p-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar src={user?.avatar_url} name={user?.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-medium text-content-primary truncate">
                {user?.name}
              </div>
              <div className="text-caption text-content-tertiary truncate">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="h-9 w-9 rounded-sm flex items-center justify-center text-content-tertiary hover:text-error hover:bg-error-surface transition-colors shrink-0"
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Desktop top bar (lg+) ── */}
      <header className="hidden lg:flex fixed top-0 right-0 left-64 h-16 z-20 items-center justify-end gap-1 px-6 bg-surface-base/95 backdrop-blur-sm border-b border-border-subtle">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
        >
          <Bell size={20} strokeWidth={1.75} />
          {counts.notifications > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center tabular">
              {counts.notifications > 99 ? '99+' : counts.notifications}
            </span>
          )}
        </Link>
        <ThemeToggle />
      </header>

      {/* ── Content ── */}
      <main
        className={cn(
          'lg:ml-64 lg:pt-16',
          // `h-dvh` is what makes `flex-1 min-h-0` mean anything to the two
          // chat-style pages (Messages, AI Trainer). Without a real height here
          // the column grew to fit its content, so their inner
          // `overflow-y-auto` panels never became scroll containers: the whole
          // window scrolled instead, dragging the conversation list off screen
          // whenever you scrolled the thread beside it.
          fullWidth
            ? 'flex flex-col h-dvh overflow-hidden'
            : 'max-w-5xl mx-auto w-full px-4 md:px-6 py-4 md:py-6',
          // MUST come after `py-*`. cn() is tailwind-merge, which treats a later
          // `py-4` as overriding an earlier `pb-*` and silently drops it — that
          // left every non-fullWidth page with 16px of bottom padding against a
          // 57px tab bar, so the last ~41px of content sat underneath it.
          // Clears the tab bar + FAB + home indicator on mobile.
          'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+1.5rem)] lg:pb-8'
        )}
      >
        {children}
      </main>

      {/* ── Mobile chrome ── */}
      <BottomTabBar counts={counts} onOpenMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <Fab />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        counts={counts}
        user={user ?? null}
        onLogout={handleLogout}
      />
      <PwaProvider />
    </div>
  );
}
