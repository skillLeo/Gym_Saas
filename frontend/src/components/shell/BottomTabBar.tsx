'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { useI18nStore } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { Menu } from 'lucide-react';
import { TAB_ITEMS, navFor, activeNavHref } from './nav-config';
import type { UnreadCounts } from './useUnreadCounts';

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center tabular">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Fixed bottom tab bar — the primary navigation on mobile (§2.1).
 *
 * Active state is carried by icon fill, label color AND font weight, never by
 * color alone. Each target is 56px tall, comfortably over the 44px minimum,
 * and the bar pads for the home indicator via env(safe-area-inset-bottom).
 */
export function BottomTabBar({
  counts,
  onOpenMore,
  moreOpen,
}: {
  counts: UnreadCounts;
  onOpenMore: () => void;
  moreOpen: boolean;
}) {
  // Staff do not get Food and Fitness tabs — those track a member's own body.
  const { user } = useAuthStore();
  const pathname = usePathname() ?? '';
  const { t } = useI18nStore();

  // Shared with the desktop sidebar so both agree on which single destination
  // is selected. A bare `startsWith` lit up every ancestor at once.
  const isActive = (href: string) => activeNavHref(pathname) === href;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-raised border-t border-border-subtle elev-2 pb-safe"
      aria-label="Main"
    >
      <div className="flex items-stretch">
        {navFor(TAB_ITEMS, !!user?.is_admin).map((item) => {
          const active = isActive(item.href) && !moreOpen;
          const badge = item.badge ? counts[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 h-14 min-w-0',
                'transition-colors duration-150',
                active ? 'text-accent' : 'text-content-tertiary'
              )}
            >
              <span className="relative">
                <Icon name={item.icon} size={24} strokeWidth={active ? 2.25 : 1.75} />
                <TabBadge count={badge} />
              </span>
              <span className={cn('text-[11px] leading-none', active ? 'font-bold' : 'font-medium')}>
                {item.labelKey ? t(item.labelKey) : item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMore}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 h-14 min-w-0',
            'transition-colors duration-150',
            moreOpen ? 'text-accent' : 'text-content-tertiary'
          )}
        >
          <span className="relative">
            <Menu size={24} strokeWidth={moreOpen ? 2.25 : 1.75} />
            <TabBadge count={counts.combined} />
          </span>
          <span className={cn('text-[11px] leading-none', moreOpen ? 'font-bold' : 'font-medium')}>
            {t('nav.tab.more')}
          </span>
        </button>
      </div>
    </nav>
  );
}
