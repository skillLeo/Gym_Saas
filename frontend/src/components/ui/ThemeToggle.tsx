'use client';

import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cn(
        'flex items-center justify-center h-11 w-11 rounded-sm transition-colors duration-150',
        'text-content-secondary hover:text-content-primary hover:bg-surface-sunken',
        className
      )}
    >
      {theme === 'dark' ? (
        <Sun size={20} strokeWidth={1.75} />
      ) : (
        <Moon size={20} strokeWidth={1.75} />
      )}
    </button>
  );
}
