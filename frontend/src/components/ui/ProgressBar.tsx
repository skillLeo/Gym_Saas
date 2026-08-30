interface ProgressBarProps {
  value: number;
  max: number;
  /** Any CSS color. Defaults to the section accent. */
  color?: string;
  height?: number;
  showLabel?: boolean;
  label?: string;
}

/**
 * Solid fill — the gradient was removed (§1.1). Guards against max <= 0 so a
 * zero goal renders 0% instead of NaN.
 */
export function ProgressBar({
  value,
  max,
  color = 'var(--accent)',
  height = 8,
  showLabel = false,
  label,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between text-caption text-content-secondary mb-1">
          <span>{label}</span>
          <span className="tabular">{pct}%</span>
        </div>
      )}
      <div
        className="w-full rounded-full bg-surface-sunken overflow-hidden"
        style={{ height }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
