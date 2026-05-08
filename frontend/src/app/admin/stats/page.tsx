'use client';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { mockAdminStats } from '@/lib/mockData';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { ChevronLeft, TrendingUp, Users, DollarSign, Activity, Utensils, Dumbbell } from 'lucide-react';
import Link from 'next/link';

const stats = mockAdminStats;

export default function AdminStatsPage() {
  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Platform Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Detailed stats & insights</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Members', val: stats.totalMembers.toLocaleString(), sub: 'All time', icon: Users, color: '#F87404' },
            { label: 'Monthly Revenue', val: `$${stats.monthlyRevenue.toLocaleString()}`, sub: 'This month', icon: DollarSign, color: '#10B981' },
            { label: 'Meals Logged', val: stats.mealsLoggedTotal.toLocaleString(), sub: 'Total logged', icon: Utensils, color: '#004AAD' },
            { label: 'Workouts Logged', val: stats.workoutsLoggedTotal.toLocaleString(), sub: 'Total logged', icon: Dumbbell, color: '#7C3AED' },
          ].map(({ label, val, sub, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon size={16} style={{ color }} />
                  <TrendingUp size={12} className="text-green-500" />
                </div>
                <div className="font-display text-2xl font-bold text-gray-900 dark:text-white">{val}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-500">{sub}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Member Growth Area Chart */}
        <Card className="mb-5">
          <div className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Member Growth Trend</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.memberGrowth}>
                  <defs>
                    <linearGradient id="membersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F87404" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F87404" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="subsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004AAD" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#004AAD" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="members" stroke="#F87404" fill="url(#membersGrad)" strokeWidth={2} name="Total Members" />
                  <Area type="monotone" dataKey="subscribers" stroke="#004AAD" fill="url(#subsGrad)" strokeWidth={2} name="Subscribers" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Revenue Chart */}
        <Card className="mb-5">
          <div className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Monthly Revenue</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Activity Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Trial vs Active', data: [{ name: 'Active', val: stats.activeSubscribers }, { name: 'Trial', val: stats.trialUsers }], color1: '#10B981', color2: '#F87404' },
            { label: 'Platform Activity', data: [{ name: 'Meals', val: stats.mealsLoggedTotal }, { name: 'Workouts', val: stats.workoutsLoggedTotal }], color1: '#004AAD', color2: '#7C3AED' },
          ].map(({ label, data, color1, color2 }) => (
            <Card key={label}>
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-xs mb-3">{label}</h4>
                <div className="space-y-2">
                  {data.map((item, i) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">{item.name}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{item.val.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${(item.val / Math.max(...data.map(d => d.val))) * 100}%`,
                          backgroundColor: i === 0 ? color1 : color2
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
