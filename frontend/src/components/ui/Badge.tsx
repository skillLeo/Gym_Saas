import { cn } from '@/lib/utils';

interface BadgeProps { variant?: string; children: React.ReactNode; className?: string; size?: string; }

export function Badge({ variant = 'info', children, className }: BadgeProps) {
  const variants: Record<string, string> = {
    trial:   'bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30',
    active:  'bg-[#3FB950]/20 text-[#3FB950] border border-[#3FB950]/30',
    expired: 'bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/30',
    success: 'bg-[#3FB950]/20 text-[#3FB950] border border-[#3FB950]/30',
    warning: 'bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30',
    info:    'bg-[#F87404]/20 text-[#F87404] border border-[#F87404]/30',
    green:   'bg-[#3FB950]/20 text-[#3FB950] border border-[#3FB950]/30',
    blue:    'bg-[#F87404]/20 text-[#F87404] border border-[#F87404]/30',
    red:     'bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/30',
    yellow:  'bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30',
    purple:  'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    orange:  'bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}
