'use client';
import { useState, useEffect } from 'react';
import { formatDate, formatNumber } from '@/lib/format';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Utensils, Plus, Dumbbell, Droplets, ChevronRight, Shield,
  CalendarDays, Heart, MessageCircle, Minus,
} from 'lucide-react';

import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { MacroBar } from '@/components/ui/MacroBar';
import { StatTile } from '@/components/ui/StatTile';
import { ListRow } from '@/components/ui/ListRow';
import { EmptyState } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCard, SkeletonRow, Skeleton } from '@/components/ui/Skeleton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { optimisticUpdate, nextCount } from '@/lib/optimistic';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';

const SECTION_TILES: { href: string; icon: IconName; labelKey: string; tint: string }[] = [
  { href: '/fitness',      icon: 'dumbbell',      labelKey: 'nav.fitness',   tint: 'var(--brand-red)' },
  { href: '/food-journal', icon: 'utensils',      labelKey: 'nav.tab.food',  tint: 'var(--brand-orange)' },
  { href: '/recipes',      icon: 'book-open',     labelKey: 'nav.recipes',   tint: 'var(--brand-yellow)' },
  { href: '/calendar',     icon: 'calendar-days', labelKey: 'nav.calendar', tint: 'var(--brand-blue-deep)' },
];

interface CalendarPreviewEvent { id: number; title: string; type: string; time: string | null }
interface SocialPreviewPost {
  id: number; content: string; created_at: string;
  user: { name: string; avatar_url: string };
  total_reactions: number; comment_count: number;
}
interface DashboardData {
  nutrition: {
    calories_consumed: number; calorie_goal: number;
    protein_g: number; goal_protein: number;
    carbs_g: number; goal_carbs: number;
    fat_g: number; goal_fat: number;
  };
  water: { glasses_today: number; goal: number; ounces_today: number; goal_ounces: number };
  fitness_today: { workouts_logged: number; calories_burned: number };
  recent_food_entries: Array<{ id: number; name: string; meal_type: string; calories: number | string }>;
}

