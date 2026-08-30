'use client';

import { Icon } from '@/components/ui/Icon';
import { STREAK_LABELS, type EarnedBadge, type LockedBadge, type StreakSummary, type StreakType } from '@/lib/achievements';

/**
 * Tier colours. Deliberately metal-toned and distinct from the brand accent, so
 * a gold badge does not read as "selected" or compete with primary actions.
 */
const TIER: Record<string, { ring: string; bg: string; fg: string; label: string }> = {
  bronze:   { ring: 'ring-[#B87333]/40', bg: 'bg-[#B87333]/12', fg: 'text-[#C98A4B]', label: 'Bronze' },
  silver:   { ring: 'ring-[#9CA3AF]/40', bg: 'bg-[#9CA3AF]/12', fg: 'text-[#A8AEB8]', label: 'Silver' },
  gold:     { ring: 'ring-[#D4A017]/45', bg: 'bg-[#D4A017]/14', fg: 'text-[#E0AE28]', label: 'Gold' },
  platinum: { ring: 'ring-[#7DD3FC]/40', bg: 'bg-[#7DD3FC]/12', fg: 'text-[#8FD8FB]', label: 'Platinum' },
};

const tierOf = (t: string | null) => (t && TIER[t]) || TIER.bronze;

export function StreakRow({ streaks }: { streaks: Record<StreakType, StreakSummary> }) {
  // `overall` is the aggregate that drives featuring; the three activities are
  // what a member can actually act on, so only those are listed.
  const rows: StreakType[] = ['workout', 'meal_log', 'engagement'];

  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((type) => {
        const s = streaks?.[type];
        const current = s?.live ? s.current : 0;

        return (
          <div key={type} className="rounded-md border border-border bg-surface-raised p-3 text-center">
            <p className="font-display text-h2 text-content-primary tabular-nums leading-none">{current}</p>
            <p className="text-caption text-content-tertiary mt-1">
              {current === 1 ? 'day' : 'days'}
            </p>
            <p className="text-caption text-content-secondary mt-2 leading-tight">{STREAK_LABELS[type]}</p>
            {/* Personal best only when it beats the live streak — otherwise it
                is the same number twice, which reads as noise. */}
            {s && s.longest > current && (
              <p className="text-caption text-content-tertiary mt-1">best {s.longest}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BadgeGrid({
  earned,
  locked,
}: {
  earned: EarnedBadge[];
  locked?: LockedBadge[];
}) {
  if (earned.length === 0 && (!locked || locked.length === 0)) return null;

  return (
    <div className="space-y-5">
      {earned.length > 0 && (
        <div>
          <h3 className="text-body-sm font-semibold text-content-primary mb-3">
            Earned <span className="text-content-tertiary font-normal">({earned.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {earned.map((b) => {
              const t = tierOf(b.tier);
              return (
                <div key={`${b.key}-${b.period_start ?? ''}`}
                  className={`rounded-md border border-border bg-surface-raised p-3.5 ring-1 ${t.ring}`}>
                  <div className={`h-10 w-10 rounded-full ${t.bg} ${t.fg} flex items-center justify-center`}>
                    <Icon name={b.icon_name} size={20} aria-hidden />
                  </div>
                  <p className="font-semibold text-body-sm text-content-primary mt-2.5 leading-tight">{b.name}</p>
                  {b.tier && <p className={`text-caption ${t.fg} mt-0.5`}>{t.label}</p>}
                  {b.awarded_at && (
                    <p className="text-caption text-content-tertiary mt-1.5">
                      {new Date(b.awarded_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {locked && locked.length > 0 && (
        <div>
          <h3 className="text-body-sm font-semibold text-content-primary mb-3">
            Still to earn <span className="text-content-tertiary font-normal">({locked.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {locked.map((b) => (
              <div key={b.key} className="rounded-md border border-border-subtle bg-surface-sunken p-3.5">
                <div className="h-10 w-10 rounded-full bg-surface-raised text-content-tertiary flex items-center justify-center">
                  <Icon name={b.icon_name} size={20} aria-hidden />
                </div>
                <p className="font-semibold text-body-sm text-content-secondary mt-2.5 leading-tight">{b.name}</p>
                {/* The real requirement from the badge definition — never an
                    invented "you are 60% there". */}
                {b.target_days && b.activity && (
                  <p className="text-caption text-content-tertiary mt-1.5">
                    {b.target_days} days of {STREAK_LABELS[b.activity]?.toLowerCase() ?? b.activity}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
