'use client';
import { cn } from '@/lib/utils';
import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-white border rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 outline-none',
            error ? 'border-[#E63946] focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]'
                  : 'border-gray-200 focus:border-[#F87404] focus:ring-1 focus:ring-[#F87404]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#E63946]">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
