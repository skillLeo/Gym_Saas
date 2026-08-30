'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import {
  ChevronLeft, MessageCircle, Grid3X3,
  Dumbbell, Trophy, Calendar, UserPlus, UserCheck,
  Share2, Users, ThumbsUp, Loader2, X, Plus, Layers, Pencil, Pin
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { useI18nStore } from '@/store/i18nStore';

type Tab = 'stream' | 'about' | 'friends' | 'followers' | 'groups';

interface UserGroup {
  id: number; name: string; description: string | null; cover_color: string;
  status: 'pending' | 'approved' | 'rejected'; rejection_reason: string | null;
  member_count: number; is_member: boolean; is_creator: boolean;
}

interface ProfileUser {
  id: number; name: string; username: string; avatar_url: string;
  bio: string | null; primary_goal: string | null;
  is_following: boolean; followers_count: number; following_count: number;
}
interface Post {
  id: number; content: string; image_url: string | null; created_at: string;
  reactions: Record<string, number>; total_reactions: number; my_reaction: string | null;
  comment_count: number;
}

const REACTIONS = ['👍', '❤️', '🔥', '😍', '💪', '🎉'];
const timeAgo = (iso: string, t: (key: string, params?: Record<string, string | number>) => string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return t('socialProfile.timeAgo.justNow');
  if (diff < 3600000) return t('socialProfile.timeAgo.minutes', { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return t('socialProfile.timeAgo.hours', { n: Math.floor(diff / 3600000) });
  return t('socialProfile.timeAgo.days', { n: Math.floor(diff / 86400000) });
};

export default function UserProfilePage() {
  const params   = useParams();
  const username = params?.username as string;
  const { user: me } = useAuthStore();
  const { t } = useI18nStore();

  const [profile, setProfile]     = useState<ProfileUser | null>(null);
  const [posts, setPosts]         = useState<Post[]>([]);
  const [loading, setLoading]     = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('stream');
  const [toggling, setToggling]   = useState(false);
  const [pinning, setPinning]     = useState(false);
  const [isPinned, setIsPinned]   = useState(false);
  const [reactionPicker, setReactionPicker] = useState<number | null>(null);
  const [following, setFollowing] = useState<ProfileUser[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followers, setFollowers] = useState<ProfileUser[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes, postsRes] = await Promise.all([
          api.get(`/social/users/${username}`),
          api.get(`/social/users/${username}/posts`),
        ]);
        setProfile(pRes.data.data);
        setPosts(postsRes.data.data ?? []);

        // Reflect the existing pin so the button does not start out lying.
        // Allowed to fail quietly — pinning is an enhancement, not part of
        // loading a profile.
        try {
          const pinRes = await api.get('/notifications/pinned');
          const pinnedIds = (pinRes.data.data ?? []).map((p: { id: number }) => p.id);
          setIsPinned(pinnedIds.includes(pRes.data.data.id));
        } catch { /* ignore */ }
      } catch {
        toast.error(t('socialProfile.toast.loadFailed'));
      } finally {
        setLoading(false);
        setPostsLoading(false);
      }
    };
    if (username) load();
  }, [username]);

  const loadFollowing = async () => {
    if (followingLoading || following.length > 0) return;
    setFollowingLoading(true);
    try {
      const res = await api.get('/social/following', { params: { username } });
      setFollowing(res.data.data ?? []);
    } catch {} finally {
      setFollowingLoading(false);
    }
  };

  const loadFollowers = async () => {
    if (followersLoading || followers.length > 0) return;
    setFollowersLoading(true);
    try {
      const res = await api.get('/social/followers', { params: { username } });
      setFollowers(res.data.data ?? []);
    } catch {} finally {
      setFollowersLoading(false);
    }
  };

  /**
   * Join or leave an approved group. Optimistic, with a visible rollback if the
   * server refuses (for example, a group that was un-approved in the meantime).
   */
  const toggleMembership = async (g: UserGroup) => {
    setJoiningId(g.id);
    const joining = !g.is_member;
    const delta = joining ? 1 : -1;
    setGroups(prev => prev.map(x => x.id === g.id
      ? { ...x, is_member: joining, member_count: Math.max(0, x.member_count + delta) } : x));
    try {
      await api.post(`/groups/${g.id}/${joining ? 'join' : 'leave'}`);
      toast.success(joining ? t('socialProfile.joinedGroup', { name: g.name }) : t('socialProfile.leftGroup', { name: g.name }));
    } catch (err) {
      setGroups(prev => prev.map(x => x.id === g.id
        ? { ...x, is_member: !joining, member_count: Math.max(0, x.member_count - delta) } : x));
      toast.error(getErrorMessage(err, t('socialProfile.groupActionFailed')));
    } finally {
      setJoiningId(null);
    }
  };

  const loadGroups = async () => {
    if (groupsLoading || groups.length > 0) return;
    setGroupsLoading(true);
    try {
      const isOwnProfile = !!me && me.id === profile?.id;
      const res = await api.get('/groups', { params: { mine: true, username } });
      const approved: UserGroup[] = res.data.data ?? [];
      // /groups/mine also surfaces the caller's own pending/rejected
      // submissions — private draft state that only makes sense on your own
      // profile, never while looking at someone else's.
      if (isOwnProfile) {
        const mine = await api.get('/groups/mine');
        const own: UserGroup[] = mine.data.data ?? [];
        setGroups([...own, ...approved.filter(g => !own.find(o => o.id === g.id))]);
      } else {
        setGroups(approved);
      }
    } catch {} finally {
      setGroupsLoading(false);
    }
  };

  const handleTabChange = (t: Tab) => {
    setActiveTab(t);
    if (t === 'friends') loadFollowing();
    if (t === 'followers') loadFollowers();
    if (t === 'groups') loadGroups();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) { toast.error(t('socialProfile.toast.groupNameRequired')); return; }
    setCreatingGroup(true);
    try {
      const res = await api.post('/groups', { name: newGroupName.trim(), description: newGroupDesc.trim() || undefined });
      setGroups(prev => [res.data.data, ...prev]);
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      toast.success(t('socialProfile.toast.groupSubmitted'), { duration: 8000 });
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('socialProfile.toast.groupCreateFailed')));
    } finally {
      setCreatingGroup(false);
    }
  };

  const messageUser = async () => {
    if (!profile) return;
    setMessaging(true);
    try {
      const res = await api.post('/messages/start', { user_id: profile.id });
      window.location.href = `/messages/${res.data.conversation.id}`;
    } catch {
      toast.error(t('socialProfile.toast.messageFailed'));
      setMessaging(false);
    }
  };

  const togglePin = async () => {
    if (!profile) return;
    setPinning(true);
    try {
      const res = await api.post('/notifications/pinned', { user_id: profile.id });
      setIsPinned(Boolean(res.data.pinned));
      toast.success(res.data.message);
    } catch {
      toast.error(t('socialProfile.toast.pinFailed'));
    } finally {
      setPinning(false);
    }
  };

  const toggleFollow = async () => {
    if (!profile) return;
    setToggling(true);
    try {
      const res = await api.post(`/social/follow/${profile.id}`);
      const isNowFollowing = res.data.action === 'followed';
      setProfile(p => p ? { ...p, is_following: isNowFollowing, followers_count: res.data.followers_count } : p);
      toast.success(isNowFollowing ? t('socialProfile.toast.followed', { name: profile.name }) : t('socialProfile.toast.unfollowed', { name: profile.name }));
    } catch {
      toast.error(t('socialProfile.toast.followFailed'));
    } finally {
      setToggling(false);
    }
  };

  const react = async (postId: number, reaction: string) => {
    setReactionPicker(null);
    try {
      const res = await api.post(`/social/posts/${postId}/react`, { reaction });
      const { reactions, total_reactions, my_reaction } = res.data.data;
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions, total_reactions, my_reaction } : p));
    } catch {
      toast.error(t('socialProfile.toast.reactFailed'));
    }
  };

  const isMine = me?.id === profile?.id;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'stream',    label: t('socialProfile.tab.stream'),    count: posts.length },
    { id: 'about',     label: t('socialProfile.tab.about') },
    { id: 'friends',   label: t('socialProfile.tab.friends'),   count: profile?.following_count },
    { id: 'followers', label: t('socialProfile.tab.followers'), count: profile?.followers_count },
    { id: 'groups',    label: t('socialProfile.tab.groups') },
  ];

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-accent" />
        </div>
      </DashboardShell>
    );
  }

  if (!profile) {
    return (
      <DashboardShell>
        <div className="text-center py-24">
          <p className="text-content-tertiary">{t('socialProfile.userNotFound')}</p>
          <Link href="/social" className="text-accent text-sm hover:underline mt-2 block">{t('socialProfile.backToFeed')}</Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto pb-20">

        <PageHeader
          title={profile.name}
          subtitle={profile.username ? `@${profile.username}` : undefined}
          back="/social"
        />

        {/* Cover + avatar — 3-stop gradient flattened to the section accent (§1.1) */}
        <div className="relative">
          <div className="h-40 bg-accent" />
          <div className="px-4">
            <div className="relative -mt-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative">
                <Avatar src={profile.avatar_url} name={profile.name} size="xl"
                  className="border-4 border-white dark:border-[#0d0d0d]" />
                {isMine && (
                  <Link href="/profile/edit">
                    <button className="absolute bottom-0 right-0 w-7 h-7 bg-accent rounded-full flex items-center justify-center hover:bg-accent-hover transition-colors">
                      <Pencil size={12} className="text-white" />
                    </button>
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:mb-2">
                {!isMine && (
                  <>
                    <button onClick={toggleFollow} disabled={toggling}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${profile.is_following ? 'bg-surface-sunken text-content-secondary hover:bg-red-50 hover:text-red-500' : 'bg-accent text-white hover:bg-accent-hover'}`}>
                      {toggling
                        ? <Loader2 size={14} className="animate-spin" />
                        : profile.is_following ? <><UserCheck size={14} /> {t('socialProfile.following')}</> : <><UserPlus size={14} /> {t('socialProfile.follow')}</>}
                    </button>
                    <button onClick={messageUser} disabled={messaging}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-surface-raised border border-border-strong text-content-secondary hover:border-accent/40 transition-all disabled:opacity-60">
                      {messaging ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} {t('socialProfile.message')}
                    </button>
                    {/* Pin (§5.7): highlights this member's activity in your own
                        notification feed. Styling only — it never reorders it. */}
                    <button onClick={togglePin} disabled={pinning}
                      aria-pressed={isPinned}
                      title={isPinned ? t('socialProfile.unpinTitle') : t('socialProfile.pinTitle')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all disabled:opacity-60 ${isPinned ? 'bg-accent-surface text-accent border border-accent/40' : 'bg-surface-raised border border-border-strong text-content-secondary hover:border-accent/40'}`}>
                      {pinning ? <Loader2 size={14} className="animate-spin" /> : <Pin size={14} />}
                      {isPinned ? t('socialProfile.pinned') : t('socialProfile.pin')}
                    </button>
                  </>
                )}
                {isMine && (
                  <Link href="/profile/edit">
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-surface-raised border border-border-strong text-content-secondary hover:border-accent/40 transition-all">
                      {t('socialProfile.editProfile')}
                    </button>
                  </Link>
                )}
                <button className="w-9 h-9 flex items-center justify-center rounded-md bg-surface-raised border border-border-strong text-content-secondary hover:text-accent hover:border-accent/40 transition-all">
                  <Share2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Profile info */}
        <div className="px-4 pt-3 pb-4">
          <h1 className="text-xl font-bold text-content-primary">{profile.name}</h1>
          <p className="text-sm text-content-tertiary">@{profile.username}</p>
          {profile.bio && <p className="text-sm text-content-secondary mt-2">{profile.bio}</p>}
          {profile.primary_goal && (
            <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-accent bg-accent-surface px-2.5 py-1 rounded-full">
              <Dumbbell size={11} /> {profile.primary_goal.replace(/_/g, ' ')}
            </span>
          )}
          <div className="flex gap-4 mt-3 text-sm">
            <span><strong className="text-content-primary">{profile.followers_count}</strong> <span className="text-content-tertiary">{t('socialProfile.statFollowers')}</span></span>
            <span><strong className="text-content-primary">{profile.following_count}</strong> <span className="text-content-tertiary">{t('socialProfile.statFollowing')}</span></span>
            <span><strong className="text-content-primary">{posts.length}</strong> <span className="text-content-tertiary">{t('socialProfile.statPosts')}</span></span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-subtle px-4">
          {tabs.map(({ id, label, count }) => (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${activeTab === id ? 'text-accent' : 'text-content-secondary hover:text-content-secondary'}`}>
              {label}
              {count !== undefined && <span className="ml-1 text-xs text-content-tertiary">({count})</span>}
              {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 pt-4">
          {activeTab === 'stream' && (
            postsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-accent" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <Grid3X3 size={28} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
                <p className="text-sm text-content-tertiary">{t('socialProfile.noPostsYet')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <div key={post.id} className="bg-surface-raised rounded-md border border-border-subtle shadow-sm overflow-hidden">
                    <div className="p-4">
                      <p className="text-sm text-content-primary whitespace-pre-wrap leading-relaxed">{post.content}</p>
                      {post.image_url && (
                        <div className="mt-3 rounded-md overflow-hidden">
                          <img src={post.image_url} alt="Post" className="w-full max-h-80 object-cover" />
                        </div>
                      )}
                    </div>
                    {/* Reaction bar */}
                    <div className="flex items-center justify-between px-4 pb-3 border-t border-gray-50 dark:border-white/[0.04] pt-3">
                      <div className="flex items-center gap-1 text-xs text-content-tertiary">
                        {Object.keys(post.reactions).slice(0, 3).map(r => <span key={r}>{r}</span>)}
                        {post.total_reactions > 0 && <span>{post.total_reactions}</span>}
                      </div>
                      <div className="flex gap-2 relative">
                        <div className="relative">
                          <button
                            onMouseEnter={() => setReactionPicker(post.id)}
                            onClick={() => react(post.id, post.my_reaction ?? '👍')}
                            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${post.my_reaction ? 'text-accent bg-accent-surface' : 'text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                            {post.my_reaction ? <span>{post.my_reaction}</span> : <ThumbsUp size={13} />}
                            <span>{t('socialProfile.like')}</span>
                          </button>
                          {reactionPicker === post.id && (
                            <div onMouseLeave={() => setReactionPicker(null)}
                              className="absolute bottom-full right-0 mb-2 bg-white dark:bg-[#222] border border-border-strong rounded-md p-2 flex gap-1 z-10">
                              {REACTIONS.map(r => (
                                <button key={r} onClick={() => react(post.id, r)}
                                  className="text-xl hover:scale-125 transition-transform w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/10">{r}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-content-tertiary self-center">{timeAgo(post.created_at, t)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="bg-surface-raised rounded-md border border-border-subtle p-5 shadow-sm">
                <h3 className="font-semibold text-content-primary text-sm mb-3">{t('socialProfile.aboutName', { name: profile.name })}</h3>
                {profile.bio ? (
                  <p className="text-sm text-content-secondary">{profile.bio}</p>
                ) : (
                  <p className="text-sm text-content-tertiary italic">{t('socialProfile.noBio')}</p>
                )}
                {profile.primary_goal && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-content-secondary">
                    <Trophy size={15} className="text-accent" />
                    <span>{t('socialProfile.goalPrefix')} <strong className="text-content-primary capitalize">{profile.primary_goal.replace(/_/g, ' ')}</strong></span>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-sm text-content-tertiary">
                  <Calendar size={14} />
                  <span>{t('socialProfile.memberOfTeamExtreme')}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { labelKey: 'socialProfile.statCard.followers',  val: profile.followers_count, icon: Users,   color: '#F87404' },
                  { labelKey: 'socialProfile.statCard.following',  val: profile.following_count, icon: UserPlus, color: '#004AAD' },
                  { labelKey: 'socialProfile.statCard.posts',      val: posts.length,            icon: Grid3X3,  color: '#10B981' },
                  { labelKey: 'socialProfile.statCard.workouts',   val: '—',                     icon: Dumbbell, color: '#FF0404' },
                ].map(({ labelKey, val, icon: Icon, color }) => (
                  <div key={labelKey} className="bg-surface-raised rounded-md border border-border-subtle p-4 shadow-sm text-center">
                    <Icon size={18} className="mx-auto mb-1" style={{ color }} />
                    <p className="text-xl font-black text-content-primary">{val}</p>
                    <p className="text-xs text-content-tertiary">{t(labelKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'friends' && (
            followingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-accent" />
              </div>
            ) : following.length === 0 ? (
              <div className="text-center py-12">
                <Users size={28} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
                <p className="text-sm text-content-tertiary">{t('socialProfile.notFollowingYet')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {following.map(u => (
                  <Link key={u.id} href={`/social/${u.username}`}>
                    <div className="bg-surface-raised rounded-md border border-border-subtle p-4 shadow-sm text-center hover:border-accent/40 transition-colors cursor-pointer">
                      <Avatar src={u.avatar_url} name={u.name} size="md" className="mx-auto mb-2" />
                      <p className="font-semibold text-content-primary text-sm truncate">{u.name}</p>
                      <p className="text-xs text-content-tertiary">@{u.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {activeTab === 'followers' && (
            followersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-accent" />
              </div>
            ) : followers.length === 0 ? (
              <div className="text-center py-12">
                <Users size={28} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
                <p className="text-sm text-content-tertiary">{t('socialProfile.noFollowersYet')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {followers.map(u => (
                  <Link key={u.id} href={`/social/${u.username}`}>
                    <div className="bg-surface-raised rounded-md border border-border-subtle p-4 shadow-sm text-center hover:border-accent/40 transition-colors cursor-pointer">
                      <Avatar src={u.avatar_url} name={u.name} size="md" className="mx-auto mb-2" />
                      <p className="font-semibold text-content-primary text-sm truncate">{u.name}</p>
                      <p className="text-xs text-content-tertiary">@{u.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {activeTab === 'groups' && (
            <div>
              {isMine && (
                <button onClick={() => setShowCreateGroup(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-md border-2 border-dashed border-accent/40 text-accent text-sm font-semibold hover:bg-accent/5 transition-all">
                  <Plus size={16} /> {t('socialProfile.createGroup')}
                </button>
              )}
              {groupsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-accent" />
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-12">
                  <Layers size={28} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
                  <p className="text-sm text-content-tertiary">{t('socialProfile.noGroupsYet')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map(g => (
                    <div key={g.id} className="bg-surface-raised rounded-md border border-border-subtle p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-md flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: g.cover_color }}>
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-content-primary text-sm truncate">{g.name}</p>
                            {g.status === 'pending' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">{t('socialProfile.pendingApproval')}</span>
                            )}
                            {g.status === 'rejected' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">{t('socialProfile.rejected')}</span>
                            )}
                          </div>
                          {g.description && <p className="text-xs text-content-secondary mt-0.5 line-clamp-2">{g.description}</p>}
                          {g.status === 'approved' && <p className="text-xs text-content-tertiary mt-1">{g.member_count} {g.member_count !== 1 ? t('socialProfile.memberPlural') : t('socialProfile.member')}</p>}
                          {g.status === 'rejected' && g.rejection_reason && (
                            <p className="text-xs text-red-500 mt-1">{t('socialProfile.reason', { reason: g.rejection_reason })}</p>
                          )}
                        </div>

                        {/* Join / Leave. The card already knew `is_member` and
                            `is_creator` but never offered any way to act on
                            them, so approved groups could be seen and never
                            joined. Creators are shown a label instead — they
                            cannot leave a group they own. */}
                        {g.status === 'approved' && (
                          g.is_creator ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent-surface text-accent shrink-0">
                              {t('socialProfile.creator')}
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleMembership(g)}
                              disabled={joiningId === g.id}
                              className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors disabled:opacity-60 ${
                                g.is_member
                                  ? 'bg-surface-sunken text-content-secondary hover:bg-surface-sunken/70'
                                  : 'bg-accent text-white hover:bg-accent-hover'
                              }`}
                            >
                              {joiningId === g.id ? '…' : g.is_member ? t('socialProfile.leave') : t('socialProfile.join')}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Group modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateGroup(false)} />
          <div className="relative w-full max-w-sm bg-surface-raised rounded-md z-10 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
              <h3 className="font-bold text-content-primary">{t('socialProfile.createGroup')}</h3>
              <button onClick={() => setShowCreateGroup(false)} className="w-8 h-8 rounded-md flex items-center justify-center text-content-tertiary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-2.5 p-3 bg-blue-50 dark:bg-[#004AAD]/10 rounded-md border border-blue-200 dark:border-[#004AAD]/20">
                <p className="text-xs text-brand-blue-deep dark:text-blue-300 leading-relaxed">
                  {t('socialProfile.groupApprovalNotice')}
                </p>
              </div>
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder={t('socialProfile.groupNamePlaceholder')} maxLength={100}
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
              <textarea value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)}
                placeholder={t('socialProfile.groupDescPlaceholder')} rows={3} maxLength={500}
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowCreateGroup(false)}
                className="flex-1 py-3 rounded-md border border-border-strong text-sm font-medium text-content-secondary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                {t('goals.modal.cancel')}
              </button>
              <button onClick={createGroup} disabled={creatingGroup}
                className="flex-1 py-3 rounded-md bg-accent text-white text-sm font-semibold hover:bg-[#FF5C04] transition-colors shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-70">
                {creatingGroup ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {t('socialProfile.submitForApproval')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
