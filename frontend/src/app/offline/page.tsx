'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Offline fallback served by the service worker when a navigation fails and
 * nothing is cached (§2.3).
 *
 * Must be fully self-contained — no API calls, no auth store, no data. It has
 * to render when the network is gone.
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <main className="min-h-dvh bg-surface-base flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <div className="h-14 w-14 rounded-full bg-surface-sunken flex items-center justify-center text-content-tertiary">
          <WifiOff size={26} strokeWidth={1.75} />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1 font-display text-content-primary">You&rsquo;re offline</h1>
          <p className="text-body text-content-secondary text-pretty">
            {online
              ? 'That page has not been opened on this device yet, so there is nothing saved to show.'
              : 'Check your connection. Anything you already opened is still available.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-sm bg-accent text-white text-body font-semibold active:bg-accent-hover transition-colors"
        >
          <RefreshCw size={16} strokeWidth={2} />
          Try again
        </button>

        {online && (
          <p className="text-caption text-content-tertiary">
            Your connection is back — retrying should work now.
          </p>
        )}
      </div>
    </main>
  );
}
