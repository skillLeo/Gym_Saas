'use client';

interface MacroBarProps {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

export function MacroBar({ label, current, goal, color, unit = 'g' }: MacroBarProps) {
  const pct = goal > 0 ? Math.max(0, Math.min(100, Math.round((current / goal) * 100))) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-caption text-content-secondary font-medium">{label}</span>
        <span className="text-caption font-semibold text-content-primary tabular">
          {Math.round(current)}
          <span className="text-content-tertiary font-normal">
            /{goal}
            {unit}
          </span>
        </span>
      </div>
      <div
        className="h-1.5 bg-surface-sunken rounded-full overflow-hidden"
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
