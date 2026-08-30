import { cn } from '@/lib/utils';

/**
 * Shape-matched loading placeholders (§2.2). Never show a blank screen or a
 * bare centered spinner for content — a skeleton that matches the incoming
 * layout reads as progress and prevents layout shift when data lands.
 */
export function Skeleton({
  className,
  rounded = 'md',
  style,
}: {
  className?: string;
  rounded?: 'xs' | 'sm' | 'md' | 'full';
  style?: React.CSSProperties;
}) {
  const radii = {
    xs: 'rounded-xs',
    sm: 'rounded-sm',
    md: 'rounded-md',
    full: 'rounded-full',
  };
  return (
    <div
      className={cn('bg-surface-sunken animate-skeleton', radii[rounded], className)}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Paragraph placeholder. The last line is short, like real text. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          rounded="xs"
          className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Matches <ListRow>: leading avatar, title, subtitle. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <Skeleton rounded="full" className="h-10 w-10 shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton rounded="xs" className="h-3.5 w-1/3" />
        <Skeleton rounded="xs" className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Matches <Card>: border, padding, title + body. */
export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('bg-surface-raised border border-border-subtle rounded-md p-4', className)}>
      <Skeleton rounded="xs" className="h-4 w-1/3 mb-3" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Matches a chart block so the page does not jump when Recharts mounts. */
export function SkeletonChart({ className, height = 180 }: { className?: string; height?: number }) {
  return (
    <div className={cn('bg-surface-raised border border-border-subtle rounded-md p-4', className)}>
      <Skeleton rounded="xs" className="h-4 w-1/4 mb-4" />
      <Skeleton rounded="sm" className="w-full" style={{ height }} />
    </div>
  );
}

/** Matches <StatTile> in a grid. */
export function SkeletonStatTile({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface-raised border border-border-subtle rounded-md p-4', className)}>
      <Skeleton rounded="xs" className="h-2.5 w-1/2 mb-3" />
      <Skeleton rounded="xs" className="h-6 w-2/3" />
    </div>
  );
}
