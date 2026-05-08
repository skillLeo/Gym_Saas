'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { mockMembers, mockPosts } from '@/lib/mockData';
import { Search, X, TrendingUp, Users, Hash, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

const trendingTags = [
  { tag: 'ChestDay', posts: 1240 },
  { tag: 'MealPrep', posts: 3872 },
  { tag: 'LegDay', posts: 2101 },
  { tag: 'ProgressPic', posts: 876 },
  { tag: 'TeamExtreme', posts: 543 },
  { tag: 'HIIT', posts: 1654 },
];

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>(
    Object.fromEntries(mockMembers.map(m => [m.id, m.isFollowing]))
  );

  const filtered = query
    ? mockMembers.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.username.toLowerCase().includes(query.toLowerCase()) ||
        m.goal.toLowerCase().includes(query.toLowerCase())
      )
    : mockMembers;

  const toggleFollow = (id: string) => setFollowing(f => ({ ...f, [id]: !f[id] }));

  return (
    <DashboardShell>
      <div className="max-w-xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-5">
          <Link href="/social">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              placeholder="Search members, topics, goals..."
              className="w-full pl-9 pr-9 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {!query && (
          <>
            {/* Trending Topics */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-[#F87404]" />
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Trending Topics</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {trendingTags.map(({ tag, posts }) => (
                  <button key={tag} className="flex items-center justify-between p-3 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/30 transition-all text-left">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Hash size={13} className="text-[#F87404]" />
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">{tag}</span>
                      </div>
                      <div className="text-xs text-gray-400">{posts.toLocaleString()} posts</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Grid - Explore */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Recent Posts</h3>
              <div className="grid grid-cols-3 gap-1">
                {mockPosts.filter(p => p.images.length > 0).flatMap(p => p.images).concat(
                  mockPosts.filter(p => p.images.length > 0).flatMap(p => p.images)
                ).slice(0, 9).map((img, i) => (
                  <div key={i} className={`aspect-square overflow-hidden rounded-lg ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                    <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Members */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-[#004AAD]" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {query ? `Results for "${query}"` : 'Suggested Members'}
            </h3>
          </div>
          <div className="space-y-3">
            {filtered.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm">
                <Link href={`/social/${member.username}`}>
                  <Avatar src={member.avatar} name={member.name} online={member.isOnline} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/social/${member.username}`}>
                    <div className="font-semibold text-gray-900 dark:text-white text-sm hover:text-[#F87404] transition-colors truncate">{member.name}</div>
                  </Link>
                  <div className="text-xs text-gray-400 truncate">@{member.username} · {member.goal}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {member.followers.toLocaleString()} followers
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={following[member.id] ? 'outline' : 'primary'}
                  onClick={() => toggleFollow(member.id)}
                >
                  {following[member.id] ? 'Following' : 'Follow'}
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">No members found for &ldquo;{query}&rdquo;</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
