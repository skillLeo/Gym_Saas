'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Search, X, TrendingUp, Users, Hash, UserCheck, UserPlus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface SocialUser {
  id: number; name: string; username: string; avatar_url: string;
  bio: string | null; primary_goal: string | null;
  is_following: boolean; followers_count: number;
}

export default function ExplorePage() {
  const { t } = useI18nStore();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim() ? '/social/search' : '/social/suggestions';
      const params   = q.trim() ? { q } : {};
      const res = await api.get(endpoint, { params });
      setUsers(res.data.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => load(query), 350);
    return () => clearTimeout(timer);
  }, [query, load]);

  const toggleFollow = async (u: SocialUser) => {
    setTogglingId(u.id);
    try {
      const res = await api.post(`/social/follow/${u.id}`);
      const action = res.data.action;
      setUsers(prev => prev.map(m => m.id === u.id ? { ...m, is_following: action === 'followed' } : m));
      toast.success(t(action === 'followed' ? 'social.toast.followingName' : 'social.toast.unfollowedName', { name: u.name }));
    } catch {
      toast.error(t('common.failed'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title={t('explore.title')} back="/social" />

        {/* Search bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              autoFocus placeholder={t('explore.placeholder')}
              className="w-full pl-9 pr-9 py-3 rounded-md border border-border-strong bg-surface-raised text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm" />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* A "Trending Hashtags" strip used to sit here with counts typed into
            the source — ChestDay 1,240, MealPrep 3,872 and so on. None of it was
            real: there is no hashtag feature, no endpoint behind it, and not one
            post in the database contains a hashtag. Removed rather than replaced,
            because aggregating real usage would render an empty strip and
            inventing numbers is what got it removed in the first place. */}

        {/* Members */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-accent" />
            <h3 className="font-semibold text-content-primary text-sm">
              {query ? `Results for "${query}"` : t('explore.peopleToFollow')}
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-accent" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <Users size={32} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
              <p className="text-sm text-content-tertiary">{query ? t('explore.noMembers') : t('explore.noSuggestions')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 bg-surface-raised rounded-md border border-border-subtle shadow-sm">
                  <Link href={`/social/${u.username}`}>
                    <Avatar src={u.avatar_url} name={u.name} size="md" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/social/${u.username}`}>
                      <p className="font-semibold text-content-primary text-sm hover:text-accent transition-colors">{u.name}</p>
                    </Link>
                    <p className="text-xs text-content-tertiary">@{u.username}</p>
                    {u.bio && <p className="text-xs text-content-secondary mt-1 line-clamp-1">{u.bio}</p>}
                    {u.primary_goal && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-accent bg-accent-surface px-2 py-0.5 rounded-full capitalize">
                        {t('goal.' + u.primary_goal.replace(/_(\w)/g, (_m, c) => c.toUpperCase()))}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleFollow(u)} disabled={togglingId === u.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${u.is_following ? 'bg-surface-sunken text-content-secondary hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500' : 'bg-accent text-white hover:bg-accent-hover shadow-sm'}`}>
                      {togglingId === u.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : u.is_following ? <><UserCheck size={12} /> {t('social.following')}</> : <><UserPlus size={12} /> {t('social.follow')}</>}
                    </button>
                    <p className="text-[10px] text-content-tertiary">{u.followers_count === 1 ? t('social.followerCountOne') : t('social.followerCount', { n: u.followers_count })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
