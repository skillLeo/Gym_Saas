'use client';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Sticky footer, typically the primary action. */
  footer?: ReactNode;
  className?: string;
  /** Hide the default close button when the content provides its own. */
  hideClose?: boolean;
}

/**
 * Bottom sheet — the DEFAULT overlay on mobile (§2.2). Anything triggered from
 * the lower half of the screen uses this, not a centered modal.
 *
 * Includes drag-to-dismiss, Esc, scrim click, focus trap, scroll lock, and
 * safe-area padding so the footer clears the home indicator.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  hideClose,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  // Esc to dismiss
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open, and restore the exact previous value
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Move focus into the sheet so keyboard and screen-reader users land inside it
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Reset any residual drag offset between openings
  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  // Trap Tab within the panel
  const onKeyDownTrap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDownTrap}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        className={cn(
          'relative z-10 w-full sm:max-w-lg bg-surface-raised elev-2 outline-none',
          'rounded-t-xl sm:rounded-lg',
          'max-h-[92dvh] flex flex-col',
          'border-t border-border-subtle sm:border',
          !dragY && 'animate-sheet-in',
          className
        )}
      >
        {/* Drag handle — also the touch target for drag-to-dismiss */}
        <div
          className="pt-2 pb-1 flex justify-center shrink-0 touch-none sm:hidden"
          onTouchStart={(e) => {
            startY.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (startY.current === null) return;
            const delta = e.touches[0].clientY - startY.current;
            if (delta > 0) setDragY(delta);
          }}
          onTouchEnd={() => {
            if (dragY > 100) onClose();
            else setDragY(0);
            startY.current = null;
          }}
        >
          <div className="h-1 w-9 rounded-full bg-border-strong" />
        </div>

        {(title || !hideClose) && (
          <div className="flex items-start gap-3 px-4 pb-3 pt-1 sm:pt-4 shrink-0">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-h2 font-display text-content-primary truncate">{title}</h2>
              )}
              {description && (
                <p className="text-body-sm text-content-secondary mt-0.5">{description}</p>
              )}
            </div>
            {!hideClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="h-9 w-9 -mr-1 -mt-1 shrink-0 rounded-sm flex items-center justify-center text-content-secondary hover:bg-surface-sunken transition-colors"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}

        <div className="px-4 pb-4 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-4 pt-3 pb-4 border-t border-border-subtle shrink-0 pb-safe">
            {footer}
          </div>
        )}
        {!footer && <div className="pb-safe shrink-0" />}
      </div>
    </div>
  );
}

/**
 * Centered dialog on desktop; automatically becomes a bottom Sheet on mobile,
 * so callers never have to branch on viewport.
 */
export function Modal(props: SheetProps) {
  return <Sheet {...props} />;
}
