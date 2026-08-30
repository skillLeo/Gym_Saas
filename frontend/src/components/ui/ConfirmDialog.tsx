'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

/**
 * App-styled replacement for window.confirm() and window.prompt().
 *
 * The native dialogs put "localhost:3000 says" above the message, ignore the
 * theme entirely, cannot show a destructive action in red, and look like the
 * page has broken. Built from the existing design tokens instead, so it
 * inherits brand colour and dark mode for free and needs no new dependency.
 *
 * Both helpers return a promise, so call sites read almost the same as before:
 *
 *   if (!(await confirm({ title: 'Delete this?', destructive: true }))) return;
 *   const reason = await prompt({ title: 'Why?' });   // null when cancelled
 */

interface BaseOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in red, for deletes and revocations. */
  destructive?: boolean;
}

interface PromptOptions extends BaseOptions {
  placeholder?: string;
  defaultValue?: string;
  /** When true the confirm button stays disabled until something is typed. */
  required?: boolean;
  multiline?: boolean;
}

type DialogState =
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & BaseOptions)
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOptions);

interface DialogApi {
  confirm: (opts: BaseOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useConfirm(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmDialogProvider>');
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const confirm = useCallback(
    (opts: BaseOptions) =>
      new Promise<boolean>((resolve) => {
        setValue('');
        setState({ kind: 'confirm', resolve, ...opts });
      }),
    [],
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? '');
        setState({ kind: 'prompt', resolve, ...opts });
      }),
    [],
  );

  const close = useCallback((confirmed: boolean) => {
    setState((s) => {
      if (!s) return null;
      // Cancelling a prompt resolves null — distinct from an empty answer, so a
      // caller can tell "no reason given" from "changed my mind".
      if (s.kind === 'prompt') s.resolve(confirmed ? value : null);
      else s.resolve(confirmed);
      return null;
    });
  }, [value]);

  // Escape cancels; focus moves into the dialog so Enter and Tab behave.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
    };
    document.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    // Stop the page behind from scrolling while the dialog is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
    };
  }, [state, close]);

  const blocked = state?.kind === 'prompt' && state.required && !value.trim();

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {state && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          {/* Labelled distinctly from the Cancel button so screen readers (and
              tests) do not see two controls with the same name. */}
          <button
            aria-label="Dismiss dialog"
            onClick={() => close(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
          />

          <div className="relative z-10 w-full sm:max-w-md bg-surface-raised border border-border-subtle rounded-t-3xl sm:rounded-md shadow-lg animate-[sheet-in_.18s_ease-out] sm:animate-[fade-in_.15s_ease-out]">
            <div className="flex items-start gap-3 p-5 pb-3">
              {state.destructive && (
                <span className="h-10 w-10 shrink-0 rounded-full bg-error-surface text-error flex items-center justify-center">
                  <AlertTriangle size={20} strokeWidth={2} aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id="confirm-dialog-title" className="font-display text-h3 text-content-primary">
                  {state.title}
                </h2>
                {state.message && (
                  <p className="text-body-sm text-content-secondary mt-1 whitespace-pre-line">{state.message}</p>
                )}
              </div>
              <button
                onClick={() => close(false)}
                aria-label="Close"
                className="h-8 w-8 shrink-0 rounded-sm flex items-center justify-center text-content-tertiary hover:text-content-primary hover:bg-surface-sunken transition-colors"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {state.kind === 'prompt' && (
              <div className="px-5 pb-1">
                {state.multiline ? (
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={state.placeholder}
                    rows={3}
                    className="w-full bg-surface-sunken border border-border-strong rounded-md px-3.5 py-2.5 text-body-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors resize-none"
                  />
                ) : (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !blocked) close(true); }}
                    placeholder={state.placeholder}
                    className="w-full h-11 bg-surface-sunken border border-border-strong rounded-md px-3.5 text-body-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
                  />
                )}
              </div>
            )}

            <div className="flex gap-3 p-5 pt-4">
              <Button variant="ghost" fullWidth onClick={() => close(false)}>
                {state.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={state.destructive ? 'danger' : 'primary'}
                fullWidth
                disabled={blocked}
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </DialogContext.Provider>
  );
}