const DEFAULT_DATA: DashboardData = {
  nutrition: { calories_consumed: 0, calorie_goal: 2000, protein_g: 0, goal_protein: 150, carbs_g: 0, goal_carbs: 200, fat_g: 0, goal_fat: 65 },
  water: { glasses_today: 0, goal: 8, ounces_today: 0, goal_ounces: 64 },
  fitness_today: { workouts_logged: 0, calories_burned: 0 },
  recent_food_entries: [],
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [data, setData] = useState<DashboardData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [waterLoading, setWaterLoading] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<CalendarPreviewEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [socialPosts, setSocialPosts] = useState<SocialPreviewPost[]>([]);
  const [socialLoading, setSocialLoading] = useState(true);

  useEffect(() => {
    // Depends on `locale`, not just the (stable) `t` reference: this page's
    // effects run before AppShell's rehydration effect (children fire before
    // parents), so on first mount `t()` may still reflect the pre-hydration
    // default. Re-running once `locale` settles corrects it instead of
    // freezing the wrong-language greeting for the rest of the session.
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? t('dashboard.greeting.morning') : hour < 18 ? t('dashboard.greeting.afternoon') : t('dashboard.greeting.evening'));
    // Locale-aware: date-fns without a locale renders English month and day
    // names whatever language the member has chosen.
    setDateStr(formatDate(new Date(), locale, { weekday: 'long', day: 'numeric', month: 'long' }));
  }, [t, locale]);

  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    // An administrator has no personal food log, workout history or calendar.
    // These calls are refused by the 'member' middleware, so firing them would
    // put three 403s in the console on every load and light up error toasts for
    // data that is meaningless on a staff account.
    if (isAdmin) { setLoading(false); setCalendarLoading(false); setSocialLoading(false); return; }

    api.get('/dashboard')
      .then((res) => setData(res.data.data))
      .catch(() => toast.error(t('dashboard.error.load')))
      .finally(() => setLoading(false));
  }, [t, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    api.get('/calendar/events', { params: { month: format(new Date(), 'yyyy-MM') } })
      .then((res) => {
        const all = res.data.events ?? [];
        setCalendarEvents(
          all.filter((e: { date: string }) => String(e.date).slice(0, 10) === today).slice(0, 4)
        );
      })
      .catch(() => { /* a preview panel must never surface an error */ })
      .finally(() => setCalendarLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    api.get('/social/feed', { params: { tab: 'following', page: 1, per_page: 3 } })
      .then((res) => setSocialPosts(res.data.data?.data ?? []))
      .catch(() => { /* preview only */ })
      .finally(() => setSocialLoading(false));
  }, []);

  const n = data.nutrition;
  const calPct = n.calorie_goal ? Math.min(100, Math.round((n.calories_consumed / n.calorie_goal) * 100)) : 0;
  const remaining = Math.max(0, n.calorie_goal - n.calories_consumed);
  const waterGlasses = data.water.glasses_today;
  const waterGoal = data.water.goal ?? 8;
  const waterMet = waterGlasses >= waterGoal;
  const waterOunces = data.water.ounces_today;
  const waterGoalOunces = data.water.goal_ounces ?? waterGoal * 8;

  /**
   * Optimistic water update — the count moves immediately, then reconciles.
   * The apply/confirm/rollback sequence lives in lib/optimistic so the failure
   * branch is unit-testable instead of only running when the network dies.
   */
  const changeWater = async (dir: 'increment' | 'decrement') => {
    if (dir === 'decrement' && waterGlasses <= 0) return;
    setWaterLoading(true);
    const setGlasses = (v: number) =>
      setData((d) => ({ ...d, water: { ...d.water, glasses_today: v, ounces_today: v * 8 } }));

    await optimisticUpdate(nextCount(waterGlasses, dir === 'increment' ? 1 : -1), {
      getCurrent: () => waterGlasses,
      setValue: setGlasses,
      commit: async () => {
        const res = await api.post(`/water-log/${dir}`);
        setData((d) => ({ ...d, water: { ...d.water, ounces_today: res.data.data.total_ounces } }));
        return res.data.data.glasses_count as number;
      },
      onError: () => toast.error(t('dashboard.error.water')),
    });

    setWaterLoading(false);
  };

  return (
    <>
      <PageHeader
        title={greeting || t('nav.dashboard')}
        subtitle={dateStr}
        actions={
          user?.is_on_trial ? (
            <Badge variant="trial">{t('dashboard.trial.daysLeft', { days: user.trial_days_remaining })}</Badge>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-5 pt-1">
        {/* An administrator has no personal nutrition, workouts or calendar, so
            the member dashboard below is replaced with somewhere useful to go.
            The shortcut tiles underneath link to member-only pages that would
            bounce a staff account straight back here. */}
        {isAdmin ? (
          <Card>
            <div className="p-6 text-center">
              <p className="font-semibold text-content-primary mb-1">You are signed in as an administrator</p>
              <p className="text-body-sm text-content-secondary mb-5">
                Food, fitness and billing are member features — this account does not have them.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/admin" className="px-4 py-2.5 rounded-md bg-accent text-white text-body-sm font-semibold hover:bg-accent-hover transition-colors">
                  Open the admin panel
                </Link>
                <Link href="/admin/revenue" className="px-4 py-2.5 rounded-md border border-border-strong text-body-sm font-semibold text-content-secondary hover:text-content-primary transition-colors">
                  Revenue
                </Link>
                <Link href="/admin/users" className="px-4 py-2.5 rounded-md border border-border-strong text-body-sm font-semibold text-content-secondary hover:text-content-primary transition-colors">
                  Members
                </Link>
              </div>
            </div>
          </Card>
        ) : (
        <>
        {/* ── Section shortcuts ── */}
        <nav className="grid grid-cols-4 gap-2.5" aria-label={t('dashboard.sections.aria')}>
          {SECTION_TILES.map(({ href, icon, labelKey, tint }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface-raised py-3.5 hover:border-border-strong transition-colors"
            >
              <span
                className="h-10 w-10 rounded-sm flex items-center justify-center"
                style={{ backgroundColor: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}
              >
                <Icon name={icon} size="md" />
              </span>
              <span className="text-caption font-medium text-content-secondary">{t(labelKey)}</span>
            </Link>
          ))}
        </nav>

        {/* ── Nutrition ── */}
        {loading ? (
          <SkeletonCard lines={4} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.nutrition.title')}</CardTitle>
              <Link
                href="/food-journal"
                className="inline-flex items-center gap-0.5 text-body-sm font-medium text-accent hover:text-accent-hover"
              >
                {t('dashboard.foodlog')} <ChevronRight size={14} strokeWidth={2} />
              </Link>
            </CardHeader>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="w-36 h-36 shrink-0">
                <ProgressRing
                  value={n.calories_consumed}
                  maxValue={n.calorie_goal}
                  text={formatNumber(Math.round(n.calories_consumed), locale)}
                  subText={t('dashboard.nutrition.kcalEaten')}
                  pathColor={calPct >= 100 ? 'var(--brand-red)' : 'var(--accent)'}
                />
              </div>
              <div className="flex-1 w-full flex flex-col gap-3.5">
                <div className="flex justify-between text-body-sm">
                  <span className="text-content-secondary">
                    {t('dashboard.nutrition.goal')}{' '}
                    <strong className="text-content-primary tabular">
                      {formatNumber(n.calorie_goal, locale)}
                    </strong>
                  </span>
                  <span className="text-content-secondary">
                    {t('dashboard.nutrition.left')}{' '}
                    <strong className="text-success tabular">
                      {formatNumber(Math.round(remaining), locale)}
                    </strong>
                  </span>
                </div>
                <MacroBar label={t('dashboard.macro.protein')} current={n.protein_g} goal={n.goal_protein} color="var(--cat-2)" />
                <MacroBar label={t('dashboard.macro.carbs')} current={n.carbs_g} goal={n.goal_carbs} color="var(--cat-1)" />
                <MacroBar label={t('dashboard.macro.fat')} current={n.fat_g} goal={n.goal_fat} color="var(--cat-3)" />
              </div>
            </div>
          </Card>
        )}

        {/* ── Water ── */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.water.title')}</CardTitle>
            {waterMet && (
              <Badge variant="success">{t('dashboard.water.goalReached')}</Badge>
            )}
          </CardHeader>

          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-display font-display text-content-primary leading-none tabular">
              {waterGlasses}
            </span>
            <span className="text-body text-content-tertiary tabular">/ {waterGoal} {t('dashboard.water.glassesUnit')}</span>
          </div>
          <div className="text-caption text-content-tertiary tabular mb-3">
            {waterOunces} / {waterGoalOunces} oz
          </div>

          <div className="flex gap-1.5 mb-4" role="img" aria-label={t('dashboard.water.ariaCount', { current: waterGlasses, goal: waterGoal })}>
            {Array.from({ length: waterGoal }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-8 rounded-xs flex items-center justify-center transition-colors ${
                  i < waterGlasses ? 'bg-accent' : 'bg-surface-sunken border border-border-subtle'
                }`}
              >
                <Droplets
                  size={13}
                  strokeWidth={2}
                  className={i < waterGlasses ? 'text-white' : 'text-content-tertiary'}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => changeWater('decrement')}
              disabled={waterGlasses <= 0 || waterLoading}
              aria-label={t('dashboard.water.removeGlass')}
              className="w-14"
            >
              <Minus size={16} strokeWidth={2.5} />
            </Button>
            <Button
              onClick={() => changeWater('increment')}
              disabled={waterLoading}
              fullWidth
              icon={<Droplets size={16} strokeWidth={2} />}
            >
              {t('dashboard.water.addGlass')}
            </Button>
          </div>
        </Card>

        {/* ── Today's numbers ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label={t('dashboard.stat.workouts')}
            value={data.fitness_today.workouts_logged}
            icon={<Dumbbell size={16} strokeWidth={1.75} />}
          />
          <StatTile
            label={t('dashboard.stat.burned')}
            value={formatNumber(Math.round(data.fitness_today.calories_burned), locale)}
            unit={t('dashboard.unit.kcal')}
          />
        </div>

        {/* ── Food log ── */}
        <Card padding="none">
          <div className="p-4 pb-2">
            <CardHeader className="mb-0">
              <CardTitle>{t('dashboard.foodlog')}</CardTitle>
              <Link href="/food-journal">
                <Button variant="secondary" size="sm" icon={<Plus size={14} strokeWidth={2.5} />}>
                  {t('dashboard.action.add')}
                </Button>
              </Link>
            </CardHeader>
          </div>

          {loading ? (
            <div className="px-4 pb-2 divide-y divide-border-subtle">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : data.recent_food_entries.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {data.recent_food_entries.map((entry) => (
                <ListRow
                  key={entry.id}
                  leading={
                    <span className="h-9 w-9 rounded-sm bg-accent-surface text-accent flex items-center justify-center">
                      <Utensils size={16} strokeWidth={1.75} />
                    </span>
                  }
                  title={entry.name}
                  subtitle={<span className="capitalize">{entry.meal_type}</span>}
                  value={`${Math.round(Number(entry.calories))} ${t('dashboard.unit.kcal')}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="utensils"
              title={t('dashboard.food.emptyTitle')}
              description={t('dashboard.food.emptyDesc')}
              action={
                <Link href="/food-journal">
                  <Button size="sm">{t('dashboard.food.emptyAction')}</Button>
                </Link>
              }
            />
          )}
        </Card>

        {/* ── Calendar ── */}
        <Card padding="none">
          <div className="p-4 pb-2">
            <CardHeader className="mb-0">
              <CardTitle>{t('dashboard.calendar.title')}</CardTitle>
              <Link
                href="/calendar"
                className="inline-flex items-center gap-0.5 text-body-sm font-medium text-accent hover:text-accent-hover"
              >
                {t('dashboard.action.view')} <ChevronRight size={14} strokeWidth={2} />
              </Link>
            </CardHeader>
          </div>

          {calendarLoading ? (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <Skeleton rounded="xs" className="h-3.5 w-1/2" />
              <Skeleton rounded="xs" className="h-3.5 w-1/3" />
            </div>
          ) : calendarEvents.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {calendarEvents.map((ev) => (
                <ListRow
                  key={ev.id}
                  leading={
                    <span className="h-9 w-9 rounded-sm bg-info-surface text-info flex items-center justify-center">
                      <CalendarDays size={16} strokeWidth={1.75} />
                    </span>
                  }
                  title={ev.title}
                  subtitle={ev.time ?? undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="calendar-days"
              title={t('dashboard.calendar.emptyTitle')}
              description={t('dashboard.calendar.emptyDesc')}
            />
          )}
        </Card>

        {/* ── Feed ── */}
        <Card padding="none">
          <div className="p-4 pb-2">
            <CardHeader className="mb-0">
              <CardTitle>{t('dashboard.feed.title')}</CardTitle>
              <Link
                href="/social"
                className="inline-flex items-center gap-0.5 text-body-sm font-medium text-accent hover:text-accent-hover"
              >
                {t('dashboard.action.view')} <ChevronRight size={14} strokeWidth={2} />
              </Link>
            </CardHeader>
          </div>

          {socialLoading ? (
            <div className="px-4 pb-2 divide-y divide-border-subtle">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : socialPosts.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {socialPosts.map((post) => (
                <article key={post.id} className="flex gap-3 px-4 py-3">
                  <Avatar src={post.user.avatar_url} name={post.user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold text-content-primary">{post.user.name}</p>
                    <p className="text-body-sm text-content-secondary line-clamp-2 mt-0.5">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-caption text-content-tertiary tabular">
                      <span className="flex items-center gap-1">
                        <Heart size={12} strokeWidth={2} /> {post.total_reactions}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} strokeWidth={2} /> {post.comment_count}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="users"
              title={t('dashboard.feed.emptyTitle')}
              description={t('dashboard.feed.emptyDesc')}
              action={
                <Link href="/social/explore">
                  <Button size="sm">{t('dashboard.feed.emptyAction')}</Button>
                </Link>
              }
            />
          )}
        </Card>

        {/* ── Trial ── */}
        {user?.is_on_trial && (
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.trial.title')}</CardTitle>
              <Badge variant="trial">{t('dashboard.trial.daysLeft', { days: user.trial_days_remaining })}</Badge>
            </CardHeader>
            <p className="text-body-sm text-content-secondary mb-3">
              {t('dashboard.trial.desc')}
            </p>
            <Link href="/membership">
              <Button fullWidth>{t('dashboard.trial.cta')}</Button>
            </Link>
          </Card>
        )}

        {/* ── Admin ── */}
        {user?.is_admin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield size={16} strokeWidth={1.75} className="text-info" />
                <CardTitle>{t('dashboard.admin.title')}</CardTitle>
              </div>
            </CardHeader>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { href: '/admin', icon: 'chart-bar' as IconName, labelKey: 'dashboard.admin.panel' },
                { href: '/admin/users', icon: 'users' as IconName, labelKey: 'dashboard.admin.users' },
                { href: '/admin/stats', icon: 'chart-line' as IconName, labelKey: 'dashboard.admin.stats' },
              ].map(({ href, icon, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1.5 rounded-md border border-border-subtle py-3 hover:border-border-strong transition-colors"
                >
                  <Icon name={icon} size="md" className="text-content-secondary" />
                  <span className="text-caption font-medium text-content-secondary">{t(labelKey)}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="h-2" />
        </>
        )}
      </div>
    </>
  );
}
