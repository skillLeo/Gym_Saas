'use client';

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Users, UserPlus, Search, X, MessageCircle, UserCheck, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface SocialUser {
  id: number; name: string; username: string; avatar_url: string;
  bio: string | null; primary_goal: string | null;
  is_following: boolean; followers_count: number; following_count: number;
}

export default function FriendsPage() {
  const { t } = useI18nStore();
  const [tab, setTab] = useState<'following' | 'followers'>('following');
  const [search, setSearch] = useState('');
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [followers, setFollowers] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [f1, f2] = await Promise.all([
          api.get('/social/following'),
          api.get('/social/followers'),
        ]);
        setFollowing(f1.data.data ?? []);
        setFollowers(f2.data.data ?? []);
      } catch {
        toast.error(t('friends.error.load'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleFollow = async (user: SocialUser) => {
    setTogglingId(user.id);
    try {
      const res = await api.post(`/social/follow/${user.id}`);
      const action = res.data.action;
      if (action === 'unfollowed') {
        setFollowing(prev => prev.filter(u => u.id !== user.id));
        toast.success(`Unfollowed ${user.name}`);
      } else {
        setFollowing(prev => [...prev, { ...user, is_following: true }]);
        setFollowers(prev => prev.map(u => u.id === user.id ? { ...u, is_following: true } : u));
        toast.success(t('social.toast.followingName', { name: user.name }));
      }
    } catch {
      toast.error(t('common.failed'));
    } finally {
      setTogglingId(null);
    }
  };

  const q = search.toLowerCase().trim();
  const displayed = (tab === 'following' ? following : followers).filter(u =>
    !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
  );

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto space-y-6 pb-8 px-4 py-6">
        {/* `title` is a string prop. It previously held a template literal
            containing JSX source, so the header rendered the literal characters
            `<Users size=24 className="text-accent" /> Friends` on screen. */}
        <PageHeader
        title={t('friends.title')}
        subtitle={t('friends.subtitle', { following: following.length, followers: followers.length })}
        actions={
          <Link href="/social" className="flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
              {t('social.backToFeed')}
            </Link>
        }
      />

        {/* Tabs */}
        <div className="flex gap-2">
          {(['following', 'followers'] as const).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-all ${tab === tabKey ? 'bg-accent text-white' : 'bg-surface-raised border border-border-strong text-content-secondary'}`}>
              {tabKey === 'following' ? `${t('social.following')} (${following.length})` : `${t('social.followers')} (${followers.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('friends.search')}
            className="w-full pl-11 pr-10 py-3 bg-surface-raised border border-border-strong rounded-md text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary">
              <X size={15} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-accent" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <Users size={32} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
            <p className="text-sm text-content-tertiary">
              {q ? t('friends.noResults') : tab === 'following' ? t('friends.notFollowing') : t('friends.noFollowers')}
            </p>
            {!q && (
              <Link href="/social/explore">
                <button className="mt-3 text-xs font-semibold text-accent hover:underline">{t('friends.explore')}</button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayed.map(u => (
              <div key={u.id} className="bg-surface-raised rounded-md border border-border-subtle shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <Link href={`/social/${u.username}`}>
                    <Avatar src={u.avatar_url} name={u.name} size="md" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/social/${u.username}`}>
                      <p className="font-semibold text-content-primary text-sm truncate hover:text-accent transition-colors">{u.name}</p>
                    </Link>
                    <p className="text-xs text-content-tertiary">@{u.username}</p>
                    {u.bio && <p className="text-xs text-content-secondary mt-1 line-clamp-2">{u.bio}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-content-tertiary">
                      <span>{u.followers_count} followers</span>
                      <span>{u.following_count} following</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => toggleFollow(u)} disabled={togglingId === u.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${u.is_following || tab === 'following' ? 'bg-surface-sunken text-content-secondary hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500' : 'bg-accent text-white hover:bg-accent-hover'}`}>
                    {togglingId === u.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : (tab === 'following' || u.is_following) ? <><UserCheck size={13} /> {t('social.following')}</> : <><UserPlus size={13} /> {t('social.follow')}</>}
                  </button>
                  <Link href="/messages" className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-sunken text-xs font-semibold text-content-secondary hover:bg-[#004AAD]/10 hover:text-brand-blue-deep transition-all">
                    <MessageCircle size={13} /> {t('friends.message')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Explore CTA */}
        {!loading && displayed.length > 0 && (
          <div className="text-center pt-4">
            <Link href="/social/explore">
              <button className="flex items-center gap-2 mx-auto text-sm font-semibold text-accent hover:underline">
                <UserPlus size={15} /> {t('friends.discover')}
              </button>
            </Link>
          </div>
        )}

        <div className="h-10" />
      </div>
    </DashboardShell>
  );
}
