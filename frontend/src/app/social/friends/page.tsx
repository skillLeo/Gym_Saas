'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { mockMembers } from '@/lib/mockData';
import { Users, UserPlus, Search, X, MessageCircle, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FriendsPage() {
  const [search, setSearch] = useState('');
  const [followed, setFollowed] = useState<Set<string>>(new Set(['2', '3']));

  const q = search.toLowerCase().trim();
  const filtered = q
    ? mockMembers.filter(m => m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q))
    : mockMembers;

  const toggleFollow = (id: string, name: string) => {
    setFollowed(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast.success(`Unfollowed ${name}`); }
      else { next.add(id); toast.success(`Following ${name}!`); }
      return next;
    });
  };

  const friends = mockMembers.filter(m => followed.has(m.id));
  const suggestions = mockMembers.filter(m => !followed.has(m.id));

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={24} className="text-[#F87404]" /> Friends
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {friends.length} following · {mockMembers.length} members in your community
            </p>
          </div>
          <Link href="/social"
            className="flex items-center gap-2 text-sm font-semibold text-[#F87404] hover:underline">
            ← Back to Feed
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members by name or username..."
            className="w-full pl-11 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-[#F87404] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <X size={14} />
            </button>
          )}
        </div>

        {search ? (
          /* Search results */
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/10">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Users size={40} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No members found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {filtered.map(member => (
                  <MemberRow key={member.id} member={member} isFollowing={followed.has(member.id)} onToggle={toggleFollow} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Following */}
            {friends.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <UserCheck size={14} className="text-[#F87404]" /> Following ({friends.length})
                </h2>
                <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-50 dark:divide-white/5">
                    {friends.map(member => (
                      <MemberRow key={member.id} member={member} isFollowing={true} onToggle={toggleFollow} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <UserPlus size={14} className="text-[#F87404]" /> People You May Know
                </h2>
                <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-50 dark:divide-white/5">
                    {suggestions.map(member => (
                      <MemberRow key={member.id} member={member} isFollowing={false} onToggle={toggleFollow} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function MemberRow({ member, isFollowing, onToggle }: {
  member: typeof mockMembers[0];
  isFollowing: boolean;
  onToggle: (id: string, name: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      <Link href={`/social/${member.username}`}>
        <Avatar src={member.avatar} name={member.name} size={48} online={member.isOnline} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/social/${member.username}`}>
          <p className="font-semibold text-sm text-gray-900 dark:text-white hover:text-[#F87404] transition-colors">{member.name}</p>
        </Link>
        <p className="text-xs text-gray-400 dark:text-gray-500">@{member.username}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{member.followers} followers</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{member.friends} friends</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href={`/messages`}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <MessageCircle size={16} />
        </Link>
        <button
          onClick={() => onToggle(member.id, member.name)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isFollowing
              ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
              : 'bg-[#F87404] text-white hover:bg-[#e06000] shadow-sm shadow-[#F87404]/25'
          }`}
        >
          {isFollowing ? <><UserCheck size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
        </button>
      </div>
    </div>
  );
}
