'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import api from '@/lib/api';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Users, DollarSign, Activity, ChevronRight, UserCheck,
  BarChart2, Bell, BookOpen, Key, Bot, EyeOff, Loader2, Mail, UserPlus, Rocket, Stethoscope, Folder,
  Shield, Radio, Video, Film, TicketPercent,
} from 'lucide-react';
import Link from 'next/link';

const PIE_COLORS = ['#10B981', '#F87404', '#FF0404', '#9ca3af'];

type Stats = {
  total_users:       number;
  new_this_week:     number;
  active_this_month: number;
  total_food_logs:   number;
  total_workouts:    number;
  trial_users:       number;
  paid_users:        number;
  churned_users:     number;
  users_by_month:    { month: string; count: number }[];
};
type Revenue = { mrr: number; active_subscribers: number };
type RecentUser = { id: number; name: string; email: string; avatar: string | null; created_at: string };

export default function AdminDashboardPage() {
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [revenue,     setRevenue]     = useState<Revenue | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [flagCount,   setFlagCount]   = useState(0);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/revenue'),
      api.get('/admin/users/recent'),
      api.get('/admin/content-flags/pending-count'),
    ]).then(([s, r, u, f]) => {
      setStats(s.data);
      setRevenue(r.data);
      setRecentUsers(u.data.users);
      setFlagCount(f.data.pending_count);
    }).finally(() => setLoading(false));
  }, []);

  const pieData = stats ? [
    { name: 'Paid',    value: stats.paid_users   },
    { name: 'Trial',   value: stats.trial_users  },
    { name: 'Churned', value: stats.churned_users },
    { name: 'Other',   value: Math.max(0, stats.total_users - stats.paid_users - stats.trial_users - stats.churned_users) },
  ] : [];

  const growthData = stats?.users_by_month.map(d => ({
    month:   d.month,
    members: d.count
  })) ?? [];

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <PageHeader title="Admin" subtitle="Platform overview and management" />

        {/* Admin Nav */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
          {[
            { label: 'Users',       icon: Users,    href: '/admin/users',   color: '#F87404' },
            { label: 'Revenue',     icon: DollarSign, href: '/admin/revenue', color: '#10B981' },
            { label: 'Flags',       icon: Bot,      href: '/admin/content-flags', color: '#FF0404', badge: flagCount },
            // Group approvals live here; without this tile the screen was
            // unreachable from anywhere in the UI.
            { label: 'Moderation',  icon: Shield,   href: '/admin/moderation', color: '#7C3AED' },
            { label: 'Stats',       icon: BarChart2,href: '/admin/stats',   color: '#004AAD' },
            { label: 'New Users',   icon: UserPlus, href: '/admin/new-users', color: '#004AAD' },
            { label: 'Recipes',     icon: BookOpen, href: '/admin/recipes', color: '#10B981' },
            { label: 'Resources',   icon: Folder,   href: '/admin/resources', color: '#004AAD' },
            { label: 'Emails',      icon: Mail,     href: '/admin/emails',  color: '#F87404' },
            { label: 'Notifications',icon: Bell,    href: '/admin/notifications', color: '#7C3AED' },
            { label: 'Undercover',  icon: EyeOff,   href: '/admin/undercover', color: '#FFC000' },
            { label: 'Beta',        icon: Rocket,   href: '/admin/beta',    color: '#7C3AED' },
            { label: 'Coaching',    icon: Stethoscope, href: '/admin/coaching', color: '#1D4ED8' },
            { label: 'API Keys',    icon: Key,       href: '/admin/api-keys', color: '#10B981' },
            // Four more screens that were built, wired to real endpoints, and
            // then linked from nowhere — same as Moderation above. Scheduling a
            // vibe call, going live, uploading a video and setting up a trial
            // discount were all impossible without typing the URL by hand.
            { label: 'Vibe Calls',  icon: Radio,     href: '/admin/vibe-calls', color: '#7C3AED' },
            { label: 'Live',        icon: Video,     href: '/admin/live',    color: '#FF0404' },
            { label: 'Videos',      icon: Film,      href: '/admin/videos',  color: '#004AAD' },
            { label: 'Offers',      icon: TicketPercent, href: '/admin/coupon-offers', color: '#F87404' },
          ].map(({ label, icon: Icon, href, color, badge }) => (
            <Link key={label} href={href}>
              <button className="w-full flex flex-col items-center gap-1.5 py-3 rounded-md bg-surface-raised border border-border-subtle hover:border-opacity-40 transition-all shadow-sm">
                <div className="relative w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                  <Icon size={17} style={{ color }} />
                  {badge ? <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge}</span> : null}
                </div>
                <span className="text-xs font-medium text-content-secondary">{label}</span>
              </button>
            </Link>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-accent" /></div>
        ) : stats && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Members',   val: stats.total_users.toLocaleString(),     icon: Users,     color: '#F87404', change: `+${stats.new_this_week} this week` },
                { label: 'Active Users',    val: stats.active_this_month.toLocaleString(),icon: UserCheck, color: '#10B981', change: 'Last 30 days' },
                { label: 'MRR',             val: `$${(revenue?.mrr ?? 0).toLocaleString()}`, icon: DollarSign, color: '#004AAD', change: `${revenue?.active_subscribers ?? 0} active subscriptions` },
                { label: 'Workouts Logged', val: stats.total_workouts.toLocaleString(),  icon: Activity,  color: '#7C3AED', change: `${stats.total_food_logs.toLocaleString()} meals` },
              ].map(({ label, val, icon: Icon, color, change }) => (
                <Card key={label} padding="sm">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-content-secondary">{label}</span>
                      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                        <Icon size={15} style={{ color }} />
                      </div>
                    </div>
                    <div className="font-display text-2xl font-bold text-content-primary">{val}</div>
                    <div className="text-xs text-green-500 mt-1">{change}</div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
              <Card className="lg:col-span-2">
                <div className="p-5">
                  <h3 className="font-semibold text-content-primary text-sm mb-4">Member Growth (6 months)</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={growthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                        <Line type="monotone" dataKey="members" stroke="#F87404" strokeWidth={2.5} dot={false} name="New Members" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-5">
                  <h3 className="font-semibold text-content-primary text-sm mb-4">Member Status</h3>
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
                        <span className="text-content-secondary">{d.name}</span>
                        <span className="font-semibold text-content-primary">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Users */}
            <Card>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-content-primary text-sm">Recent Sign-ups</h3>
                  <Link href="/admin/users" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
                    View all <ChevronRight size={13} />
                  </Link>
                </div>
                {recentUsers.length === 0 ? (
                  <p className="text-sm text-content-tertiary text-center py-6">No users yet</p>
                ) : (
                  <div className="space-y-3">
                    {recentUsers.slice(0, 5).map(user => (
                      <div key={user.id} className="flex items-center gap-3">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-accent font-bold text-sm">
                            {user.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-content-primary truncate">{user.name}</div>
                          <div className="text-xs text-content-tertiary">{user.email}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-content-tertiary mt-0.5">
                            {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
