'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatRelative } from '@/lib/format';
import { useI18nStore } from '@/store/i18nStore';
import type { Locale } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import { SkeletonRow } from '@/components/ui/Skeleton';
import api from '@/lib/api';
import {
  Heart, MessageCircle, UserPlus, Bell, BellOff, Trophy, Settings, Check, Trash2, Shield, Pin, Radio,
  BookOpen, XCircle, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const typeIcon: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  message: MessageCircle,
  direct_message: MessageCircle,
  achievement: Trophy,
  live_session: Radio,
  vibe_thread: MessagesSquare,
  // Recipe review outcomes. A type with no entry here falls through to a plain
  // grey bell, which reads as a system message rather than a decision about
  // something the member submitted.
  recipe_approved: BookOpen,
  recipe_rejected: XCircle,
  group_approved: Shield,
  group_rejected: XCircle,
  system: Bell
};

const typeColor: Record<string, string> = {
  like: '#FF0404',
  comment: '#004AAD',
  follow: '#10B981',
  message: '#F87404',
  direct_message: '#F87404',
  achievement: '#FFC000',
  live_session: '#FF0404',
  vibe_thread: '#0000FF',
  recipe_approved: '#10B981',
  recipe_rejected: '#B91C1C',
  group_approved: '#10B981',
  group_rejected: '#B91C1C',
  system: '#7C3AED'
};

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  /** Actor is a member this person pinned (§5.7). Styling only. */
  is_pinned_actor?: boolean;
  /** Actor is platform staff — always accented, for every member (§5.7). */
  is_owner_actor?: boolean;
};

/** A section of the page, as the server groups it. */
type Category = {
  key: string;
  label: string;
  muted: boolean;
  total: number;
  unread_count: number;
  notifications: Notif[];
};

/**
 * Relative time, in the member's language.
 *
 * This was hand-rolled English (`3d ago`), which cannot translate at all:
 * the wording, the abbreviation and the plural rules all differ per language.
 * Intl.RelativeTimeFormat knows them — see formatRelative in lib/format.
 */
const timeAgo = (iso: string, locale: Locale): string => formatRelative(iso, locale);

