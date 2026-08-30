'use client';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Scroll thresholds for the collapse, deliberately far apart.
 *
 * Collapsing removes roughly 30px of header height, so the two values are kept
 * well outside that range in both directions — see the note in the effect
 * below. Measured at 375px: document height moved 1061 -> 1028 on collapse.
 */
const COLLAPSE_BELOW = 72;
const EXPAND_ABOVE = 16;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Shows a back affordance. `true` uses router.back(), or pass a href. */
  back?: boolean | string;
  /** At most two icon actions (§2.1). */
  actions?: ReactNode;
  className?: string;
  /** Shrinks the title into a compact bar on scroll instead of holding height. */
  collapseOnScroll?: boolean;
}

/**
 * ONE page header pattern for the whole app (§1.6): title, optional back,
 * at most two icon actions. Sticky, and collapses on scroll so it does not
 * permanently eat vertical space on a phone (§2.1).
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
  collapseOnScroll = true,
}: PageHeaderProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!collapseOnScroll) return;

    let frame = 0;

    const sync = () => {
      frame = 0;
      const y = window.scrollY;
      setCollapsed((current) => {
        // Hysteresis: separate thresholds for collapsing and expanding.
        //
        // Collapsing shrinks this header by ~30px (smaller padding, smaller
        // title, subtitle removed). The header is sticky, so it is still in
        // normal flow and the document gets shorter — which pushes scrollY
        // back down. With a single threshold that lands the page on the other
        // side of it, so the header expands, grows, crosses the threshold
        // again, and oscillates. It reads as the title blinking, and the page
        // visibly scrolls on its own.
        //
        // The dead zone between the two values must be wider than the height
        // the toggle removes, so a collapse can never undo itself.
        if (current) return y > EXPAND_ABOVE;
        return y > COLLAPSE_BELOW;
      });
    };

    const onScroll = () => {
      // One state read per frame. Without this, the 200ms size transition
      // changes layout continuously and fires scroll events throughout it.
      if (frame) return;
      frame = requestAnimationFrame(sync);
    };

    sync(); // Match the position the page was restored or deep-linked at.
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [collapseOnScroll]);

  const goBack = () => {
    if (typeof back === 'string') router.push(back);
    else router.back();
  };

  return (
    <header
      className={cn(
        // `lg:top-16` parks this below AppShell's fixed 64px top bar. Sticking
        // at 0 put both bars in the same band once the page scrolled, and at
        // z-30 this one won — so a page's own actions were drawn over the
        // notification bell and theme toggle. `z-10` keeps the app chrome on
        // top if they ever meet again.
        'sticky top-0 lg:top-16 z-10 bg-surface-base/95 backdrop-blur-sm',
        'border-b transition-colors duration-200',
        collapsed ? 'border-border-subtle' : 'border-transparent',
        // Break out of the shell's horizontal padding so the bar — and its
        // bottom border — span the full width instead of being inset. Every
        // consumer sits inside AppShell's `px-4 md:px-6` main, or a page
        // container with the same padding, so this is uniform.
        '-mx-4 md:-mx-6',
        'pt-safe',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-4 transition-[padding] duration-200',
          collapsed ? 'py-2' : 'py-3'
        )}
      >
        {back && (
          <button
            onClick={goBack}
            aria-label="Go back"
            className="h-11 w-11 -ml-2.5 shrink-0 rounded-sm flex items-center justify-center text-content-primary hover:bg-surface-sunken transition-colors"
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1
            className={cn(
              'font-display text-content-primary truncate transition-[font-size] duration-200',
              collapsed ? 'text-h3' : 'text-h1'
            )}
          >
            {title}
          </h1>
          {subtitle && !collapsed && (
            <p className="text-body-sm text-content-secondary truncate">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/** Icon-only action for the header. Keeps the 44px target without visual bulk. */
export function HeaderAction({
  label,
  onClick,
  children,
  badge,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center tabular">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
