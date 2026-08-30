import { cn } from '@/lib/utils';
import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Rare. Only for surfaces that genuinely float (§1.4). */
  elevated?: boolean;
}

/**
 * The default surface: flat, separated by a hairline border, radius-md.
 * No shadow — elevation is reserved for things that actually float.
 * The previous version had no dark-mode styling at all (`bg-white` /
 * `border-gray-200`), which is why cards went white in dark mode.
 */
export function Card({ className, padding = 'md', elevated, children, ...props }: CardProps) {
  const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' };
  return (
    <div
      className={cn(
        'bg-surface-raised border border-border-subtle rounded-md',
        elevated && 'elev-1',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-h3 font-semibold text-content-primary', className)} {...props}>
      {children}
    </h3>
  );
}

/** Uppercase eyebrow above a group. Use for section labels, not card titles. */
export function CardEyebrow({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-overline font-semibold uppercase text-content-tertiary', className)}
      {...props}
    >
      {children}
    </p>
  );
}
