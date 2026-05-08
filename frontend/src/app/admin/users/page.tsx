'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { mockAdminUsers } from '@/lib/mockData';
import { ChevronLeft, Search, Filter, Mail, Ban, MoreHorizontal, UserCheck, UserX, Eye } from 'lucide-react';
import Link from 'next/link';

const statusBadge: Record<string, 'green' | 'orange' | 'red' | 'gray'> = {
  active: 'green', trial: 'orange', expired: 'red', deactivated: 'gray'
};

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = mockAdminUsers.filter(u => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (query && !u.name.toLowerCase().includes(query.toLowerCase()) && !u.email.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} users</p>
          </div>
          <Button size="sm" icon={<Mail size={14} />}>Email All</Button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/40">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03]">
            <div className="col-span-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">User</div>
            <div className="col-span-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Joined</div>
            <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</div>
            <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last Active</div>
            <div className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</div>
          </div>

          <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {filtered.map(user => (
              <div key={user.id} className="sm:grid grid-cols-12 gap-4 px-5 py-4 flex items-center hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className="col-span-4 flex items-center gap-3 mb-2 sm:mb-0">
                  <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</div>
                    <div className="text-xs text-gray-400 truncate">{user.email}</div>
                  </div>
                </div>
                <div className="col-span-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                  {new Date(user.joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="col-span-2 hidden sm:block">
                  <Badge variant={statusBadge[user.status] || 'gray'} size="sm">{user.status}</Badge>
                </div>
                <div className="col-span-2 text-xs text-gray-400 hidden sm:block">{user.lastActive}</div>
                <div className="col-span-1 flex gap-1.5">
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-[#004AAD] transition-colors">
                    <Eye size={13} />
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-[#F87404] transition-colors">
                    <Mail size={13} />
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">
                    <Ban size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
