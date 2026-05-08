'use client';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface ProgressRingProps {
  value: number; maxValue?: number; text?: string; subText?: string;
  pathColor?: string; trailColor?: string; textColor?: string;
}

export function ProgressRing({ value, maxValue = 100, text, subText, pathColor = '#F87404', trailColor = '#F3F4F6', textColor = '#111827' }: ProgressRingProps) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="relative">
      <CircularProgressbar
        value={pct}
        styles={buildStyles({
          pathColor,
          trailColor,
          pathTransitionDuration: 0.8,
          strokeLinecap: 'round',
        })}
      />
      {(text || subText) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {text && <span className="text-xl font-bold text-gray-900 leading-none">{text}</span>}
          {subText && <span className="text-xs text-gray-500 mt-1">{subText}</span>}
        </div>
      )}
    </div>
  );
}
