import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

/**
 * Prefer <Skeleton /> for content that is loading — a shape-matched skeleton
 * reads as progress, a bare spinner reads as a stall (§2.2). Reserve this for
 * indeterminate inline waits (a button, a small poll).
 */
export function LoadingSpinner({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const px = { sm: 16, md: 28, lg: 40 }[size];
  return (
    <Loader2
      size={px}
      strokeWidth={2}
      className={cn('animate-spin text-accent', className)}
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
