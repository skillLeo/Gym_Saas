'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { mockMembers, mockPosts, mockComments } from '@/lib/mockData';
import {
  ChevronLeft, MessageCircle, Heart, MoreHorizontal, Grid3X3,
  MapPin, Dumbbell, Trophy, Flame, Calendar, UserPlus, UserCheck,
  Camera, Link2, Share2, Check, Users, Eye, ThumbsUp, Bookmark,
  MessageSquare, Star, Bell, Flag
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Tab = 'stream' | 'about' | 'friends' | 'followers' | 'groups';

const reactionEmojis = ['👍', '❤️', '🔥', '😍', '💪', '🎉'];

const communityPhotos = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=300&h=300&fit=crop',
];

export default function UserProfilePage() {
  const params = useParams();
  const username = params?.username as string;

  const member = mockMembers.find(m => m.username === username) || mockMembers[0];
  const [isFollowing, setIsFollowing] = useState(member.isFollowing);
  const [isFriend, setIsFriend] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('stream');
  const [activeReaction, setActiveReaction] = useState<Record<string, string>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [posts, setPosts] = useState(
    mockPosts.filter((_, i) => i % 2 === 0).map(p => ({
      ...p,
      localLiked: p.isLiked,
      localLikes: p.likes,
      showComments: false,
    }))
  );

  const toggleLike = (id: string) => {
    setPosts(prev => prev.map(p =>
      p.id === id
        ? { ...p, localLiked: !p.localLiked, localLikes: p.localLiked ? p.localLikes - 1 : p.localLikes + 1 }
        : p
    ));
  };

  const toggleComments = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, showComments: !p.showComments } : p));
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'stream', label: 'Stream' },
    { id: 'about', label: 'About' },
    { id: 'friends', label: 'Friends', count: member.friends },
    { id: 'followers', label: 'Followers', count: member.followers },
    { id: 'groups', label: 'Groups', count: 4 },
  ];

  return (
    <DashboardShell>
      {/* ── COVER PHOTO ── */}
      <div className="relative">
        <div className="h-52 sm:h-72 lg:h-80 overflow-hidden bg-gradient-to-br from-[#F87404]/30 to-[#FF0404]/20">
          {member.coverPhoto ? (
            <img src={member.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#F87404] via-[#FF5C04] to-[#FF0404]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
        </div>

        {/* Top action buttons */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link href="/social">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
              <ChevronLeft size={18} className="text-white" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
              <Share2 size={16} className="text-white" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors">
              <MoreHorizontal size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Cover photo edit hint */}
        <div className="absolute bottom-4 right-4">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 transition-colors text-white text-xs">
            <Camera size={12} />
            Edit Cover
          </button>
        </div>
      </div>

      {/* ── PROFILE HEADER (white/dark card below cover) ── */}
      <div className="bg-white dark:bg-[#111] border-b border-gray-100 dark:border-white/[0.07] shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-16 pb-4 relative z-10">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-white dark:bg-[#111] shadow-xl">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {member.isOnline && (
                <span className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-green-500 border-3 border-white dark:border-[#111] shadow-sm" />
              )}
              <button className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100">
                <Camera size={18} className="text-white" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                  isLiked
                    ? 'bg-red-500/10 border-red-500/30 text-red-500'
                    : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-red-400/40'
                }`}
              >
                <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">Like</span>
              </button>

              <Link href="/messages">
                <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#004AAD]/40 transition-all">
                  <MessageCircle size={15} />
                  <span className="hidden sm:inline">Message</span>
                </button>
              </Link>

              <button
                onClick={() => setIsFriend(!isFriend)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                  isFriend
                    ? 'bg-[#004AAD]/10 border-[#004AAD]/30 text-[#004AAD]'
                    : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#004AAD]/40'
                }`}
              >
                {isFriend ? <UserCheck size={15} /> : <UserPlus size={15} />}
                <span className="hidden sm:inline">{isFriend ? 'Friends' : 'Add Friend'}</span>
              </button>

              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isFollowing
                    ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/20'
                    : 'bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white shadow-md hover:shadow-orange-500/25 hover:shadow-lg'
                }`}
              >
                {isFollowing ? <Check size={15} /> : <Bell size={15} />}
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            </div>
          </div>

          {/* Name + bio */}
          <div className="pb-4">
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                {member.name}
              </h1>
              {/* Verified badge */}
              <div className="w-6 h-6 rounded-full bg-[#004AAD] flex items-center justify-center shrink-0">
                <Check size={12} className="text-white" strokeWidth={3} />
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30">
                <Star size={10} className="text-amber-500 fill-amber-500" />
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">PRO</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">@{member.username}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 max-w-xl leading-relaxed">{member.bio}</p>

            {/* Meta info row */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-[#F87404]" />
                United States
              </span>
              <span className="flex items-center gap-1">
                <Dumbbell size={12} className="text-[#004AAD]" />
                {member.goal}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Joined Jan 2024
              </span>
              <span className="flex items-center gap-1">
                <Link2 size={12} className="text-[#F87404]" />
                <a href="#" className="text-[#F87404] hover:underline">myextremetrainer.com</a>
              </span>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-stretch gap-0 border-t border-gray-100 dark:border-white/[0.07] py-4 -mx-4 px-4 overflow-x-auto">
            {[
              { label: 'Posts', val: posts.length, icon: Grid3X3, color: '#F87404' },
              { label: 'Friends', val: member.friends, icon: Users, color: '#10B981' },
              { label: 'Followers', val: member.followers, icon: UserCheck, color: '#004AAD' },
              { label: 'Following', val: member.following, icon: UserPlus, color: '#7C3AED' },
              { label: 'Profile Views', val: '2.4K', icon: Eye, color: '#9ca3af' },
              { label: 'Streak', val: '16 🔥', icon: Flame, color: '#F87404' },
            ].map(({ label, val, icon: Icon, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 px-4 sm:px-6 shrink-0 first:pl-0 border-r border-gray-100 dark:border-white/[0.07] last:border-r-0">
                <div className="font-display text-xl font-bold text-gray-900 dark:text-white">
                  {typeof val === 'number' ? val.toLocaleString() : val}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Icon size={11} style={{ color }} />
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0 -mx-1 overflow-x-auto border-t border-gray-100 dark:border-white/[0.07]">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#F87404]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.id
                      ? 'bg-[#F87404]/15 text-[#F87404]'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-400'
                  }`}>{tab.count}</span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F87404] to-[#FF5C04] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 py-5">

        {/* STREAM TAB */}
        {activeTab === 'stream' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

            {/* Posts feed */}
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/[0.07] shadow-sm overflow-hidden">
                  {/* Post header */}
                  <div className="flex items-start gap-3 p-4 pb-3">
                    <img src={member.avatar} alt={member.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-[#F87404]/20 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">{member.name}</span>
                        <div className="w-4 h-4 rounded-full bg-[#004AAD] flex items-center justify-center">
                          <Check size={9} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{post.timeAgo}</div>
                    </div>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-400">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>

                  {/* Post text */}
                  <div className="px-4 pb-3">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{post.content}</p>
                  </div>

                  {/* Post images */}
                  {post.images.length > 0 && (
                    <div className={`grid gap-0.5 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {post.images.slice(0, 4).map((img, i) => (
                        <div key={i} className={`overflow-hidden ${post.images.length === 1 ? 'rounded-none' : i === 0 && post.images.length === 3 ? 'row-span-2' : ''}`}>
                          <img src={img} alt="" className="w-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                            style={{ height: post.images.length === 1 ? 280 : 180 }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reaction counts */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 dark:border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1">
                        {['👍', '❤️', '🔥'].map(e => (
                          <span key={e} className="w-5 h-5 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px]">{e}</span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{post.localLikes.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-gray-400">{post.comments} comments</span>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center border-t border-gray-100 dark:border-white/[0.07]">
                    {/* Like with reaction picker */}
                    <div className="relative flex-1">
                      <button
                        onMouseEnter={() => setShowReactionPicker(post.id)}
                        onMouseLeave={() => setShowReactionPicker(null)}
                        onClick={() => toggleLike(post.id)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] ${
                          post.localLiked ? 'text-[#F87404]' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {activeReaction[post.id]
                          ? <span className="text-base">{activeReaction[post.id]}</span>
                          : <ThumbsUp size={16} fill={post.localLiked ? 'currentColor' : 'none'} />
                        }
                        <span>{activeReaction[post.id] ? activeReaction[post.id] === '👍' ? 'Like' : activeReaction[post.id] === '❤️' ? 'Love' : activeReaction[post.id] === '🔥' ? 'Fire' : 'React' : 'Like'}</span>
                      </button>
                      {showReactionPicker === post.id && (
                        <div
                          className="absolute bottom-full left-2 mb-2 flex items-center gap-1 px-3 py-2 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 z-20"
                          onMouseEnter={() => setShowReactionPicker(post.id)}
                          onMouseLeave={() => setShowReactionPicker(null)}
                        >
                          {reactionEmojis.map(emoji => (
                            <button key={emoji}
                              onClick={() => {
                                setActiveReaction(prev => ({ ...prev, [post.id]: emoji }));
                                setShowReactionPicker(null);
                                setPosts(prev => prev.map(p =>
                                  p.id === post.id ? { ...p, localLiked: true, localLikes: p.localLiked ? p.localLikes : p.localLikes + 1 } : p
                                ));
                              }}
                              className="text-xl hover:scale-125 transition-transform active:scale-95 w-8 h-8 flex items-center justify-center"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <MessageCircle size={16} />
                      Comment
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                      <Share2 size={16} />
                      Share
                    </button>
                    <button className="flex items-center justify-center py-2.5 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                      <Bookmark size={16} />
                    </button>
                  </div>

                  {/* Comments */}
                  {post.showComments && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-50 dark:border-white/[0.04] space-y-3">
                      {mockComments.slice(0, 2).map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <img src={c.author.avatar} alt={c.author.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <div className="flex-1">
                            <div className="bg-gray-50 dark:bg-white/[0.05] rounded-2xl px-3 py-2">
                              <span className="text-xs font-semibold text-gray-900 dark:text-white mr-1.5">{c.author.name}</span>
                              <span className="text-xs text-gray-700 dark:text-gray-300">{c.text}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-2">
                              <button className="text-[10px] text-gray-400 hover:text-[#F87404] transition-colors font-medium">Like</button>
                              <button className="text-[10px] text-gray-400 hover:text-[#F87404] transition-colors font-medium">Reply</button>
                              <span className="text-[10px] text-gray-300 dark:text-gray-600">{c.timeAgo}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2.5">
                        <img src={mockMembers[0].avatar} alt="me" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        <input
                          placeholder="Write a comment…"
                          className="flex-1 bg-gray-50 dark:bg-white/[0.05] rounded-2xl px-3 py-2 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 border-none outline-none focus:ring-2 focus:ring-[#F87404]/20"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right sidebar for stream */}
            <aside className="space-y-4">
              {/* Fitness highlights */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.07] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Fitness Highlights</h3>
                  <Trophy size={15} className="text-amber-500" />
                </div>
                <div className="p-3 space-y-2">
                  {[
                    { label: '16 Day Streak', sub: 'Keep it up!', icon: '🔥', color: '#F87404' },
                    { label: '4 Achievements', sub: 'Latest: Iron Will', icon: '🏆', color: '#FFC000' },
                    { label: 'Strength Goal', sub: '78% complete', icon: '💪', color: '#004AAD' },
                    { label: '12 Workouts', sub: 'This month', icon: '🏋️', color: '#10B981' },
                  ].map(({ label, sub, icon, color }) => (
                    <div key={label} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: color + '18' }}>
                        {icon}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-900 dark:text-white">{label}</div>
                        <div className="text-[10px] text-gray-400">{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photos */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.07] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Photos</h3>
                  <button className="text-xs text-[#F87404] font-medium hover:underline">See all</button>
                </div>
                <div className="grid grid-cols-3 gap-0.5 p-0.5">
                  {communityPhotos.map((img, i) => (
                    <div key={i} className="aspect-square overflow-hidden">
                      <img src={img} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-300 cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Mutual Friends */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.07]">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Mutual Friends <span className="text-gray-400 font-normal">· {member.friends}</span></h3>
                </div>
                <div className="p-3 grid grid-cols-3 gap-2">
                  {mockMembers.slice(1, 7).map(m => (
                    <Link key={m.id} href={`/social/${m.username}`}>
                      <div className="flex flex-col items-center gap-1 cursor-pointer group">
                        <img src={m.avatar} alt={m.name}
                          className="w-14 h-14 rounded-xl object-cover group-hover:scale-105 transition-transform ring-2 ring-transparent group-hover:ring-[#F87404]/30" />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 text-center line-clamp-1">{m.name.split(' ')[0]}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <div className="max-w-2xl space-y-4">
            {[
              {
                title: 'Personal Info',
                items: [
                  { icon: '👤', label: 'Full Name', val: member.name },
                  { icon: '📍', label: 'Location', val: 'United States' },
                  { icon: '📅', label: 'Joined', val: 'January 2024' },
                  { icon: '🎯', label: 'Goal', val: member.goal },
                ]
              },
              {
                title: 'Fitness Profile',
                items: [
                  { icon: '🏋️', label: 'Specialty', val: 'Strength & Conditioning' },
                  { icon: '🔥', label: 'Current Streak', val: '16 days' },
                  { icon: '📊', label: 'Level', val: 'Intermediate' },
                  { icon: '⏱️', label: 'Avg Workout', val: '52 minutes' },
                ]
              },
            ].map(section => (
              <div key={section.title} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.07]">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                  {section.items.map(({ icon, label, val }) => (
                    <div key={label} className="flex items-center gap-4 px-5 py-3">
                      <span className="text-lg w-6 text-center">{icon}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-32 shrink-0">{label}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Badges / Achievements */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.07]">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Achievements</h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: '🔥', title: '30 Day Streak', date: 'Apr 2025' },
                  { icon: '🏋️', title: 'First 200lb Lift', date: 'Mar 2025' },
                  { icon: '🏃', title: '5K Personal Best', date: 'Feb 2025' },
                  { icon: '⚖️', title: '10 lbs Lost', date: 'Jan 2025' },
                ].map(({ icon, title, date }) => (
                  <div key={title} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-white/[0.04] rounded-2xl text-center hover:bg-[#F87404]/5 dark:hover:bg-[#F87404]/10 transition-colors">
                    <div className="text-3xl mb-2">{icon}</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{title}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{date}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FRIENDS TAB */}
        {activeTab === 'friends' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <input
                  placeholder={`Search ${member.name.split(' ')[0]}'s friends…`}
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#F87404]/20"
                />
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {mockMembers.map(m => (
                <Link key={m.id} href={`/social/${m.username}`}>
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                    <div className="h-20 bg-gradient-to-br from-[#F87404]/20 to-[#FF5C04]/10 relative">
                      {m.coverPhoto && <img src={m.coverPhoto} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="px-3 pb-3 -mt-7">
                      <div className="relative w-14 h-14 mb-2">
                        <img src={m.avatar} alt={m.name} className="w-14 h-14 rounded-full object-cover ring-3 ring-white dark:ring-[#1a1a1a]" />
                        {m.isOnline && <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-[#1a1a1a]" />}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{m.name}</div>
                      <div className="text-xs text-gray-400 mb-2.5">@{m.username}</div>
                      <button className="w-full py-1.5 rounded-xl text-xs font-semibold bg-[#F87404]/10 text-[#F87404] hover:bg-[#F87404]/20 transition-colors">
                        View Profile
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* FOLLOWERS TAB */}
        {activeTab === 'followers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {mockMembers.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3.5 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm">
                <Link href={`/social/${m.username}`}>
                  <img src={m.avatar} alt={m.name} className="w-12 h-12 rounded-full object-cover shrink-0 hover:scale-105 transition-transform" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.name}</div>
                  <div className="text-xs text-gray-400 truncate">@{m.username}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{m.followers.toLocaleString()} followers</div>
                </div>
                <button className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F87404]/10 text-[#F87404] hover:bg-[#F87404]/20 transition-colors whitespace-nowrap">
                  Follow back
                </button>
              </div>
            ))}
          </div>
        )}

        {/* GROUPS TAB */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {[
              { name: 'Team Extreme Athletes', members: 248, img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=200&fit=crop', tag: 'Fitness' },
              { name: 'Nutrition & Meal Prep', members: 183, img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=200&fit=crop', tag: 'Nutrition' },
              { name: 'Morning Warriors 5AM Club', members: 92, img: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&h=200&fit=crop', tag: 'Lifestyle' },
              { name: 'Transformation Stories', members: 317, img: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=200&fit=crop', tag: 'Motivation' },
            ].map(group => (
              <div key={group.name} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                <div className="h-28 overflow-hidden">
                  <img src={group.img} alt={group.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{group.name}</h4>
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[#F87404]/10 text-[#F87404] font-medium">{group.tag}</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                    <Users size={11} />
                    {group.members} members
                  </div>
                  <button className="w-full py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white hover:opacity-90 transition-opacity">
                    View Group
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-24" />
      </div>
    </DashboardShell>
  );
}
