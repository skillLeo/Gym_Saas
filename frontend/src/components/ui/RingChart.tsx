'use client';

interface RingChartProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export function RingChart({
  value,
  max,
  size = 100,
  strokeWidth = 10,
  color = 'var(--accent)',
  label,
  sublabel,
}: RingChartProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const offset = circ * (1 - pct);
  const center = size / 2;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'Progress'}: ${Math.round(pct * 100)}%`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 500ms var(--ease-out-std)' }}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {label && (
            <span className="text-body-sm font-bold text-content-primary leading-tight tabular">
              {label}
            </span>
          )}
          {sublabel && <span className="text-overline text-content-tertiary">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
