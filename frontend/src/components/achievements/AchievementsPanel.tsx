'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BadgeGrid, StreakRow } from './BadgeGrid';
import { StreakCelebration } from './StreakCelebration';
import { fetchMyAchievements, type Achievements } from '@/lib/achievements';

/**
 * Streaks, badges and the month celebration, for the member's own profile.
 *
 * Fails quiet: achievements are an enhancement, so a failed request hides the
 * panel rather than pushing an error into the middle of someone's profile.
 */
export function AchievementsPanel() {
  const [data, setData] = useState<Achievements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMyAchievements()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* enhancement only — stay silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-content-tertiary" aria-label="Loading achievements" />
      </div>
    );
  }

  if (!data) return null;

  const hasAnything =
    data.celebration !== null ||
    data.badges.length > 0 ||
    Object.values(data.streaks ?? {}).some((s) => s.live && s.current > 0) ||
    (data.locked?.length ?? 0) > 0;

  if (!hasAnything) return null;

  return (
    <div className="space-y-5">
      {data.celebration && <StreakCelebration celebration={data.celebration} />}

      <div>
        <h3 className="text-sm font-semibold text-content-primary mb-3">Current streaks</h3>
        <StreakRow streaks={data.streaks} />
      </div>

      <BadgeGrid earned={data.badges} locked={data.locked} />
    </div>
  );
}
