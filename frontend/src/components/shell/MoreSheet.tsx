'use client';
import { useRouter, usePathname } from 'next/navigation';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Controls';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18nStore } from '@/store/i18nStore';
import { LogOut, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MORE_GROUPS, navFor, activeNavHref } from './nav-config';
import type { UnreadCounts } from './useUnreadCounts';

/**
 * Everything not on the five tabs (§2.1), grouped under overline labels.
 * Admin rows are filtered out entirely for non-admins — this is a convenience
 * filter only; the API enforces admin access server-side.
 */
export function MoreSheet({
  open,
  onClose,
  counts,
  user,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  counts: UnreadCounts;
  user: { name?: string; email?: string; avatar_url?: string | null; is_admin?: boolean } | null;
  onLogout: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { theme, setTheme } = useTheme();
  const { t } = useI18nStore();

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('nav.tab.more')} hideClose>
      {user && (
        <button
          type="button"
          onClick={() => go('/profile')}
          className="w-full flex items-center gap-3 p-3 mb-3 rounded-md bg-surface-sunken text-left hover:bg-border-subtle transition-colors"
        >
          <Avatar src={user.avatar_url} name={user.name} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-body font-semibold text-content-primary truncate">
              {user.name}
            </div>
            <div className="text-body-sm text-content-secondary truncate">{user.email}</div>
          </div>
          <ChevronRight size={18} strokeWidth={1.75} className="text-content-tertiary shrink-0" />
        </button>
      )}

      <div className="flex flex-col gap-5">
        {MORE_GROUPS.map((group) => {
          // navFor handles BOTH directions now: adminOnly hides from members,
          // memberOnly hides from staff.
          const items = navFor(group.items, !!user?.is_admin);
          if (items.length === 0) return null;

          return (
            <section key={group.title} className="flex flex-col gap-1.5">
              <h3 className="text-overline font-semibold uppercase text-content-tertiary px-1">
                {t(group.titleKey)}
              </h3>
              <div className="rounded-md border border-border-subtle overflow-hidden divide-y divide-border-subtle">
                {items.map((item) => {
                  const active = activeNavHref(pathname) === item.href;
                  const badge = item.badge ? counts[item.badge] : 0;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => go(item.href)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 min-h-12 text-left',
                        'bg-surface-raised hover:bg-surface-sunken transition-colors'
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size="md"
                        className={active ? 'text-accent' : 'text-content-tertiary'}
                      />
                      <span
                        className={cn(
                          'flex-1 text-body',
                          active ? 'text-accent font-semibold' : 'text-content-primary'
                        )}
                      >
                        {item.labelKey ? t(item.labelKey) : item.label}
                      </span>
                      {badge > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center tabular">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      <ChevronRight
                        size={16}
                        strokeWidth={1.75}
                        className="text-content-tertiary shrink-0"
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* The theme toggle used to live in the mobile top bar, which this
            shell removes in favour of a per-screen PageHeader. It lives here
            so mobile users do not lose access to it. */}
        <div className="rounded-md border border-border-subtle bg-surface-raised px-3">
          <Switch
            checked={theme === 'dark'}
            onChange={(on) => setTheme(on ? 'dark' : 'light')}
            label="Dark mode"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="w-full flex items-center gap-3 px-3 min-h-12 rounded-md border border-border-subtle bg-surface-raised text-error hover:bg-error-surface transition-colors"
        >
          <LogOut size={20} strokeWidth={1.75} />
          <span className="text-body font-medium">Log out</span>
        </button>
      </div>
    </Sheet>
  );
}
