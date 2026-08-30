'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Celebration } from '@/lib/achievements';

/**
 * The full-month streak celebration (§4.5).
 *
 * The brief asks for this to be the most rewarding moment in the app, so it is
 * the one place that earns a bespoke treatment rather than another card with a
 * bigger badge in it. Three things carry it:
 *
 *   1. A canvas ring that draws itself once, one segment per completed week.
 *      Generative rather than hand-authored SVG, per the design guidance, and
 *      it encodes something true — the segment count IS the week count.
 *   2. Accent-on-dark, the only place in the app that inverts the surface, so
 *      it reads as a different kind of moment without inventing a new palette.
 *   3. Real numbers only. Days and weeks come from the API, which returns this
 *      object solely while the streak is genuinely live.
 *
 * It is deliberately not dismissible: it disappears on its own the day the
 * streak breaks, which is the honest behaviour.
 */
export function StreakCelebration({ celebration }: { celebration: Celebration }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 132;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const weeks = Math.max(1, celebration.weeks);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 12;
    const gap = 0.14;
    const segment = (Math.PI * 2) / weeks;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#F87404';

    let raf = 0;
    const start = performance.now();
    const duration = reduced ? 0 : 900;

    const draw = (progress: number) => {
      ctx.clearRect(0, 0, size, size);

      // Track
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 7;
      ctx.stroke();

      // One arc per completed week.
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = accent;

      for (let i = 0; i < weeks; i++) {
        const segStart = -Math.PI / 2 + i * segment + gap / 2;
        const segEnd = segStart + segment - gap;
        const reveal = Math.min(1, Math.max(0, progress * weeks - i));
        if (reveal <= 0) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, segStart, segStart + (segEnd - segStart) * reveal);
        ctx.stroke();
      }
    };

    if (duration === 0) {
      draw(1);
      return;
    }

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out so the last segment settles rather than snapping.
      draw(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [celebration.weeks]);

  const since = celebration.since
    ? new Date(celebration.since).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
    : null;

  return (
    <section
      aria-label="Month streak celebration"
      className="relative overflow-hidden rounded-md bg-[#12100E] text-white p-6 sm:p-8"
    >
      {/* Single soft accent bloom. One flourish, not a pile of them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: 'var(--accent)' }}
      />

      <div className="relative flex flex-col items-center text-center gap-4 sm:flex-row sm:text-left sm:gap-7">
        <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
          <canvas ref={canvasRef} style={{ width: 132, height: 132 }} aria-hidden />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[2.25rem] leading-none tabular-nums">{celebration.days}</span>
            <span className="text-caption uppercase tracking-widest text-white/55 mt-1">days</span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-caption uppercase tracking-widest text-[var(--accent)] font-semibold">
            A full month
          </p>
          <h2 className="font-display text-h1 mt-1 text-balance">
            {celebration.weeks} straight weeks.
          </h2>
          <p className="text-body-sm text-white/70 mt-2 text-pretty max-w-md">
            {since
              ? `You have shown up every single day since ${since}. Most people never string together one week — you have put together ${celebration.weeks}.`
              : `You have shown up every single day for ${celebration.days} days running.`}
          </p>
        </div>
      </div>
    </section>
  );
}
