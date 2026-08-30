/**
 * Optimistic update helpers.
 *
 * The apply → confirm → rollback sequence is pulled out of the components so it
 * can actually be tested. It previously lived inline in the dashboard, where
 * the rollback branch only runs when the network fails and was therefore never
 * exercised.
 */

export interface OptimisticHandlers<T> {
  /** Current value, read at call time. */
  getCurrent: () => T;
  /** Show a value immediately. */
  setValue: (v: T) => void;
  /** The server call. Resolves with the authoritative value. */
  commit: () => Promise<T>;
  /** Called with the restored value when the server call fails. */
  onError?: (err: unknown, restored: T) => void;
}

/**
 * Applies `next` immediately, then reconciles with the server.
 *
 * On failure the ORIGINAL value captured before the update is restored — not a
 * recomputed inverse. Inverting (e.g. "subtract one") drifts if anything else
 * changed the value in between, which is exactly how optimistic counters end up
 * permanently wrong.
 */
export async function optimisticUpdate<T>(
  next: T,
  { getCurrent, setValue, commit, onError }: OptimisticHandlers<T>
): Promise<{ ok: boolean; value: T }> {
  const previous = getCurrent();
  setValue(next);
  try {
    const authoritative = await commit();
    setValue(authoritative);
    return { ok: true, value: authoritative };
  } catch (err) {
    setValue(previous); // visible rollback
    onError?.(err, previous);
    return { ok: false, value: previous };
  }
}

/** Clamps a counter change so it can never go below zero. */
export function nextCount(current: number, delta: number, min = 0): number {
  return Math.max(min, current + delta);
}
