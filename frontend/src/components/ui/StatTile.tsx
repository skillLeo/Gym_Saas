'use client';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Summary metric. Surfaces the number before the detail (§ "When it's a UI").
 * Digits are tabular so a row or grid of tiles stays aligned.
 *
 * `delta` is rendered with an arrow icon as well as color, because a change
 * must never be communicated by color alone.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  /** For metrics where down is good (weight loss, body fat). */
  lowerIsBetter = false,
  icon,
  sparkline,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  lowerIsBetter?: boolean;
  icon?: ReactNode;
  sparkline?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const hasDelta = delta !== undefined && delta !== null && !Number.isNaN(delta);
  const isFlat = hasDelta && delta === 0;
  const isUp = hasDelta && (delta as number) > 0;
  const isGood = hasDelta && (lowerIsBetter ? !isUp : isUp);

  const DeltaIcon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const deltaTone = isFlat
    ? 'text-content-tertiary'
    : isGood
      ? 'text-success'
      : 'text-error';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'bg-surface-raised border border-border-subtle rounded-md p-4 text-left w-full',
        onClick && 'hover:border-border-strong transition-colors cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-overline font-semibold uppercase text-content-tertiary">{label}</p>
        {icon && <span className="text-content-tertiary shrink-0">{icon}</span>}
      </div>

      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-h1 font-display text-content-primary tabular leading-none">
          {value}
        </span>
        {unit && <span className="text-body-sm text-content-secondary">{unit}</span>}
      </div>

      {hasDelta && (
        <div className={cn('mt-1.5 flex items-center gap-1 text-caption font-medium', deltaTone)}>
          <DeltaIcon size={12} strokeWidth={2} />
          <span className="tabular">
            {isUp ? '+' : ''}
            {delta}
          </span>
          {deltaLabel && <span className="text-content-tertiary font-normal">{deltaLabel}</span>}
        </div>
      )}

      {sparkline && <div className="mt-3 -mb-1">{sparkline}</div>}
    </Wrapper>
  );
}
