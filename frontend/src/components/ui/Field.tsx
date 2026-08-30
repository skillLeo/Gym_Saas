'use client';
import { cn } from '@/lib/utils';
import { CircleAlert } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

/**
 * Label + control + hint + error, wired for accessibility. Every form in the
 * app uses this so error presentation is identical everywhere.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-body-sm font-medium text-content-secondary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {/* Field-level error with an icon — never a vague form-wide error count */}
      {error ? (
        <p className="flex items-center gap-1 text-caption text-error">
          <CircleAlert size={12} strokeWidth={2} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-content-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputBaseClass =
  'w-full h-11 px-3 rounded-sm bg-surface-raised border text-body text-content-primary ' +
  'placeholder:text-content-tertiary outline-none transition-colors duration-150 ' +
  'disabled:bg-surface-sunken disabled:text-content-tertiary disabled:cursor-not-allowed';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * Text input. Keeps the original `label`/`hint`/`error` props so existing
 * Phase 1–7 callers keep working unchanged.
 */
export const Input = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, label, hint, error, id, required, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            inputBaseClass,
            error
              ? 'border-error focus-visible:border-error'
              : 'border-border-strong focus-visible:border-accent',
            className
          )}
          {...props}
        />
      </Field>
    );
  }
);
Input.displayName = 'Input';

interface NumericFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'min' | 'max'> {
  label?: string;
  hint?: string;
  error?: string;
  value: string | number;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  /** Set false for integer-only fields (steps, reps, servings count). */
  allowDecimal?: boolean;
  /** Set true only where a negative value is genuinely meaningful. */
  allowNegative?: boolean;
  suffix?: string;
}

/**
 * THE numeric input for the entire app.
 *
 * Closes the negative-number bug class structurally instead of per-field. This
 * project has shipped that bug twice (recipe `fat`, fitness goal `target_value`)
 * because fixes were applied to the one field named in a report while identical
 * fields elsewhere were missed.
 *
 * Three guards, because the HTML `min` attribute alone does NOT stop a user
 * typing "-10" — it only flags the field invalid on submit:
 *   1. onKeyDown blocks the '-' and 'e' keys outright
 *   2. onChange regex-rejects anything that is not a well-formed number
 *   3. min/max are still emitted for native validation and mobile keypads
 *
 * Backend validation and DB column precision must agree with these bounds —
 * all three layers, every time (Rule 3).
 */
export const NumericField = forwardRef<HTMLInputElement, NumericFieldProps>(
  (
    { className, label, hint, error, value, onValueChange, min = 0, max,
      allowDecimal = true, allowNegative = false, suffix, id, required, ...props },
    ref
  ) => {
    const autoId = useId();
    const inputId = id || autoId;
    const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

    const pattern = allowNegative
      ? allowDecimal
        ? /^-?\d*\.?\d*$/
        : /^-?\d*$/
      : allowDecimal
        ? /^\d*\.?\d*$/
        : /^\d*$/;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 'e' would let a user type scientific notation into a number input
      if (e.key === 'e' || e.key === 'E') e.preventDefault();
      if (!allowNegative && (e.key === '-' || e.key === '−')) e.preventDefault();
      if (!allowDecimal && (e.key === '.' || e.key === ',')) e.preventDefault();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === '' || pattern.test(v)) onValueChange(v);
    };

    // Clamp on blur so a pasted out-of-range value cannot reach the API
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === '') return;
      const n = Number(v);
      if (Number.isNaN(n)) {
        onValueChange('');
        return;
      }
      if (min !== undefined && n < min) onValueChange(String(min));
      else if (max !== undefined && n > max) onValueChange(String(max));
      props.onBlur?.(e);
    };

    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="number"
            inputMode={allowDecimal ? 'decimal' : 'numeric'}
            value={value}
            min={min}
            max={max}
            required={required}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              inputBaseClass,
              'tabular',
              suffix && 'pr-12',
              error
                ? 'border-error focus-visible:border-error'
                : 'border-border-strong focus-visible:border-accent',
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-content-tertiary pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
      </Field>
    );
  }
);
NumericField.displayName = 'NumericField';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, required, rows = 4, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full px-3 py-2.5 rounded-sm bg-surface-raised border text-body text-content-primary',
            'placeholder:text-content-tertiary outline-none transition-colors duration-150 resize-y',
            error ? 'border-error focus-visible:border-error' : 'border-border-strong focus-visible:border-accent',
            className
          )}
          {...props}
        />
      </Field>
    );
  }
);
Textarea.displayName = 'Textarea';
