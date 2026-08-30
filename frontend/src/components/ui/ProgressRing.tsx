'use client';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface ProgressRingProps {
  value: number;
  maxValue?: number;
  text?: string;
  subText?: string;
  pathColor?: string;
  trailColor?: string;
  /** Retained for API compatibility with Phase 1–7 callers. */
  textColor?: string;
}

export function ProgressRing({
  value,
  maxValue = 100,
  text,
  subText,
  pathColor = 'var(--accent)',
  trailColor = 'var(--surface-sunken)',
}: ProgressRingProps) {
  const pct = maxValue > 0 ? Math.max(0, Math.min(100, (value / maxValue) * 100)) : 0;
  return (
    <div className="relative">
      <CircularProgressbar
        value={pct}
        styles={buildStyles({
          pathColor,
          trailColor,
          pathTransitionDuration: 0.5,
          strokeLinecap: 'round',
        })}
      />
      {(text || subText) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
          {text && (
            <span className="text-h2 font-bold text-content-primary leading-none tabular">
              {text}
            </span>
          )}
          {subText && <span className="text-caption text-content-secondary mt-1">{subText}</span>}
        </div>
      )}
    </div>
  );
}
