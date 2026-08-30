'use client';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

interface ListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned value, e.g. a calorie count or a timestamp. */
  value?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Shows a chevron. Implied when onClick or href is set. */
  chevron?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * The workhorse row (§1.6). Used for food entries, workouts, members,
 * settings, notifications — anywhere a list of records appears, so density
 * and alignment are identical across the app.
 *
 * Minimum height is 56px, comfortably above the 44px touch target (§2.4).
 */
export function ListRow({
  leading,
  title,
  subtitle,
  value,
  trailing,
  onClick,
  href,
  chevron,
  className,
  disabled,
}: ListRowProps) {
  const interactive = Boolean(onClick || href);
  const showChevron = chevron ?? interactive;

  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-body font-medium text-content-primary truncate">{title}</div>
        {subtitle && (
          <div className="text-body-sm text-content-secondary truncate">{subtitle}</div>
        )}
      </div>
      {value && (
        <div className="shrink-0 text-body-sm font-semibold text-content-primary tabular">
          {value}
        </div>
      )}
      {trailing}
      {showChevron && (
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-content-tertiary" />
      )}
    </>
  );

  const classes = cn(
    'w-full flex items-center gap-3 px-4 min-h-14 py-2.5 text-left bg-surface-raised',
    interactive && !disabled && 'hover:bg-surface-sunken transition-colors cursor-pointer',
    disabled && 'opacity-50 pointer-events-none',
    className
  );

  if (href && !disabled) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }
  if (interactive) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

/** Groups rows into a single bordered surface with hairline dividers. */
export function ListGroup({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-1.5', className)}>
      {title && (
        <h2 className="text-overline font-semibold uppercase text-content-tertiary px-4">
          {title}
        </h2>
      )}
      <div className="bg-surface-raised border border-border-subtle rounded-md overflow-hidden divide-y divide-border-subtle">
        {children}
      </div>
    </section>
  );
}

interface SwipeAction {
  label: string;
  icon?: ReactNode;
  onAction: () => void;
  tone?: 'danger' | 'neutral';
}

/**
 * Swipe-to-action wrapper (§2.2). Used on food log entries, todos, shopping
 * items and notifications.
 *
 * Destructive actions must either confirm or provide undo — this component
 * only surfaces the action; the caller owns that decision.
 *
 * Keyboard and screen-reader users cannot swipe, so the action is also
 * rendered as a real button that is visually hidden until focused.
 */
export function SwipeableRow({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action: SwipeAction;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const THRESHOLD = 72;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Action revealed underneath the row */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end px-4 gap-2',
          action.tone === 'danger' ? 'bg-error text-white' : 'bg-surface-sunken text-content-primary'
        )}
        aria-hidden="true"
      >
        {action.icon}
        <span className="text-body-sm font-semibold">{action.label}</span>
      </div>

      <div
        className="relative bg-surface-raised touch-pan-y"
        style={{
          transform: `translateX(-${offset}px)`,
          transition: startX.current === null ? 'transform 200ms var(--ease-out-std)' : undefined,
        }}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (startX.current === null) return;
          const delta = startX.current - e.touches[0].clientX;
          if (delta > 0) setOffset(Math.min(delta, THRESHOLD + 24));
        }}
        onTouchEnd={() => {
          startX.current = null;
          if (offset > THRESHOLD) {
            action.onAction();
            setOffset(0);
          } else {
            setOffset(0);
          }
        }}
      >
        {children}
      </div>

      {/* Accessible equivalent of the swipe gesture */}
      <button
        type="button"
        onClick={action.onAction}
        className="sr-only focus:not-sr-only focus:absolute focus:inset-y-0 focus:right-0 focus:px-4 focus:bg-error focus:text-white focus:text-body-sm focus:font-semibold"
      >
        {action.label}
      </button>
    </div>
  );
}
