'use client';
import { cn } from '@/lib/utils';
import { Loader2, ArrowDown } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

/**
 * Pull-to-refresh (§2.2) for the dashboard, social feed, notifications,
 * messages and vibe thread.
 *
 * Only engages when the scroll container is already at the top, so it never
 * fights normal scrolling. Falls back silently on desktop, where there is no
 * touch gesture — those surfaces should still expose a refresh action in the
 * page header.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled,
}: {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const THRESHOLD = 64;
  const MAX = 96;

  const armed = pull >= THRESHOLD;

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    // Only arm the gesture when already scrolled to the very top
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    // Resistance curve so it feels physical rather than linear
    setPull(Math.min(MAX, delta * 0.5));
  };

  const onTouchEnd = async () => {
    startY.current = null;
    if (!armed) {
      setPull(0);
      return;
    }
    setRefreshing(true);
    setPull(THRESHOLD);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pull }}
        aria-hidden={pull === 0}
      >
        {refreshing ? (
          <Loader2 size={20} strokeWidth={2} className="animate-spin text-accent" />
        ) : (
          <ArrowDown
            size={20}
            strokeWidth={2}
            className={cn(
              'transition-transform duration-150',
              armed ? 'text-accent rotate-180' : 'text-content-tertiary'
            )}
          />
        )}
      </div>
      {children}
    </div>
  );
}
