'use client';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockAdminStats, mockAdminUsers } from '@/lib/mockData';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Users, DollarSign, TrendingUp, Activity, ChevronRight, Shield,
  UserCheck, UserX, BarChart2, Mail, BookOpen, FileText, Key
} from 'lucide-react';
import Link from 'next/link';

const stats = mockAdminStats;

const statusColor: Record<string, string> = {
  active: '#10B981', trial: '#F87404', expired: '#FF0404', deactivated: '#9ca3af'
};

const PIE_COLORS = ['#10B981', '#F87404', '#FF0404', '#9ca3af'];

const pieData = [
  { name: 'Active', value: stats.activeSubscribers },
  { name: 'Trial', value: stats.trialUsers },
  { name: 'Expired', value: stats.expiredUsers },
  { name: 'Other', value: stats.totalMembers - stats.activeSubscribers - stats.trialUsers - stats.expiredUsers },
];

export default function AdminDashboardPage() {
  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Platform overview & management</p>
        </div>

        {/* Admin Nav */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
          {[
            { label: 'Users', icon: Users, href: '/admin/users', color: '#F87404' },
            { label: 'Moderation', icon: Shield, href: '/admin/moderation', color: '#FF0404' },
            { label: 'Stats', icon: BarChart2, href: '/admin/stats', color: '#004AAD' },
            { label: 'Recipes', icon: BookOpen, href: '/admin/recipes', color: '#10B981' },
            { label: 'Emails', icon: Mail, href: '/admin/emails', color: '#7C3AED' },
            { label: 'Reports', icon: FileText, href: '/admin/stats', color: '#FFC000' },
            { label: 'API Keys', icon: Key, href: '/admin/api-keys', color: '#10B981' },
          ].map(({ label, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <button className="w-full flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-opacity-40 transition-all shadow-sm">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </button>
            </Link>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Members', val: stats.totalMembers.toLocaleString(), icon: Users, color: '#F87404', change: '+47 this week' },
            { label: 'Active Subs', val: stats.activeSubscribers.toLocaleString(), icon: UserCheck, color: '#10B981', change: '+23 this week' },
            { label: 'Monthly Revenue', val: `$${stats.monthlyRevenue.toLocaleString()}`, icon: DollarSign, color: '#004AAD', change: '+12% MoM' },
            { label: 'Posts Today', val: stats.postsToday, icon: Activity, color: '#7C3AED', change: 'Normal activity' },
          ].map(({ label, val, icon: Icon, color, change }) => (
            <Card key={label} padding="sm">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                </div>
                <div className="font-display text-2xl font-bold text-gray-900 dark:text-white">{val}</div>
                <div className="text-xs text-green-500 mt-1">{change}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <Card className="lg:col-span-2">
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Member Growth (12 months)</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.memberGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="members" stroke="#F87404" strokeWidth={2.5} dot={false} name="Members" />
                    <Line type="monotone" dataKey="subscribers" stroke="#004AAD" strokeWidth={2} dot={false} name="Subscribers" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Member Status</h3>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                    <span className="text-gray-500 dark:text-gray-400">{d.name}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card className="mb-6">
          <div className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Revenue (Last 6 Months)</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#F87404" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Recent Users */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Sign-ups</h3>
              <Link href="/admin/users" className="text-xs text-[#F87404] font-medium hover:underline flex items-center gap-1">
                View all <ChevronRight size={13} />
              </Link>
            </div>
            <div className="space-y-3">
              {mockAdminUsers.slice(0, 4).map(user => (
                <div key={user.id} className="flex items-center gap-3">
                  <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={user.status === 'active' ? 'green' : user.status === 'trial' ? 'orange' : user.status === 'expired' ? 'red' : 'gray'} size="sm">
                      {user.status}
                    </Badge>
                    <div className="text-[10px] text-gray-400 mt-0.5">{user.lastActive}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
