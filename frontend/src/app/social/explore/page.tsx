'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { mockMembers, mockPosts } from '@/lib/mockData';
import { Search, X, TrendingUp, Users, Hash, ChevronLeft, UserCheck, Users2 } from 'lucide-react';
import Link from 'next/link';
import { useSocialStore } from '@/store/socialStore';

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
  const { followedIds, toggleFollow } = useSocialStore();

  const filtered = query
    ? mockMembers.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.username.toLowerCase().includes(query.toLowerCase()) ||
        m.goal.toLowerCase().includes(query.toLowerCase())
      )
    : mockMembers;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Search bar */}
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

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Recent Posts</h3>
              <div className="grid grid-cols-3 gap-1">
                {mockPosts
                  .filter(p => p.images.length > 0)
                  .flatMap(p => p.images)
                  .concat(mockPosts.filter(p => p.images.length > 0).flatMap(p => p.images))
                  .slice(0, 9)
                  .map((img, i) => (
                    <div key={i} className={`aspect-square overflow-hidden rounded-lg ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                      <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" />
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[#004AAD]" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {query ? `Results for "${query}"` : 'Suggested Members'}
            </h3>
            <span className="ml-auto text-xs text-gray-400">{filtered.length} members</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {filtered.map(member => {
              const isFollowed = followedIds.has(member.id);
              return (
                <div key={member.id} className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm hover:shadow-md hover:border-[#F87404]/20 transition-all">
                  <div className="relative h-20">
                    <img src={member.coverPhoto} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
                  </div>
                  <div className="flex flex-col items-center px-3 pb-4">
                    <div className="-mt-8 mb-2 relative">
                      <Link href={`/social/${member.username}`}>
                        <div className="w-16 h-16 rounded-full border-4 border-white dark:border-[#1a1a1a] overflow-hidden shadow-md">
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        </div>
                      </Link>
                      {member.isOnline && (
                        <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white dark:border-[#1a1a1a]" />
                      )}
                    </div>
                    <Link href={`/social/${member.username}`} className="group">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm text-center group-hover:text-[#F87404] transition-colors leading-tight">{member.name}</div>
                    </Link>
                    <div className="text-xs text-gray-400 text-center mt-0.5">@{member.username}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-1.5 bg-gray-50 dark:bg-white/[0.05] px-2.5 py-0.5 rounded-full">{member.goal}</div>
                    <div className="flex items-center gap-3 mt-2.5 mb-1">
                      <div className="text-center">
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{member.followers >= 1000 ? `${(member.followers / 1000).toFixed(1)}k` : member.followers}</div>
                        <div className="text-[10px] text-gray-400">followers</div>
                      </div>
                      <div className="w-px h-5 bg-gray-100 dark:bg-white/10" />
                      <div className="text-center">
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{member.friends}</div>
                        <div className="text-[10px] text-gray-400">friends</div>
                      </div>
                    </div>
                    {member.mutualConnections > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-2.5">
                        <Users2 size={11} className="text-[#F87404]" />
                        <span>{member.mutualConnections} mutual connections</span>
                      </div>
                    )}
                    <button
                      onClick={() => toggleFollow(member.id)}
                      className={`w-full py-2 rounded-xl text-xs font-semibold transition-all mt-1 ${
                        isFollowed
                          ? 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10'
                          : 'bg-[#F87404] text-white hover:bg-[#FF5C04] shadow-sm'
                      }`}
                    >
                      {isFollowed ? <span className="flex items-center justify-center gap-1"><UserCheck size={12} /> Following</span> : '+ Follow'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">No members found for &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
