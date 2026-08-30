'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { useI18nStore } from '@/store/i18nStore';
import { fabForPath, QUICK_ACTIONS } from './nav-config';

/**
 * Contextual primary action (§2.1). Anchored bottom-right, clear of the tab
 * bar and the home indicator.
 *
 * Sections with one obvious action navigate straight there; the dashboard —
 * where several actions are equally likely — opens a quick-action sheet.
 * Hidden entirely on sections with no primary action, rather than showing a
 * button that does something arbitrary.
 */
export function Fab() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { t } = useI18nStore();

  const config = fabForPath(pathname);
  if (!config) return null;

  const onClick = () => {
    if (config.sheet) setSheetOpen(true);
    else if (config.href) router.push(config.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={t(config.labelKey)}
        className="lg:hidden fixed right-4 z-40 h-14 w-14 rounded-full bg-accent text-white elev-2 flex items-center justify-center active:bg-accent-hover transition-colors"
        // Sits above the 56px tab bar plus the home indicator inset
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <Plus size={26} strokeWidth={2.25} />
      </button>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('fab.quickLog')}
        description={t('fab.quickLogDesc')}
      >
        <div className="grid grid-cols-2 gap-3 py-1">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.href}
              type="button"
              onClick={() => {
                setSheetOpen(false);
                router.push(a.href);
              }}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-md border border-border-subtle bg-surface-raised hover:bg-surface-sunken transition-colors"
            >
              <span className="h-11 w-11 rounded-full bg-accent-surface text-accent flex items-center justify-center">
                <Icon name={a.icon} size="lg" />
              </span>
              <span className="text-body-sm font-medium text-content-primary">{t(a.labelKey)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
