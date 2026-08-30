'use client';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { CircleCheck, TriangleAlert, CircleX, Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * ONE empty-state pattern for the whole app (§1.6): icon, one-line title, one
 * sentence, at most one action. Copy must be specific — "No workouts logged
 * yet", never "Nothing here!".
 */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: {
  icon?: IconName | (string & {});
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 gap-3',
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-surface-sunken flex items-center justify-center text-content-tertiary">
        <Icon name={icon} size="lg" />
      </div>
      <div className="flex flex-col gap-1 max-w-xs">
        <h3 className="text-h3 font-semibold text-content-primary">{title}</h3>
        {description && (
          <p className="text-body-sm text-content-secondary text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Same shape as EmptyState but for failures. Always offers a retry — a dead end
 * with no action is not an acceptable error state.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 gap-3',
        className
      )}
      role="alert"
    >
      <div className="h-12 w-12 rounded-full bg-error-surface flex items-center justify-center text-error">
        <TriangleAlert size={24} strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1 max-w-xs">
        <h3 className="text-h3 font-semibold text-content-primary">{title}</h3>
        <p className="text-body-sm text-content-secondary text-pretty">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * Inline status message. A semantic state is never communicated by color alone
 * (§1.2) — this always renders an icon plus text.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    success: { cls: 'bg-success-surface text-success border-success/25', I: CircleCheck },
    warning: { cls: 'bg-warning-surface text-warning border-warning/25', I: TriangleAlert },
    error:   { cls: 'bg-error-surface text-error border-error/25',       I: CircleX },
    info:    { cls: 'bg-info-surface text-info border-info/25',          I: Info },
  }[tone];
  const I = tones.I;

  return (
    <div
      className={cn('flex gap-2.5 rounded-md border p-3', tones.cls, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <I size={16} strokeWidth={2} className="shrink-0 mt-0.5" />
      <div className="flex flex-col gap-0.5 min-w-0">
        {title && <p className="text-body-sm font-semibold">{title}</p>}
        {children && <div className="text-body-sm text-content-secondary">{children}</div>}
      </div>
    </div>
  );
}
