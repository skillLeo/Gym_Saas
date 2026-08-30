import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  /** Renders a presence dot. Previously accepted but ignored — now honored. */
  online?: boolean;
  [key: string]: unknown;
}

/**
 * Solid accent fill for the initial state — the gradient was removed (§1.1).
 */
export function Avatar({ src, name = '?', size = 'md', className, online }: AvatarProps) {
  const namedSizes: Record<string, string> = {
    xs: 'h-6 w-6 text-overline',
    sm: 'h-8 w-8 text-caption',
    md: 'h-10 w-10 text-body-sm',
    lg: 'h-14 w-14 text-body-lg',
    xl: 'h-24 w-24 text-h1',
  };
  const dotSizes: Record<string, string> = {
    xs: 'h-1.5 w-1.5', sm: 'h-2 w-2', md: 'h-2.5 w-2.5', lg: 'h-3 w-3', xl: 'h-4 w-4',
  };

  const isNum = typeof size === 'number';
  const sizeClass = isNum ? '' : namedSizes[size as string];
  const sizeStyle = isNum ? { width: size, height: size, fontSize: (size as number) * 0.4 } : undefined;
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();

  return (
    <div className={cn('relative flex-shrink-0 inline-flex', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center overflow-hidden bg-accent',
          sizeClass
        )}
        style={sizeStyle}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-white font-bold leading-none">{initial}</span>
        )}
      </div>
      {online && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-surface-raised',
            isNum ? 'h-2.5 w-2.5' : dotSizes[size as string]
          )}
          aria-label="Online"
        />
      )}
    </div>
  );
}