export default function NotificationsPage() {
  const { locale, t } = useI18nStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [muting, setMuting] = useState<string | null>(null);

  // Set once the API says this account is not entitled. Stops the poll, and
  // stops the toast: an inactive account already has a full-screen explanation
  // over the top of this page, so an error saying the list failed to load is
  // both wrong and repeated every cycle. The client watched three of them stack
  // up on the blocking screen.
  const [blocked, setBlocked] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications);
      setCategories(res.data.categories ?? []);
    } catch (err: any) {
      const status = err?.response?.status;
      // 401 unauthenticated, 402 not entitled, 403 forbidden — all of which the
      // app explains elsewhere. Anything else is a genuine failure worth saying.
      if (status === 401 || status === 402 || status === 403) {
        setBlocked(true);
      } else {
        toast.error(t('notifications.error.load'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  /**
   * Keep the list live.
   *
   * The page fetched once on mount and never again, so a member watching this
   * screen while someone commented or messaged them saw nothing at all until
   * they reloaded by hand — which reads as "notifications are broken". The bell
   * badge in the shell already polls; the list it points at did not.
   *
   * Polls on a slow interval, skips while the tab is hidden so a backgrounded
   * PWA is not sitting on the API, and refreshes immediately on return so
   * coming back to the tab shows current state rather than a stale list.
   */
  useEffect(() => {
    if (blocked) return;

    const refresh = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };

    const timer = setInterval(refresh, 20000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [fetchNotifications, blocked]);

  /**
   * Open what the notification is about.
   *
   * Every notification is stored with a `link` — /social, /vibe-thread, the
   * conversation it belongs to — and nothing ever used it. The row showed a
   * pointer cursor and only marked itself read, so clicking a message alert
   * did not take the member to the message. Marking read stays optimistic, so
   * navigation is not held up by the request.
   */
  const openNotification = (notif: Notif) => {
    if (!notif.read_at) markRead(notif.id);
    if (notif.link) router.push(notif.link);
  };

  const markRead = async (id: number) => {
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
    setCategories(prev => prev.map(c => ({
      ...c,
      notifications: c.notifications.map(n => n.id === id ? { ...n, read_at: n.read_at ?? now } : n),
      unread_count: c.notifications.filter(n => n.id !== id && !n.read_at).length,
    })));
    try { await api.post(`/notifications/${id}/read`); } catch { /* silent */ }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    try {
      setCategories(prev => prev.map(c => ({
        ...c,
        notifications: c.notifications.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
        unread_count: 0,
      })));
      await api.post('/notifications/mark-all-read');
    } catch {
      toast.error(t('notifications.error.markAll'));
    }
  };

  /**
   * Silence one category without touching the others.
   *
   * A muted category is never written server-side, so this genuinely stops the
   * notifications rather than hiding a number.
   */
  const toggleMute = async (category: Category) => {
    const next = !category.muted;
    setMuting(category.key);
    setCategories(prev => prev.map(c => c.key === category.key ? { ...c, muted: next } : c));
    try {
      const res = await api.put('/notifications/preferences', { category: category.key, muted: next });
      toast.success(res.data.message);
    } catch {
      setCategories(prev => prev.map(c => c.key === category.key ? { ...c, muted: !next } : c));
      toast.error(t('notifications.error.setting'));
    } finally {
      setMuting(null);
    }
  };

  const remove = async (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setCategories(prev => prev.map(c => ({
      ...c,
      notifications: c.notifications.filter(n => n.id !== id),
      total: c.notifications.filter(n => n.id !== id).length,
      unread_count: c.notifications.filter(n => n.id !== id && !n.read_at).length,
    })));
    try { await api.delete(`/notifications/${id}`); } catch { /* silent */ }
  };

  const unread = notifications.filter(n => !n.read_at).length;

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <PageHeader
          title={t('notifications.title')}
          subtitle={unread > 0 ? t('notifications.unread', { count: unread }) : undefined}
          actions={
            <>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="h-11 px-2.5 rounded-sm flex items-center gap-1.5 text-body-sm font-medium text-accent hover:bg-surface-sunken transition-colors"
                >
                  <Check size={15} strokeWidth={2} /> {t('notifications.markAllRead')}
                </button>
              )}
              <Link
                href="/profile/settings"
                aria-label={t('notifications.settings')}
                className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
              >
                <Settings size={20} strokeWidth={1.75} />
              </Link>
            </>
          }
        />

        {loading ? (
          <div className="flex flex-col divide-y divide-border-subtle">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : (
          <div className="space-y-6">
            {/* One labelled section per category. The page was a single list of
                every type mixed together, so somebody looking for "did anyone
                reply to me" had to read past follows, streaks and platform
                announcements.

                Sections that hold nothing are moved to a compact strip at the
                bottom rather than printed full size in place: a new member has
                four or five empty headings each saying "Nothing here yet", which
                reads as a broken page rather than an empty one. Their mute
                buttons stay reachable down there. */}
            {categories.filter(c => c.notifications.length > 0).map(category => (
              <section key={category.key} aria-labelledby={`notif-${category.key}`}>
                <div className="flex items-center justify-between gap-3 mb-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 id={`notif-${category.key}`} className="text-body-sm font-semibold text-content-primary truncate">
                      {t(`notifications.category.${category.key}`)}
                    </h2>
                    {category.unread_count > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center tabular shrink-0">
                        {category.unread_count > 99 ? '99+' : category.unread_count}
                      </span>
                    )}
                  </div>

                  {/* Per-category mute. Silencing likes must not silence
                      messages, which is the whole point of the sections. */}
                  <button
                    type="button"
                    onClick={() => toggleMute(category)}
                    disabled={muting === category.key}
                    aria-pressed={category.muted}
                    aria-label={`${category.muted ? t('notifications.unmute') : t('notifications.mute')} ${t(`notifications.category.${category.key}`)}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium transition-colors shrink-0 disabled:opacity-50 ${
                      category.muted
                        ? 'bg-surface-sunken text-content-tertiary'
                        : 'text-content-tertiary hover:text-content-primary hover:bg-surface-sunken'
                    }`}
                  >
                    {category.muted ? <BellOff size={13} /> : <Bell size={13} />}
                    {category.muted ? t('notifications.unmute') : t('notifications.mute')}
                  </button>
                </div>

                {category.notifications.length === 0 ? (
                  <p className="text-caption text-content-tertiary px-1 py-3">
                    {category.muted ? t('notifications.muted') : t('notifications.emptySection')}
                  </p>
                ) : (
                  <div className="space-y-1">

                {category.notifications.map(notif => {
                  const Icon  = typeIcon[notif.type]  || Bell;
                  const color = typeColor[notif.type] || '#F87404';
                  const isUnread = !notif.read_at;

                  // Highlighting is STYLE ONLY — the list order above is untouched
                  // (§5.7). The owner accent wins over a pin, because the platform
                  // voice should read consistently for everyone.
                  const highlight = notif.is_owner_actor
                    ? 'owner'
                    : notif.is_pinned_actor ? 'pinned' : null;

                  const highlightClass =
                    highlight === 'owner'
                      ? 'border-l-[3px] border-l-[var(--owner-accent)] bg-[color-mix(in_srgb,var(--owner-accent)_7%,transparent)]'
                      : highlight === 'pinned'
                        ? 'border-l-[3px] border-l-accent bg-accent/[0.06]'
                        : '';

                  return (
                    <div key={notif.id}
                      role={notif.link ? 'link' : undefined}
                      tabIndex={notif.link ? 0 : undefined}
                      onClick={() => openNotification(notif)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotification(notif); }
                      }}
                      className={`group flex items-start gap-3 p-4 rounded-md transition-all cursor-pointer ${highlightClass} ${isUnread && !highlight ? 'bg-accent/5 border border-accent/10' : !highlight ? 'hover:bg-gray-50 dark:hover:bg-white/[0.03]' : ''}`}
                    >
                      <div className="relative shrink-0">
                        {notif.actor_name ? (
                          <Avatar src={notif.actor_avatar || undefined} name={notif.actor_name} size={36} />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                            <Icon size={18} style={{ color }} />
                          </div>
                        )}
                        {notif.actor_name && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0d0d0d]" style={{ backgroundColor: color }}>
                            <Icon size={10} className="text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                          {notif.actor_name && <span className="font-semibold">{notif.actor_name} </span>}
                          <span className={isUnread ? 'font-medium' : ''}>{notif.title}</span>
                          {notif.body && <span className="text-content-secondary"> — {notif.body}</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-content-tertiary">{timeAgo(notif.created_at, locale)}</p>
                          {highlight === 'owner' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--owner-accent)]">
                              <Shield size={10} strokeWidth={2.5} aria-hidden /> Team Extreme
                            </span>
                          )}
                          {highlight === 'pinned' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                              <Pin size={10} strokeWidth={2.5} aria-hidden /> {t('notifications.pinned')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isUnread && <div className="w-2 h-2 rounded-full bg-accent" />}
                        <button onClick={(e) => { e.stopPropagation(); remove(notif.id); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                  </div>
                )}
              </section>
            ))}

            {categories.every(c => c.notifications.length === 0) && (
              <EmptyState
                icon="bell"
                title={t('notifications.emptyTitle')}
                description={t('notifications.emptyDesc')}
              />
            )}

            {/* The quiet categories, kept reachable so a member can still
                silence one before it ever fires. */}
            {categories.some(c => c.notifications.length > 0) &&
             categories.some(c => c.notifications.length === 0) && (
              <section aria-labelledby="notif-quiet" className="pt-2 border-t border-border-subtle">
                <h2 id="notif-quiet" className="text-caption text-content-tertiary px-1 mb-2">
                  {t('notifications.emptySectionsTitle')}
                </h2>
                <div className="flex flex-col gap-1">
                  {categories.filter(c => c.notifications.length === 0).map(category => (
                    <div key={category.key} className="flex items-center justify-between gap-3 px-1 py-1">
                      <span className="text-caption text-content-tertiary truncate">
                        {t(`notifications.category.${category.key}`)}
                        {category.muted && <> — {t('notifications.muted')}</>}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleMute(category)}
                        disabled={muting === category.key}
                        aria-pressed={category.muted}
                        aria-label={`${category.muted ? t('notifications.unmute') : t('notifications.mute')} ${t(`notifications.category.${category.key}`)}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium transition-colors shrink-0 disabled:opacity-50 ${
                          category.muted
                            ? 'bg-surface-sunken text-content-tertiary'
                            : 'text-content-tertiary hover:text-content-primary hover:bg-surface-sunken'
                        }`}
                      >
                        {category.muted ? <BellOff size={13} /> : <Bell size={13} />}
                        {category.muted ? t('notifications.unmute') : t('notifications.mute')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
