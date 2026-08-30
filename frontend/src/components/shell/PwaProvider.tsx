'use client';
import { useEffect, useState } from 'react';
import { Share, Plus, X, Download } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'met-install-dismissed';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; the touch check distinguishes it
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's non-standard flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Registers the service worker and offers "Add to Home Screen" (§2.3).
 *
 * Android/Chrome fires `beforeinstallprompt`, which we capture and replay on a
 * user gesture. iOS has no such API at all, so it gets a short instructional
 * sheet instead — otherwise iPhone users, who are much of this audience, would
 * simply never be told the app can be installed.
 *
 * The prompt never reappears once dismissed.
 */
export function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Register the service worker (production only — in dev it caches stale
  // builds and makes every change look like it did not apply).
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* non-fatal: the app works fine without offline support */
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    if (isStandalone()) return; // already installed

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* storage blocked — treat as not dismissed */
    }
    if (dismissed) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    // iOS never fires the event, so surface the manual path after a delay —
    // long enough that it does not interrupt a first impression.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      timer = setTimeout(() => setShowBanner(true), 20_000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* non-fatal */
    }
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      dismiss();
      return;
    }
    setShowIosSheet(true);
  };

  if (!showBanner) return <IosSheet open={showIosSheet} onClose={() => setShowIosSheet(false)} />;

  return (
    <>
      <div
        className="lg:hidden fixed inset-x-3 z-30 rounded-md border border-border-subtle bg-surface-raised elev-2 p-3 flex items-center gap-3 animate-fade-in"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        role="dialog"
        aria-label="Install app"
      >
        <span className="h-10 w-10 rounded-sm bg-accent text-white font-display text-body-sm flex items-center justify-center shrink-0">
          MX
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-semibold text-content-primary">Add to home screen</p>
          <p className="text-caption text-content-secondary">Opens full screen, like an app.</p>
        </div>
        <Button size="sm" onClick={install} icon={<Download size={14} strokeWidth={2} />}>
          Add
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="h-9 w-9 -mr-1 shrink-0 rounded-sm flex items-center justify-center text-content-tertiary hover:bg-surface-sunken transition-colors"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <IosSheet open={showIosSheet} onClose={() => setShowIosSheet(false)} />
    </>
  );
}

function IosSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to home screen"
      description="iOS needs two taps in Safari."
    >
      <ol className="flex flex-col gap-3 py-1">
        <li className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-full bg-surface-sunken text-content-secondary flex items-center justify-center text-body-sm font-bold shrink-0">
            1
          </span>
          <span className="text-body text-content-primary flex items-center gap-1.5">
            Tap <Share size={16} strokeWidth={1.75} className="text-info" /> Share in the toolbar
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-full bg-surface-sunken text-content-secondary flex items-center justify-center text-body-sm font-bold shrink-0">
            2
          </span>
          <span className="text-body text-content-primary flex items-center gap-1.5">
            Choose <Plus size={16} strokeWidth={1.75} className="text-info" /> Add to Home Screen
          </span>
        </li>
      </ol>
    </Sheet>
  );
}
