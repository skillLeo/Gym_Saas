import api from './api';

export type StreakType = 'workout' | 'meal_log' | 'engagement' | 'overall';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | null;

export interface StreakSummary {
  current: number;
  longest: number;
  live: boolean;
  since: string | null;
}

export interface EarnedBadge {
  key: string;
  name: string;
  description: string | null;
  icon_name: string;
  tier: BadgeTier;
  awarded_at: string | null;
  period_start: string | null;
  period_end: string | null;
  meta: Record<string, unknown> | null;
}

export interface LockedBadge {
  key: string;
  name: string;
  description: string | null;
  icon_name: string;
  tier: BadgeTier;
  target_days: number | null;
  activity: StreakType | null;
}

/** Present only while a month-long streak is genuinely live. */
export interface Celebration {
  type: 'month_streak';
  days: number;
  weeks: number;
  since: string | null;
}

export interface Achievements {
  streaks: Record<StreakType, StreakSummary>;
  badges: EarnedBadge[];
  badge_count: number;
  celebration: Celebration | null;
  locked?: LockedBadge[];
}

export interface FeedFeature {
  id: number;
  feature_type: 'week_streak' | 'month_streak';
  days: number;
  period_start: string;
  period_end: string;
  user: { id: number | null; name: string | null; username: string | null; avatar: string | null };
}

export const STREAK_LABELS: Record<StreakType, string> = {
  workout: 'Training',
  meal_log: 'Food logging',
  engagement: 'Community',
  overall: 'Any activity',
};

export async function fetchMyAchievements(): Promise<Achievements> {
  const { data } = await api.get('/streaks/me');
  return data.data;
}

export async function fetchMemberAchievements(userId: number): Promise<Achievements> {
  const { data } = await api.get(`/streaks/user/${userId}`);
  return data.data;
}

export async function fetchFeedFeatures(): Promise<FeedFeature[]> {
  const { data } = await api.get('/streaks/feed-features');
  return data.data ?? [];
}

export async function dismissFeature(id: number): Promise<void> {
  await api.post(`/streaks/feed-features/${id}/dismiss`);
}
