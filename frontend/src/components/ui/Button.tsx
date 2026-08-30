'use client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

/**
 * Solid fills only — the gradient primary was removed (§1.1).
 *
 * Primary uses the *section accent*, so a button inside [data-section="fitness"]
 * is red and inside social is orange, with no per-page overrides.
 *
 * md/lg meet the 44px minimum touch target (§2.4). `sm` is 36px and is reserved
 * for dense desktop toolbars — never use it for a primary mobile action.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', loading, children, disabled,
      icon, iconRight, fullWidth, type = 'button', ...props },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-sm gap-2 ' +
      'transition-colors duration-150 ease-out select-none ' +
      'disabled:opacity-45 disabled:cursor-not-allowed';

    const variants: Record<string, string> = {
      primary:   'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover',
      secondary: 'bg-surface-sunken text-content-primary border border-border-subtle hover:border-border-strong',
      danger:    'bg-error text-white hover:opacity-90 active:opacity-85',
      warning:   'bg-warning text-white hover:opacity-90 active:opacity-85',
      ghost:     'text-content-secondary hover:text-content-primary hover:bg-surface-sunken',
      outline:   'border border-accent text-accent bg-transparent hover:bg-accent-surface',
    };

    const sizes: Record<string, string> = {
      sm: 'text-body-sm px-3 h-9',
      md: 'text-body px-4 h-11',
      lg: 'text-body-lg px-6 h-12',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : icon}
        {children}
        {!loading && iconRight}
      </button>
    );
  }
);
Button.displayName = 'Button';
