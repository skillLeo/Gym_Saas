'use client';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Field } from './Field';
import { Sheet } from './Sheet';

export interface Option<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Select. On mobile it opens a Sheet rather than a native dropdown, so the
 * option list is legible and thumb-reachable (§2.2). On desktop (sm and up) it
 * falls back to a native <select>, which is faster for mouse + keyboard.
 */
export function Select<T extends string = string>({
  label,
  hint,
  error,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  required,
  disabled,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  value: T | '';
  onChange: (v: T) => void;
  options: Option<T>[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const triggerClass = cn(
    'w-full h-11 px-3 rounded-sm bg-surface-raised border text-body text-left',
    'flex items-center justify-between gap-2 transition-colors duration-150',
    'disabled:bg-surface-sunken disabled:text-content-tertiary disabled:cursor-not-allowed',
    error ? 'border-error' : 'border-border-strong',
    className
  );

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      {/* Mobile: sheet picker */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-invalid={error ? true : undefined}
        className={cn(triggerClass, 'sm:hidden')}
      >
        <span className={cn('truncate', !selected && 'text-content-tertiary')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={18} strokeWidth={1.75} className="shrink-0 text-content-tertiary" />
      </button>

      {/* Desktop: native select */}
      <div className="relative hidden sm:block">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
          aria-invalid={error ? true : undefined}
          className={cn(triggerClass, 'appearance-none pr-9')}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-content-tertiary"
        />
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? 'Select'}>
        <ul role="listbox" className="flex flex-col -mx-4">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                disabled={o.disabled}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 min-h-12 py-2.5 text-left hover:bg-surface-sunken transition-colors disabled:opacity-45"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-body text-content-primary">{o.label}</div>
                  {o.description && (
                    <div className="text-body-sm text-content-secondary">{o.description}</div>
                  )}
                </div>
                {o.value === value && (
                  <Check size={18} strokeWidth={2} className="shrink-0 text-accent" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </Field>
  );
}

/**
 * Segmented control — for 2–4 mutually exclusive options that should all stay
 * visible (day/week/month, metric/imperial). Beyond 4 options use a Select.
 */
export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex w-full p-0.5 rounded-sm bg-surface-sunken border border-border-subtle',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-xs font-medium transition-colors duration-150 disabled:opacity-45',
              size === 'sm' ? 'h-8 text-body-sm px-2' : 'h-10 text-body px-3',
              active
                ? 'bg-surface-raised text-content-primary elev-1'
                : 'text-content-secondary hover:text-content-primary'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle. The hit area is 44px tall even though the track is smaller (§2.4). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-center justify-between gap-3 min-h-11', className)}>
      {(label || description) && (
        <label htmlFor={id} className="flex-1 min-w-0 cursor-pointer">
          {label && <div className="text-body text-content-primary">{label}</div>}
          {description && (
            <div className="text-body-sm text-content-secondary">{description}</div>
          )}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 h-6 w-11 rounded-full transition-colors duration-150',
          'disabled:opacity-45 disabled:cursor-not-allowed',
          checked ? 'bg-accent' : 'bg-border-strong'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}

/** Filter/category chip. Only for real filters — never decorative (§1.1). */
export function Chip({
  active,
  onClick,
  children,
  className,
  icon,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-xs whitespace-nowrap',
        'text-body-sm font-medium border transition-colors duration-150',
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-surface-raised text-content-secondary border-border-subtle hover:border-border-strong',
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Underline tabs. Scrolls horizontally when the set overflows. */
export function Tabs<T extends string = string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 overflow-x-auto no-scrollbar border-b border-border-subtle',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative shrink-0 px-3 h-11 text-body font-medium transition-colors duration-150',
              'disabled:opacity-45',
              active ? 'text-accent' : 'text-content-secondary hover:text-content-primary'
            )}
          >
            {o.label}
            {active && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
