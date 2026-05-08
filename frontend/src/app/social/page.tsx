'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/contexts/UserContext';
import {
  mockMembers, mockPosts, mockComments,
} from '@/lib/mockData';
import {
  Heart, MessageCircle, Share2, MoreHorizontal, Image,
  Trophy, Smile, Plus, Globe, ChevronRight, Flame, Users,
  UserPlus, Check,
} from 'lucide-react';

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
  '#gains', '#mealprep', '#hiit', '#motivation', '#weightloss', '#running', '#yoga',
];

export default function SocialPage() {
  const { user } = useUser();
  const [posts, setPosts] = useState(mockPosts.map(p => ({ ...p, liked: p.isLiked, likes: p.likes })));
  const [following, setFollowing] = useState<Record<string, boolean>>(
    Object.fromEntries(mockMembers.map(m => [m.id, m.isFollowing]))
  );
  const [postText, setPostText] = useState('');
  const [expandedComments, setExpandedComments] = useState<string | null>(null);

  const toggleLike = (id: string) => {
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  };

  const toggleFollow = (id: string) => setFollowing(prev => ({ ...prev, [id]: !prev[id] }));

  const suggestedMembers = mockMembers.filter(m => !m.isFollowing).slice(0, 3);

  return (
    <DashboardShell fullWidth>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="space-y-4">
            {/* Profile card */}
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <div className="h-24 bg-gradient-to-r from-[#F87404] to-[#FF5C04]" />
              <div className="px-5 pb-5">
                <div className="-mt-10 mb-3">
                  <div className="w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden">
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                <h2 className="font-bold text-gray-900 text-base">{user.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{user.bio}</p>
                <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                  {[
                    { value: user.friends, label: 'Friends' },
                    { value: user.followers, label: 'Followers' },
                    { value: user.following, label: 'Following' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="font-bold text-gray-900 text-base">{s.value}</p>
                      <p className="text-[10px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {[
                { icon: Users, label: 'Discover Members', href: '/social/explore' },
                { icon: UserPlus, label: 'My Profile', href: '/profile' },
                { icon: Heart, label: 'Friends', href: '/social/friends' },
              ].map(({ icon: Icon, label, href }) => (
                <a key={label} href={href} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                      <Icon size={15} className="text-[#F87404]" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-400" />
                </a>
              ))}
            </div>

            {/* Trending hashtags */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Trending Hashtags</h3>
              <div className="flex flex-wrap gap-2">
                {hashtags.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 hover:bg-[#F87404]/10 hover:text-[#F87404] text-gray-600 px-2.5 py-1 rounded-full cursor-pointer transition-colors">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          {/* ── CENTER FEED ── */}
          <div className="space-y-4 min-w-0">
            {/* Stories */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                {mockMembers.map(m => (
                  <div key={m.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                    <div className={`w-14 h-14 rounded-full p-0.5 ${m.isOnline ? 'bg-gradient-to-br from-[#F87404] to-[#FF5C04]' : 'bg-gray-200'}`}>
                      <div className="w-full h-full rounded-full border-2 border-white overflow-hidden">
                        <img src={m.avatar} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-600 font-medium text-center w-14 truncate">{m.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Post composer */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-3 mb-3">
                <Avatar src={user.avatar} name={user.name} size={40} online />
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder={`Share your progress, ${user.name.split(' ')[0]}! 💪`}
                  rows={2}
                  className="flex-1 resize-none text-sm text-gray-900 placeholder-gray-400 outline-none border-0 bg-transparent"
                />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex gap-1">
                  {[
                    { icon: Image, label: 'Photo', color: '#10B981' },
                    { icon: Trophy, label: 'Achievement', color: '#F87404' },
                    { icon: Smile, label: 'Feeling', color: '#FACC15' },
                  ].map(({ icon: Icon, label, color }) => (
                    <button key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                      <Icon size={14} style={{ color }} />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  disabled={!postText.trim()}
                  className="bg-[#F87404] hover:bg-[#e06000] text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-40 shadow-sm"
                >
                  Post
                </button>
              </div>
            </div>

            {/* Posts */}
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Post header */}
                <div className="flex items-start justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar src={post.author.avatar} name={post.author.name} size={44} online={post.author.isOnline} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-gray-900">{post.author.name}</span>
                        {post.author.isOnline && (
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                            <circle cx="7.5" cy="7.5" r="7.5" fill="#10B981" />
                            <path d="M4 7.5l2.5 2.5L11 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {post.isAchievement && <Badge variant="warning">🏆 Achievement</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">{post.timeAgo}</span>
                        <span className="text-gray-300">·</span>
                        <Globe size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-400">Public</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="px-4 pb-3">
                  <p className="text-sm text-gray-800 leading-relaxed">{post.content}</p>
                </div>

                {/* Images */}
                {post.images.length > 0 && (
                  <div className={`grid gap-1 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {post.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full object-cover max-h-80" />
                    ))}
                  </div>
                )}

                {/* Reactions + comment count */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50">
                  <div className="flex items-center gap-1">
                    <span className="text-base">🔥❤️🔥</span>
                    <span className="text-xs text-gray-500 ml-1">{post.likes} reactions</span>
                  </div>
                  <button
                    onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {post.comments} comments
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 ${post.liked ? 'text-[#F87404]' : 'text-gray-500'}`}
                  >
                    <Heart size={16} fill={post.liked ? 'currentColor' : 'none'} />
                    {post.liked ? 'Liked' : 'Like'}
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                    <MessageCircle size={16} /> Comment
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                    <Share2 size={16} /> Share
                  </button>
                </div>

                {/* Comments */}
                {expandedComments === post.id && (
                  <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-50/50">
                    {mockComments.map(c => (
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar src={c.author.avatar} name={c.author.name} size={32} />
                        <div className="bg-white rounded-xl px-3 py-2 flex-1 border border-gray-100">
                          <p className="text-xs font-semibold text-gray-900">{c.author.name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{c.text}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2.5 mt-3">
                      <Avatar src={user.avatar} name={user.name} size={32} />
                      <input placeholder="Write a comment..." className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-[#F87404]" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <aside className="space-y-4">
            {/* Suggested members */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Suggested Members</h3>
                <a href="/social/explore" className="text-xs text-[#F87404] font-medium hover:underline">See all</a>
              </div>
              <div className="space-y-3">
                {suggestedMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar src={m.avatar} name={m.name} size={40} online={m.isOnline} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.followers.toLocaleString()} followers</p>
                    </div>
                    <button
                      onClick={() => toggleFollow(m.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${following[m.id] ? 'bg-gray-100 border-gray-200 text-gray-600' : 'border-[#F87404] text-[#F87404] hover:bg-[#F87404] hover:text-white'}`}
                    >
                      {following[m.id] ? 'Following' : 'Follow'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Community photos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Latest Community Photos</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {communityPhotos.map((src, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden cursor-pointer">
                    <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
            </div>

            {/* Latest members */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Latest Members</h3>
              <div className="grid grid-cols-4 gap-2">
                {mockMembers.map(m => (
                  <div key={m.id} className="flex flex-col items-center gap-1">
                    <Avatar src={m.avatar} name={m.name} size={48} online={m.isOnline} />
                    <span className="text-[9px] text-gray-500 text-center truncate w-full">{m.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Now */}
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
    </DashboardShell>
  );
}
