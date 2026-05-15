'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { useUser } from '@/contexts/UserContext';
import { mockMembers } from '@/lib/mockData';
import { useSocialStore } from '@/store/socialStore';
import type { Reaction } from '@/store/socialStore';
import {
  Heart, MessageCircle, Share2, MoreHorizontal, Globe, ChevronRight,
  Users, UserPlus, Check, ThumbsUp, Send, ChevronDown, Bookmark,
  Trophy, Smile, Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';

const communityPhotos = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=200&h=200&fit=crop',
];

const hashtags = [
  '#fitness', '#workout', '#nutrition', '#teamextreme', '#transformation',
  '#gains', '#mealprep', '#hiit', '#motivation', '#weightloss',
];

const REACTIONS: Reaction[] = ['👍', '❤️', '🔥', '😍', '💪', '🎉'];
const REACTION_LABELS: Record<Reaction, string> = {
  '👍': 'Like', '❤️': 'Love', '🔥': 'Fire', '😍': 'Wow', '💪': 'Strong', '🎉': 'Celebrate',
};

export default function SocialPage() {
  const { user } = useUser();
  const {
    posts, toggleReaction, toggleComments, addPost, addComment,
    toggleCommentLike, toggleReplies, toggleReplyInput, addReply,
    toggleFollow, isFollowing,
  } = useSocialStore();

  const [tab, setTab] = useState<'foryou' | 'following'>('foryou');
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [reactionPicker, setReactionPicker] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [shareToast, setShareToast] = useState(false);

  const me = mockMembers[0];

  const visiblePosts = tab === 'following'
    ? posts.filter(p => isFollowing(p.author.id))
    : posts;

  const suggestedMembers = mockMembers.filter(m => !isFollowing(m.id)).slice(0, 3);

  const handlePost = () => {
    if (!postText.trim()) return;
    addPost({
      author: me,
      content: postText.trim(),
      images: postImage.trim() ? [postImage.trim()] : [],
      timeAgo: 'Just now',
      isAchievement: false,
    });
    setPostText('');
    setPostImage('');
    setShowImageInput(false);
  };

  const handleShare = () => {
    setShareToast(true);
    setTimeout(() => setShareToast(false), 3000);
  };

  const handleComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    addComment(postId, text, me);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  const handleReply = (postId: string, commentId: string) => {
    const key = `${postId}-${commentId}`;
    const text = replyInputs[key]?.trim();
    if (!text) return;
    addReply(postId, commentId, text, me);
    setReplyInputs(prev => ({ ...prev, [key]: '' }));
  };

  return (
    <DashboardShell fullWidth>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="hidden lg:block space-y-4">
            {/* My profile card */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/[0.07] shadow-sm">
              <div className="h-24 bg-gradient-to-r from-[#F87404] to-[#FF5C04]" />
              <div className="px-5 pb-5">
                <div className="-mt-10 mb-3">
                  <div className="w-20 h-20 rounded-full border-4 border-white dark:border-[#1a1a1a] shadow-md overflow-hidden">
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                </div>
                <h2 className="font-bold text-gray-900 dark:text-white text-base">{user.name}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{user.bio}</p>
                <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.07]">
                  {[
                    { value: user.friends, label: 'Friends' },
                    { value: user.followers, label: 'Followers' },
                    { value: user.following, label: 'Following' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="font-bold text-gray-900 dark:text-white text-base">{s.value}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm overflow-hidden">
              {[
                { icon: Users, label: 'Discover Members', href: '/social/explore' },
                { icon: UserPlus, label: 'My Profile', href: '/profile' },
                { icon: Heart, label: 'Friends', href: '/social/friends' },
              ].map(({ icon: Icon, label, href }) => (
                <Link key={label} href={href}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors border-b border-gray-50 dark:border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                      <Icon size={15} className="text-[#F87404]" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
              ))}
            </div>

            {/* Trending hashtags */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Trending Hashtags</h3>
              <div className="flex flex-wrap gap-2">
                {hashtags.map(tag => (
                  <span key={tag}
                    className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-[#F87404]/10 hover:text-[#F87404] text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-full cursor-pointer transition-colors">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          {/* ── CENTER FEED ── */}
          <div className="space-y-4 min-w-0">

            {/* Stories */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm p-4">
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                {mockMembers.map(m => (
                  <Link key={m.id} href={`/social/${m.username}`}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                    <div className={`w-14 h-14 rounded-full p-0.5 ${m.isOnline ? 'bg-gradient-to-br from-[#F87404] to-[#FF5C04]' : 'bg-gray-200 dark:bg-white/20'}`}>
                      <div className="w-full h-full rounded-full border-2 border-white dark:border-[#1a1a1a] overflow-hidden">
                        <img src={m.avatar} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium text-center w-14 truncate">
                      {m.name.split(' ')[0]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Feed tabs */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] p-1.5 shadow-sm">
              {([['foryou', 'For You'], ['following', 'Following']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === id
                      ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/25'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Post composer */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm p-4">
              <div className="flex gap-3 mb-3">
                <Avatar src={user.avatar} name={user.name} size={40} online />
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder={`Share your progress, ${user.name.split(' ')[0]}! 💪`}
                  rows={2}
                  className="flex-1 resize-none text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none border-0 bg-transparent"
                />
              </div>
              {showImageInput && (
                <div className="mb-3">
                  <input
                    type="url"
                    value={postImage}
                    onChange={e => setPostImage(e.target.value)}
                    placeholder="Paste a direct image URL ending in .jpg, .png, .webp…"
                    className="w-full text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:border-[#F87404] transition-colors"
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/[0.07]">
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowImageInput(v => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      showImageInput
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}>
                    <ImageIcon size={14} style={{ color: '#10B981' }} /> Photo
                  </button>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <Trophy size={14} style={{ color: '#F87404' }} /> Achievement
                  </button>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <Smile size={14} style={{ color: '#FACC15' }} /> Feeling
                  </button>
                </div>
                <button onClick={handlePost} disabled={!postText.trim()}
                  className="bg-[#F87404] hover:bg-[#FF5C04] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all shadow-sm">
                  Post
                </button>
              </div>
            </div>

            {/* Empty Following state */}
            {tab === 'following' && visiblePosts.length === 0 && (
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] p-12 text-center">
                <div className="text-4xl mb-3">👥</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No posts yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Follow some members to see their posts here.</p>
                <Link href="/social/explore">
                  <button className="bg-[#F87404] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#e06000] transition-colors">
                    Discover Members
                  </button>
                </Link>
              </div>
            )}

            {/* Posts */}
            {visiblePosts.map(post => (
              <div key={post.id} className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/[0.07] shadow-sm overflow-hidden">

                {/* Header */}
                <div className="flex items-start justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Link href={`/social/${post.author.username}`}>
                      <Avatar src={post.author.avatar} name={post.author.name} size={44} online={post.author.isOnline} />
                    </Link>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link href={`/social/${post.author.username}`}>
                          <span className="font-semibold text-sm text-gray-900 dark:text-white hover:text-[#F87404] transition-colors">
                            {post.author.name}
                          </span>
                        </Link>
                        {post.isAchievement && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                            🏆 Achievement
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">{post.timeAgo}</span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <Globe size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-400">Public</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                {/* Achievement card visual */}
                {post.isAchievement && post.achievementPoster && (
                  <div className="px-4 pb-2">
                    <div className="relative rounded-2xl overflow-hidden h-40">
                      <img src={post.achievementPoster} alt={post.achievementTitle} className="w-full h-full object-cover"
                        onError={e => { const p = (e.currentTarget as HTMLImageElement).parentElement; if (p) p.style.display = 'none'; }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
                        <div>
                          <div className="text-3xl mb-1">{post.achievementIcon}</div>
                          <div className="font-bold text-white text-sm">{post.achievementTitle}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="px-4 pb-3">
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{post.content}</p>
                </div>

                {/* Images (non-achievement) */}
                {post.images.length > 0 && !post.achievementPoster && (
                  <div className={`grid gap-0.5 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {post.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full object-cover max-h-80"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                )}

                {/* Reaction summary row */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 dark:border-white/[0.04]">
                  <div className="flex items-center gap-1.5">
                    {post.likes > 0 && (
                      <>
                        <div className="flex -space-x-1">
                          {['👍', '❤️', '🔥'].map(e => (
                            <span key={e} className="w-5 h-5 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px]">{e}</span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{post.likes.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                  <button onClick={() => toggleComments(post.id)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                    {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
                  </button>
                </div>

                {/* Action bar */}
                <div className="flex items-center border-t border-gray-100 dark:border-white/[0.07]">

                  {/* Reaction button + hover picker — bridge prevents gap flicker */}
                  <div className="relative flex-1"
                    onMouseEnter={() => setReactionPicker(post.id)}
                    onMouseLeave={() => setReactionPicker(null)}
                  >
                    <button
                      onClick={() => toggleReaction(post.id, post.myReaction ?? '👍')}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] ${
                        post.myReaction ? 'text-[#F87404]' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {post.myReaction
                        ? <span className="text-base leading-none">{post.myReaction}</span>
                        : <ThumbsUp size={16} />
                      }
                      <span>{post.myReaction ? REACTION_LABELS[post.myReaction] : 'Like'}</span>
                    </button>

                    {reactionPicker === post.id && (
                      <div className="absolute bottom-full left-2 z-20">
                        <div className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 mb-1">
                          {REACTIONS.map(emoji => (
                            <button key={emoji}
                              onClick={() => { toggleReaction(post.id, emoji); setReactionPicker(null); }}
                              className="text-xl hover:scale-125 transition-transform active:scale-95 w-8 h-8 flex items-center justify-center">
                              {emoji}
                            </button>
                          ))}
                        </div>
                        {/* Invisible bridge: fills gap between popup and button so onMouseLeave doesn't fire */}
                        <div className="h-2" />
                      </div>
                    )}
                  </div>

                  <button onClick={() => toggleComments(post.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                    <MessageCircle size={16} /> Comment
                  </button>
                  <button onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                    <Share2 size={16} /> Share
                  </button>
                  <button className="flex items-center justify-center py-2.5 px-4 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                    <Bookmark size={16} />
                  </button>
                </div>

                {/* Threaded comments */}
                {post.commentsOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-50 dark:border-white/[0.04] space-y-3 bg-gray-50/50 dark:bg-white/[0.02]">
                    {post.comments.map(comment => (
                      <div key={comment.id} className="flex gap-2.5">
                        <img src={comment.author.avatar} alt={comment.author.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        <div className="flex-1 min-w-0">
                          <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl px-3 py-2 border border-gray-100 dark:border-white/[0.07]">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white mr-1.5">{comment.author.name}</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300">{comment.text}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 ml-1 flex-wrap">
                            <button onClick={() => toggleCommentLike(post.id, comment.id)}
                              className={`text-[11px] font-semibold transition-colors ${comment.likedByMe ? 'text-[#F87404]' : 'text-gray-400 hover:text-[#F87404]'}`}>
                              {comment.likedByMe ? '❤️' : 'Like'}{comment.likes > 0 ? ` ${comment.likes}` : ''}
                            </button>
                            <button onClick={() => toggleReplyInput(post.id, comment.id)}
                              className="text-[11px] text-gray-400 hover:text-[#F87404] transition-colors font-semibold">
                              Reply
                            </button>
                            <span className="text-[10px] text-gray-300 dark:text-gray-600">{comment.timeAgo}</span>
                            {comment.replies.length > 0 && (
                              <button onClick={() => toggleReplies(post.id, comment.id)}
                                className="text-[11px] text-gray-400 hover:text-[#F87404] transition-colors font-medium flex items-center gap-0.5">
                                <ChevronDown size={11} className={`transition-transform ${comment.showReplies ? 'rotate-180' : ''}`} />
                                {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                          </div>

                          {/* Replies */}
                          {comment.showReplies && comment.replies.length > 0 && (
                            <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100 dark:border-white/[0.07]">
                              {comment.replies.map(reply => (
                                <div key={reply.id} className="flex gap-2">
                                  <img src={reply.author.avatar} alt={reply.author.name}
                                    className="w-6 h-6 rounded-full object-cover shrink-0"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="bg-white dark:bg-[#2a2a2a] rounded-xl px-2.5 py-1.5 border border-gray-100 dark:border-white/[0.07]">
                                      <span className="text-[11px] font-semibold text-gray-900 dark:text-white mr-1">{reply.author.name}</span>
                                      <span className="text-[11px] text-gray-700 dark:text-gray-300">{reply.text}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 ml-1">
                                      <span className="text-[10px] text-gray-300 dark:text-gray-600">{reply.timeAgo}</span>
                                      {reply.likes > 0 && <span className="text-[10px] text-gray-400">{reply.likes} likes</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply input */}
                          {comment.replyInputOpen && (
                            <div className="flex gap-2 mt-2">
                              <img src={me.avatar} alt={me.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                              <div className="flex-1 flex gap-2">
                                <input
                                  value={replyInputs[`${post.id}-${comment.id}`] ?? ''}
                                  onChange={e => setReplyInputs(prev => ({ ...prev, [`${post.id}-${comment.id}`]: e.target.value }))}
                                  onKeyDown={e => e.key === 'Enter' && handleReply(post.id, comment.id)}
                                  placeholder={`Reply to ${comment.author.name.split(' ')[0]}…`}
                                  className="flex-1 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:border-[#F87404] transition-colors"
                                />
                                <button onClick={() => handleReply(post.id, comment.id)}
                                  className="w-7 h-7 rounded-lg bg-[#F87404] flex items-center justify-center shrink-0 hover:bg-[#FF5C04] transition-colors">
                                  <Send size={12} className="text-white" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add comment */}
                    <div className="flex gap-2.5 pt-1">
                      <Avatar src={user.avatar} name={user.name} size={32} online />
                      <div className="flex-1 flex gap-2">
                        <input
                          value={commentInputs[post.id] ?? ''}
                          onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                          placeholder="Write a comment…"
                          className="flex-1 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-2 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:border-[#F87404] transition-colors"
                        />
                        <button onClick={() => handleComment(post.id)}
                          className="w-8 h-8 rounded-xl bg-[#F87404] flex items-center justify-center shrink-0 hover:bg-[#FF5C04] transition-colors">
                          <Send size={14} className="text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <aside className="hidden lg:block space-y-4">
            {/* Suggested members */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Suggested Members</h3>
                <Link href="/social/explore" className="text-xs text-[#F87404] font-medium hover:underline">See all</Link>
              </div>
              <div className="space-y-3">
                {suggestedMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Link href={`/social/${m.username}`}>
                      <Avatar src={m.avatar} name={m.name} size={40} online={m.isOnline} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.followers.toLocaleString()} followers</p>
                    </div>
                    <button onClick={() => toggleFollow(m.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                        isFollowing(m.id)
                          ? 'bg-gray-100 dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                          : 'border-[#F87404] text-[#F87404] hover:bg-[#F87404] hover:text-white'
                      }`}>
                      {isFollowing(m.id) ? 'Following' : 'Follow'}
                    </button>
                  </div>
                ))}
                {suggestedMembers.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">You're following everyone! 🎉</p>
                )}
              </div>
            </div>

            {/* Community photos */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Latest Community Photos</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {communityPhotos.map((src, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden cursor-pointer">
                    <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
            </div>

            {/* Latest members */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Latest Members</h3>
              <div className="grid grid-cols-4 gap-2">
                {mockMembers.map(m => (
                  <Link key={m.id} href={`/social/${m.username}`} className="flex flex-col items-center gap-1">
                    <Avatar src={m.avatar} name={m.name} size={48} online={m.isOnline} />
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 text-center truncate w-full">{m.name.split(' ')[0]}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Active now */}
            <div className="bg-gradient-to-br from-[#F87404] to-[#FF5C04] rounded-2xl p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <h3 className="font-semibold text-sm">Active Now</h3>
              </div>
              <div className="flex -space-x-2">
                {mockMembers.filter(m => m.isOnline).map(m => (
                  <div key={m.id} className="w-9 h-9 rounded-full border-2 border-[#F87404] overflow-hidden">
                    <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/80 mt-2">
                {mockMembers.filter(m => m.isOnline).length} members online now
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Share toast */}
      {shareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium whitespace-nowrap">
          <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center shrink-0">
            <Check size={12} className="text-white dark:text-gray-900" />
          </div>
          Post shared!
        </div>
      )}
    </DashboardShell>
  );
}
