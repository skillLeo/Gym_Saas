'use client';
import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, icon, iconRight, fullWidth, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed gap-2';

    const variants = {
      primary: 'bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white hover:from-[#e06000] hover:to-[#F87404] focus:ring-[#F87404]',
      secondary: 'bg-gray-100 text-gray-900 border border-gray-200 hover:bg-gray-200 focus:ring-gray-300',
      danger: 'bg-[#E63946] text-white hover:bg-[#c62d39] focus:ring-[#E63946]',
      warning: 'bg-[#F97316] text-white hover:bg-[#e06210] focus:ring-[#F97316]',
      ghost: 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-300',
      outline: 'border border-[#F87404] text-[#F87404] hover:bg-[#F87404] hover:text-white focus:ring-[#F87404]',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5',
      md: 'text-sm px-4 py-2.5',
      lg: 'text-base px-6 py-3',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon}
        {children}
        {!loading && iconRight}
      </button>
    );
  }
);
Button.displayName = 'Button';
