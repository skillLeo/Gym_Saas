import { cn } from '@/lib/utils';

interface AvatarProps { src?: string | null; name?: string; size?: 'sm' | 'md' | 'lg' | 'xl' | number; className?: string; online?: boolean; [key: string]: unknown; }

export function Avatar({ src, name = '?', size = 'md', className }: AvatarProps) {
  const namedSizes: Record<string, string> = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-24 w-24 text-2xl' };
  const sizeClass = typeof size === 'number' ? '' : namedSizes[size];
  const sizeStyle = typeof size === 'number' ? { width: size, height: size, fontSize: size * 0.4 } : undefined;
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className={cn('rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#F87404] to-[#F97316]', sizeClass, className)} style={sizeStyle}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : <span className="text-white font-bold">{initial}</span>}
    </div>
  );
}
