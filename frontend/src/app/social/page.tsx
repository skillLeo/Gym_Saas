'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatRelative } from '@/lib/format';
import type { Locale } from '@/store/i18nStore';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { useAuthStore } from '@/store/authStore';
import {
  MessageCircle, Share2, MoreHorizontal, Globe, ChevronRight, ChevronDown,
  Users, UserPlus, ThumbsUp, Send, Bookmark, Image as ImageIcon,
  Loader2, X, Trash2, Search, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { FeaturedMemberCard } from '@/components/achievements/FeaturedMemberCard';
import { fetchFeedFeatures, type FeedFeature } from '@/lib/achievements';

/**
 * Post reactions. These emoji are USER CONTENT, not UI chrome — a member picks
 * one and it becomes their reaction, exactly like the composer's EmojiPicker.
 * The §1.5 "no emoji as UI" rule does not apply here, and the client has
 * confirmed this small reaction set stays as-is.
 */
const REACTIONS = ['👍', '❤️', '🔥', '😍', '💪', '🎉'];

interface PostUser  { id: number; name: string; username: string; avatar_url: string }
interface Comment   { id: number; content: string; user: PostUser; created_at: string; replies: Comment[] }
interface Post {
  id: number; content: string; image_url: string | null; post_type: string;
  created_at: string; user: PostUser;
  reactions: Record<string, number>; total_reactions: number; my_reaction: string | null;
  comment_count: number;
  is_saved: boolean;
  // client-side
  showComments?: boolean; comments?: Comment[]; commentsLoading?: boolean;
}

/**
 * Relative time in the member's language.
 *
 * Was hand-rolled English ("just now", "3d ago"), which cannot translate at
 * all — the wording, the abbreviation and the plural rules differ per language.
 * The same fix already applied to the notifications and live pages.
 */
const timeAgo = (iso: string, locale: Locale) => formatRelative(iso, locale);

export default function SocialPage() {
  const { t, locale } = useI18nStore();
  const { user } = useAuthStore();
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<'foryou' | 'following' | 'saved'>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [postText, setPostText] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [uploadingPostImage, setUploadingPostImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reactionPicker, setReactionPicker] = useState<number | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [commentingId, setCommentingId] = useState<number | null>(null);
  // Threaded replies: which comment's reply box is open, and its draft text.
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [features, setFeatures] = useState<FeedFeature[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const postTextRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    const el = postTextRef.current;
    if (!el) { setPostText(prev => prev + emoji); return; }
    const start = el.selectionStart ?? postText.length;
    const end = el.selectionEnd ?? postText.length;
    const next = postText.slice(0, start) + emoji + postText.slice(end);
    setPostText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const loadFeed = useCallback(async (pg: number, tabVal: string, replace = false) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    try {
      // Bookmarks come from their own endpoint, ordered by when they were saved.
      const res = tabVal === 'saved'
        ? await api.get('/social/posts/saved')
        : await api.get('/social/feed', { params: { tab: tabVal, page: pg, per_page: 10 } });
      const { data, last_page } = res.data.data;
      setPosts(prev => replace ? data : [...prev, ...data]);
      setLastPage(last_page);
      setPage(pg);
    } catch {
      toast.error(t('social.error.feed'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(1, tab, true);
  }, [tab, loadFeed]);

  useEffect(() => {
    fetchFeedFeatures().then(setFeatures).catch(() => {});
    api.get('/social/suggestions').then(res => setSuggestions(res.data.data?.slice(0, 5) ?? [])).finally(() => setSuggestionsLoading(false));
    api.get('/social/following').then(res => setFollowingCount(res.data.data?.length ?? 0)).catch(() => {});
    api.get('/social/followers').then(res => setFollowersCount(res.data.data?.length ?? 0)).catch(() => {});
  }, []);

  const postImageInputRef = useRef<HTMLInputElement>(null);

  const handlePostImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPostImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'posts');
      const res = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPostImageUrl(res.data.image_url);
    } catch {
      toast.error(t('social.error.upload'));
    } finally {
      setUploadingPostImage(false);
    }
  };

  const submitPost = async () => {
    if (!postText.trim()) { toast.error(t('social.error.empty')); return; }
    setPosting(true);
    try {
      const res = await api.post('/social/posts', {
        content:   postText,
        image_url: postImageUrl || undefined,
        post_type: postImageUrl ? 'photo' : 'text'
      });
      setPosts(prev => [res.data.data, ...prev]);
      setPostText('');
      setPostImageUrl('');
      toast.success(t('social.toast.shared'));
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('social.error.post')));
    } finally {
      setPosting(false);
    }
  };

  const react = async (postId: number, reaction: string) => {
    setReactionPicker(null);
    try {
      const res = await api.post(`/social/posts/${postId}/react`, { reaction });
      const { reactions, total_reactions, my_reaction } = res.data.data;
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions, total_reactions, my_reaction } : p));
    } catch {
      toast.error(t('social.error.react'));
    }
  };

  const deletePost = async (postId: number) => {
    try {
      await api.delete(`/social/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success(t('social.toast.deleted'));
    } catch {
      toast.error(t('social.error.delete'));
    }
  };

  const toggleComments = async (post: Post) => {
    if (post.showComments) {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, showComments: false } : p));
      return;
    }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, showComments: true, commentsLoading: true } : p));
    try {
      const res = await api.get(`/social/posts/${post.id}/comments`);
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments: res.data.data, commentsLoading: false } : p));
    } catch {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, commentsLoading: false } : p));
    }
  };

  /**
   * Delete your own comment or reply.
   *
   * `DELETE /social/comments/{id}` has always worked and refuses anyone but the
   * author with a 403 — there was simply no button, so a member could post a
   * comment and never take it back. Removes it from both the top-level list and
   * any thread it is a reply in, and decrements the post's count so the number
   * on the button does not disagree with what is on screen.
   */
  const deleteComment = async (postId: number, commentId: number) => {
    const ok = await confirm({
      title: t('social.deleteComment.title'),
      message: t('social.deleteComment.body'),
      confirmLabel: t('social.deleteComment.confirm'),
      destructive: true,
    });
    if (!ok) return;

    setDeletingCommentId(commentId);
    try {
      await api.delete(`/social/comments/${commentId}`);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const kept = (p.comments ?? [])
          .filter(c => c.id !== commentId)
          .map(c => ({ ...c, replies: (c.replies ?? []).filter(r => r.id !== commentId) }));
        return { ...p, comments: kept, comment_count: Math.max(0, p.comment_count - 1) };
      }));
      toast.success(t('social.deleteComment.done'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('social.deleteComment.failed')));
    } finally {
      setDeletingCommentId(null);
    }
  };

  const submitComment = async (postId: number) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    setCommentingId(postId);
    try {
      const res = await api.post(`/social/posts/${postId}/comments`, { content });
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        comment_count: p.comment_count + 1,
        comments: [...(p.comments ?? []), res.data.data]
      } : p));
      setCommentInputs(c => ({ ...c, [postId]: '' }));
    } catch {
      toast.error(t('social.error.comment'));
    } finally {
      setCommentingId(null);
    }
  };

  /** Post a threaded reply beneath an existing comment. */
  const submitReply = async (postId: number, parentId: number) => {
    const content = replyInputs[parentId]?.trim();
    if (!content) return;
    setReplyingId(parentId);
    try {
      const res = await api.post(`/social/posts/${postId}/comments`, { content, parent_id: parentId });
      setPosts(prev => prev.map(p => p.id !== postId ? p : {
        ...p,
        comment_count: p.comment_count + 1,
        comments: (p.comments ?? []).map(c =>
          c.id === parentId ? { ...c, replies: [...(c.replies ?? []), res.data.data] } : c),
      }));
      setReplyInputs(v => ({ ...v, [parentId]: '' }));
      setReplyingTo(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t('social.error.reply')));
    } finally {
      setReplyingId(null);
    }
  };

  /**
   * Bookmark a post. This button previously had no handler at all.
   * Optimistic, with a visible rollback if the server refuses.
   */
  const toggleSave = async (postId: number) => {
    setSavingId(postId);
    const before = posts.find(p => p.id === postId)?.is_saved ?? false;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_saved: !before } : p));
    try {
      const res = await api.post(`/social/posts/${postId}/save`);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_saved: res.data.is_saved } : p));
      toast.success(res.data.is_saved ? 'Saved' : t('social.toast.unsaved'));
      if (tab === 'saved' && !res.data.is_saved) setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_saved: before } : p));
      toast.error(getErrorMessage(err, t('social.error.save')));
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Share a post. Uses the device's own share sheet where available (phones),
   * and falls back to copying the link on desktop. Previously did nothing.
   */
  const sharePost = async (postId: number, authorName: string) => {
    const url = `${window.location.origin}/social?post=${postId}`;
    const shareData = { title: 'My EXtreme Trainer', text: `${authorName}'s post`, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t('social.toast.copied'));
    } catch (err) {
      // A user dismissing the native share sheet throws AbortError — not a failure.
      if ((err as Error)?.name === 'AbortError') return;
      toast.error(t('social.error.share'));
    }
  };

  const followUser = async (targetId: number) => {
    try {
      const res = await api.post(`/social/follow/${targetId}`);
      setSuggestions(prev => prev.filter(u => u.id !== targetId));
      toast.success(res.data.action === 'followed' ? t('social.toast.followed') : t('social.toast.unfollowed'));
    } catch {
      toast.error(t('common.failed'));
    }
  };

  return (
    <DashboardShell>
      <PageHeader
        title={t('social.title')}
        actions={
          <Link
            href="/social/explore"
            aria-label={t('social.findMembers')}
            className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
          >
            <Search size={20} strokeWidth={1.75} />
          </Link>
        }
      />
      <div className="max-w-3xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">

        {/* Main feed column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Compose */}
          <div className="bg-surface-raised rounded-md border border-border-subtle shadow-sm p-4">
            <div className="flex gap-3">
              <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size="sm" />
              <div className="flex-1">
                <textarea
                  ref={postTextRef}
                  value={postText} onChange={e => setPostText(e.target.value)}
                  placeholder={t('social.compose')}
                  rows={2}
                  className="w-full bg-transparent text-content-primary placeholder:text-content-tertiary text-sm resize-none focus:outline-none"
                />
                {postImageUrl && (
                  <div className="relative mt-2 inline-block">
                    <img src={postImageUrl} alt="" className="max-h-48 rounded-md object-cover" />
                    <button onClick={() => setPostImageUrl('')}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle">
                  <div className="flex gap-1">
                    <input ref={postImageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePostImageSelect} disabled={uploadingPostImage} />
                    <button onClick={() => postImageInputRef.current?.click()} disabled={uploadingPostImage}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${postImageUrl ? 'bg-accent-surface text-accent' : 'text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                      {uploadingPostImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                      {uploadingPostImage ? t('social.uploading') : t('social.photo')}
                    </button>
                    <EmojiPicker onSelect={insertEmoji} triggerLabel={t('social.emoji')} />
                  </div>
                  <button onClick={submitPost} disabled={!postText.trim() || posting}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
                    {posting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    {posting ? t('social.posting') : t('social.share')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs. Lucide icons rather than emoji: emoji render differently on
              every platform, cannot be themed, and are reserved here for
              reactions, which are user content rather than chrome. */}
          <div role="tablist" aria-label="Feed" className="flex gap-2">
            {/* "Saved" gives the bookmark button somewhere to lead — a Save
                button with no way to see what you saved would be half a feature. */}
            {(['foryou', 'following', 'saved'] as const).map(tabKey => {
              const Icon = tabKey === 'foryou' ? Sparkles : tabKey === 'following' ? Users : Bookmark;
              const label = tabKey === 'foryou' ? t('social.forYou') : tabKey === 'following' ? t('social.following') : t('social.saved');
              return (
                <button key={tabKey} role="tab" aria-selected={tab === tabKey} onClick={() => setTab(tabKey)}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === tabKey ? 'bg-accent text-white' : 'bg-surface-raised border border-border-strong text-content-secondary'}`}>
                  <Icon size={15} strokeWidth={2} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Members on a sustained streak, surfaced from real activity by the
              scheduled job (§4.5). The API caps these at three. Rendered above
              the feed unconditionally — an empty post feed says nothing about
              whether there's a streak worth featuring. */}
          {features.length > 0 && (
            <div className="space-y-4">
              {features.map(f => (
                <FeaturedMemberCard
                  key={f.id}
                  feature={f}
                  isSelf={f.user.id === user?.id}
                  onDismissed={(id) => setFeatures(prev => prev.filter(x => x.id !== id))}
                />
              ))}
            </div>
          )}

          {/* Posts */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-accent" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <Globe size={32} className="mx-auto mb-2 text-content-tertiary dark:text-content-secondary" />
              <p className="text-sm text-content-tertiary">
                {tab === 'following'
                  ? t('social.emptyFollow')
                  : tab === 'saved'
                    ? t('social.emptySaved')
                    : t('social.empty')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="bg-surface-raised rounded-md border border-border-subtle shadow-sm overflow-hidden">
                  {/* Post header */}
                  <div className="flex items-start justify-between p-4 pb-3">
                    <div className="flex items-start gap-3">
                      <Link href={`/social/${post.user.username}`}>
                        <Avatar src={post.user.avatar_url} name={post.user.name} size="sm" />
                      </Link>
                      <div>
                        <Link href={`/social/${post.user.username}`}>
                          <span className="font-semibold text-content-primary text-sm hover:text-accent transition-colors">{post.user.name}</span>
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                          <span>@{post.user.username}</span>
                          <span>·</span>
                          <span>{timeAgo(post.created_at, locale)}</span>
                          <Globe size={10} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {post.user.id === user?.id && (
                        <button onClick={() => deletePost(post.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                      {/* A "⋯" button sat here with no click handler at all — it
                          highlighted on hover and did nothing, which reads as a
                          broken menu rather than an absent one. There is no
                          member-reporting feature for it to open (the moderation
                          queue is fed by the keyword scanner, not by reports),
                          and every action a member does have — delete, save,
                          share — is already its own control on this card. */}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-4 pb-3">
                    <p className="text-sm text-content-primary whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  </div>

                  {post.image_url && (
                    <div className="mx-4 mb-3 rounded-md overflow-hidden">
                      <img src={post.image_url} alt="Post" className="w-full max-h-96 object-cover" />
                    </div>
                  )}

                  {/* Reactions summary */}
                  {/* Shown when there are reactions OR comments. It used to be
                      gated on reactions alone, so a post with comments but no
                      reactions hid its own comment count — the count only
                      appeared once somebody happened to react. */}
                  {(post.total_reactions > 0 || post.comment_count > 0) && (
                    <div className="px-4 py-2 flex items-center gap-1 text-xs text-content-secondary border-t border-gray-50 dark:border-white/[0.04]">
                      {post.total_reactions > 0 && (
                        <>
                          <div className="flex -space-x-0.5">
                            {Object.keys(post.reactions).slice(0, 3).map(r => (
                              <span key={r} className="text-sm">{r}</span>
                            ))}
                          </div>
                          <span>{post.total_reactions === 1 ? t('social.reactionCountOne') : t('social.reactionCount', { count: post.total_reactions })}</span>
                        </>
                      )}
                      {post.comment_count > 0 && (
                        <span className="ml-auto">{post.comment_count === 1 ? t('social.commentCountOne') : t('social.commentCount', { count: post.comment_count })}</span>
                      )}
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex border-t border-border-subtle">
                    {/* Reaction button with picker. The picker opens on hover for
                        desktop convenience AND on click/tap (via the caret), since
                        onMouseEnter alone is unreachable on touch devices, which
                        have no hover state at all. */}
                    <div className="relative flex-1 flex">
                      <button
                        onMouseEnter={() => setReactionPicker(post.id)}
                        onClick={() => react(post.id, post.my_reaction ? post.my_reaction : '👍')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] ${post.my_reaction ? 'text-accent' : 'text-content-secondary'}`}>
                        {post.my_reaction
                          ? <span className="text-base">{post.my_reaction}</span>
                          : <ThumbsUp size={15} />}
                        {post.my_reaction ? t('social.liked') : t('social.like')}
                      </button>
                      <button
                        aria-label="Choose a reaction"
                        onMouseEnter={() => setReactionPicker(post.id)}
                        onClick={() => setReactionPicker(reactionPicker === post.id ? null : post.id)}
                        className="px-2 flex items-center justify-center text-content-tertiary hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                        <ChevronDown size={13} />
                      </button>
                      {reactionPicker === post.id && (
                        <div
                          onMouseLeave={() => setReactionPicker(null)}
                          className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#222] border border-border-strong rounded-md p-2 flex items-center gap-1 z-10">
                          {REACTIONS.map(r => (
                            <button key={r} onClick={() => { react(post.id, r); setReactionPicker(null); }}
                              className="text-xl hover:scale-125 transition-transform w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/10">
                              {r}
                            </button>
                          ))}
                          {/* The six above are quick picks. This opens the full
                              set so any emoji can be used as a reaction, the way
                              WhatsApp does it. Reuses the same picker as the
                              composer rather than introducing a second one. */}
                          <span className="w-px h-6 bg-border-strong mx-0.5" aria-hidden />
                          <EmojiPicker
                            triggerLabel=""
                            triggerClassName="w-9 h-9 flex items-center justify-center rounded-md text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            onSelect={(emoji) => { react(post.id, emoji); setReactionPicker(null); }}
                          />
                        </div>
                      )}
                    </div>

                    <button onClick={() => toggleComments(post)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] ${post.showComments ? 'text-brand-blue-deep' : 'text-content-secondary'}`}>
                      <MessageCircle size={15} /> {t('social.comment')}
                    </button>

                    <button onClick={() => sharePost(post.id, post.user.name)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-content-secondary transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                      <Share2 size={15} /> {t('social.share')}
                    </button>

                    <button onClick={() => toggleSave(post.id)} disabled={savingId === post.id}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-60 ${post.is_saved ? 'text-accent' : 'text-content-secondary'}`}>
                      <Bookmark size={15} fill={post.is_saved ? 'currentColor' : 'none'} />
                      {post.is_saved ? t('common.saved') : t('common.save')}
                    </button>
                  </div>

                  {/* Comments section */}
                  {post.showComments && (
                    <div className="border-t border-border-subtle p-4 space-y-3">
                      {post.commentsLoading ? (
                        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-accent" /></div>
                      ) : (post.comments ?? []).map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <Avatar src={c.user.avatar_url} name={c.user.name} size="sm" />
                          <div className="flex-1">
                            <div className="bg-surface-sunken rounded-md px-3 py-2">
                              <p className="text-xs font-semibold text-content-primary">{c.user.name}</p>
                              <p className="text-xs text-content-secondary mt-0.5">{c.content}</p>
                            </div>
                            {/* Reply affordance. The API has always accepted a
                                parent_id and the app already RENDERED replies —
                                there was simply no way for a member to create
                                one, so threading was unreachable through the UI. */}
                            <div className="flex items-center gap-3 mt-1 ml-2">
                              <p className="text-[10px] text-content-tertiary">{timeAgo(c.created_at, locale)}</p>
                              <button
                                onClick={() => setReplyingTo(prev => (prev === c.id ? null : c.id))}
                                className="text-[10px] font-semibold text-content-tertiary hover:text-accent transition-colors"
                              >
                                {t('social.reply')}
                              </button>
                              {/* Only the author sees this; the server refuses
                                  anyone else with a 403 regardless. */}
                              {c.user.id === user?.id && (
                                <button
                                  onClick={() => deleteComment(post.id, c.id)}
                                  disabled={deletingCommentId === c.id}
                                  className="text-[10px] font-semibold text-content-tertiary hover:text-error transition-colors disabled:opacity-50"
                                >
                                  {deletingCommentId === c.id ? t('social.deleteComment.deleting') : t('common.delete')}
                                </button>
                              )}
                            </div>
                            {/* Replies */}
                            {c.replies?.map(r => (
                              <div key={r.id} className="flex gap-2 mt-2 ml-4">
                                <Avatar src={r.user.avatar_url} name={r.user.name} size="sm" />
                                <div className="flex-1">
                                  <div className="bg-surface-sunken rounded-md px-3 py-2">
                                    <p className="text-xs font-semibold text-content-primary">{r.user.name}</p>
                                    <p className="text-xs text-content-secondary mt-0.5">{r.content}</p>
                                  </div>
                                  {/* A reply is a comment too, and was equally
                                      impossible to take back. */}
                                  {r.user.id === user?.id && (
                                    <button
                                      onClick={() => deleteComment(post.id, r.id)}
                                      disabled={deletingCommentId === r.id}
                                      className="text-[10px] font-semibold text-content-tertiary hover:text-error transition-colors disabled:opacity-50 mt-1 ml-2"
                                    >
                                      {deletingCommentId === r.id ? t('social.deleteComment.deleting') : t('common.delete')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}

                            {replyingTo === c.id && (
                              <div className="flex gap-2 mt-2 ml-4">
                                <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size="sm" />
                                <div className="flex-1 flex gap-2">
                                  <input
                                    autoFocus
                                    value={replyInputs[c.id] ?? ''}
                                    onChange={e => setReplyInputs(v => ({ ...v, [c.id]: e.target.value }))}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(post.id, c.id); }
                                      if (e.key === 'Escape') setReplyingTo(null);
                                    }}
                                    placeholder={`Reply to ${c.user.name}...`}
                                    className="flex-1 px-3 py-2 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                                  <button onClick={() => submitReply(post.id, c.id)}
                                    disabled={replyingId === c.id || !replyInputs[c.id]?.trim()}
                                    className="w-8 h-8 bg-accent rounded-md flex items-center justify-center disabled:opacity-50 hover:bg-accent-hover transition-colors flex-shrink-0">
                                    {replyingId === c.id
                                      ? <Loader2 size={13} className="text-white animate-spin" />
                                      : <Send size={13} className="text-white" />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Comment input */}
                      <div className="flex gap-2.5 pt-1">
                        <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size="sm" />
                        <div className="flex-1 flex gap-2">
                          <input
                            value={commentInputs[post.id] ?? ''}
                            onChange={e => setCommentInputs(c => ({ ...c, [post.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(post.id); } }}
                            placeholder={t('social.writeComment')}
                            className="flex-1 px-3 py-2 rounded-md border border-border-strong bg-surface-sunken text-content-primary placeholder:text-content-tertiary text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                          <button onClick={() => submitComment(post.id)} disabled={commentingId === post.id || !commentInputs[post.id]?.trim()}
                            className="w-8 h-8 bg-accent rounded-md flex items-center justify-center disabled:opacity-50 hover:bg-accent-hover transition-colors flex-shrink-0">
                            {commentingId === post.id
                              ? <Loader2 size={13} className="text-white animate-spin" />
                              : <Send size={13} className="text-white" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Load more */}
              {page < lastPage && (
                <button onClick={() => loadFeed(page + 1, tab)} disabled={loadingMore}
                  className="w-full py-3 rounded-md border border-border-strong text-sm font-medium text-content-secondary hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-2">
                  {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loadingMore ? t('social.loading') : t('social.loadMore')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="hidden lg:block space-y-5">
          {/* My profile summary */}
          {user && (
            <div className="bg-surface-raised rounded-md border border-border-subtle shadow-sm p-4">
              <Link href={`/social/${(user as any).username ?? ''}`}>
                <div className="flex items-center gap-3 mb-3 hover:opacity-90 transition-opacity">
                  <Avatar src={user.avatar_url} name={user.name} size="sm" />
                  <div>
                    <p className="font-semibold text-content-primary text-sm">{user.name}</p>
                    <p className="text-xs text-content-tertiary">@{(user as any).username ?? 'you'}</p>
                  </div>
                </div>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/social/friends">
                  <div className="text-center p-2 bg-gray-50 dark:bg-white/[0.04] rounded-md hover:bg-accent-surface transition-colors cursor-pointer">
                    <p className="text-lg font-bold text-content-primary">{followingCount ?? '—'}</p>
                    <p className="text-xs text-content-tertiary">{t('social.following')}</p>
                  </div>
                </Link>
                <Link href="/social/friends">
                  <div className="text-center p-2 bg-gray-50 dark:bg-white/[0.04] rounded-md hover:bg-accent-surface transition-colors cursor-pointer">
                    <p className="text-lg font-bold text-content-primary">{followersCount ?? '—'}</p>
                    <p className="text-xs text-content-tertiary">{t('social.followers')}</p>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="bg-surface-raised rounded-md border border-border-subtle shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-content-primary text-sm">{t('social.peopleToFollow')}</h3>
              <Link href="/social/explore" className="text-xs text-accent font-medium hover:underline">{t('social.seeAll')}</Link>
            </div>
            {suggestionsLoading ? (
              <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-accent" /></div>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-content-tertiary text-center py-3">{t('social.noSuggestions')}</p>
            ) : suggestions.map(u => (
              <div key={u.id} className="flex items-center gap-3 py-2">
                <Link href={`/social/${u.username}`}>
                  <Avatar src={u.avatar_url} name={u.name} size="sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/social/${u.username}`}>
                    <p className="text-xs font-semibold text-content-primary truncate hover:text-accent transition-colors">{u.name}</p>
                  </Link>
                  <p className="text-[10px] text-content-tertiary truncate">@{u.username}</p>
                </div>
                <button onClick={() => followUser(u.id)}
                  className="flex-shrink-0 text-xs font-semibold text-accent bg-accent-surface hover:bg-accent hover:text-white px-2.5 py-1 rounded-lg transition-all">
                  {t('social.follow')}
                </button>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="bg-surface-raised rounded-md border border-border-subtle shadow-sm p-4">
            <div className="space-y-1">
              {[
                { icon: Users, label: t('social.friendsFollowers'), href: '/social/friends' },
                { icon: UserPlus, label: t('social.exploreMembers'), href: '/social/explore' },
              ].map(({ icon: Icon, label, href }) => (
                <Link key={label} href={href}>
                  <div className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <Icon size={16} className="text-accent" />
                    <span className="text-sm text-content-secondary">{label}</span>
                    <ChevronRight size={14} className="ml-auto text-content-tertiary" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
