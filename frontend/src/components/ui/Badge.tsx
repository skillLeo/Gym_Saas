import { cn } from '@/lib/utils';
import { CircleCheck, TriangleAlert, CircleX, Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | string;
  /** Pass `false` to suppress the automatic semantic icon. */
  icon?: ReactNode | false;
}

/**
 * Status/category marker. Only use where it carries real meaning (§1.1) —
 * never decoratively.
 *
 * Semantic variants (success/warning/error/info and their aliases) render a
 * Lucide icon alongside the label by default, because a state must never be
 * communicated by color alone (§1.2).
 */
export function Badge({ variant = 'info', children, className, size = 'sm', icon }: BadgeProps) {
  const variants: Record<string, string> = {
    // semantic
    success: 'bg-success-surface text-success border-success/25',
    warning: 'bg-warning-surface text-warning border-warning/25',
    error:   'bg-error-surface text-error border-error/25',
    info:    'bg-info-surface text-info border-info/25',
    // account-state aliases used across Phase 1–7 pages
    trial:   'bg-warning-surface text-warning border-warning/25',
    active:  'bg-success-surface text-success border-success/25',
    expired: 'bg-error-surface text-error border-error/25',
    // neutral
    neutral: 'bg-surface-sunken text-content-secondary border-border-subtle',
    // brand / palette aliases (decorative categories, not states)
    green:  'bg-success-surface text-success border-success/25',
    red:    'bg-error-surface text-error border-error/25',
    yellow: 'bg-warning-surface text-warning border-warning/25',
    blue:   'bg-info-surface text-info border-info/25',
    orange: 'bg-accent-surface text-accent border-accent/25',
    purple: 'bg-owner-accent/10 text-owner-accent border-owner-accent/25',
    pink:   'bg-cat-5/10 text-cat-5 border-cat-5/25',
  };

  const semanticIcons: Record<string, ReactNode> = {
    success: <CircleCheck size={12} strokeWidth={2} />,
    active:  <CircleCheck size={12} strokeWidth={2} />,
    warning: <TriangleAlert size={12} strokeWidth={2} />,
    trial:   <TriangleAlert size={12} strokeWidth={2} />,
    error:   <CircleX size={12} strokeWidth={2} />,
    expired: <CircleX size={12} strokeWidth={2} />,
    info:    <Info size={12} strokeWidth={2} />,
  };

  const resolvedIcon = icon === false ? null : (icon ?? semanticIcons[variant] ?? null);
  const sizes: Record<string, string> = {
    sm: 'text-overline px-2 py-0.5 gap-1',
    md: 'text-caption px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs border font-semibold whitespace-nowrap',
        variants[variant] ?? variants.neutral,
        sizes[size] ?? sizes.sm,
        className
      )}
    >
      {resolvedIcon}
      {children}
    </span>
  );
}
