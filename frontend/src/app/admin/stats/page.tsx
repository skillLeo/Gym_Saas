'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/lib/api';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, UserPlus, Utensils, Dumbbell, Loader2 } from 'lucide-react';

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

export default function AdminStatsPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  const growthData = stats?.users_by_month.map(d => ({
    month:   d.month,
    members: d.count
  })) ?? [];

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <PageHeader
        title="Platform Analytics"
        subtitle="Detailed stats &amp; insights"
        back="/admin"
      />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-accent" /></div>
        ) : stats && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Members',    val: stats.total_users.toLocaleString(),         sub: 'All time',     icon: Users,     color: '#F87404' },
                { label: 'New This Week',    val: stats.new_this_week.toLocaleString(),       sub: 'Signups',      icon: UserPlus,  color: '#10B981' },
                { label: 'Meals Logged',     val: stats.total_food_logs.toLocaleString(),    sub: 'Total logged', icon: Utensils,  color: '#004AAD' },
                { label: 'Workouts Logged',  val: stats.total_workouts.toLocaleString(),     sub: 'Total logged', icon: Dumbbell,  color: '#7C3AED' },
              ].map(({ label, val, sub, icon: Icon, color }) => (
                <Card key={label} padding="sm">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Icon size={16} style={{ color }} />
                      <TrendingUp size={12} className="text-green-500" />
                    </div>
                    <div className="font-display text-2xl font-bold text-content-primary">{val}</div>
                    <div className="text-xs text-content-tertiary mt-0.5">{label}</div>
                    <div className="text-xs text-content-tertiary">{sub}</div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Member Growth Area Chart */}
            <Card className="mb-5">
              <div className="p-5">
                <h3 className="font-semibold text-content-primary text-sm mb-4">Member Growth Trend (6 months)</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthData}>
                      <defs>
                        <linearGradient id="membersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F87404" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#F87404" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="members" stroke="#F87404" fill="url(#membersGrad)" strokeWidth={2} name="New Members" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Activity Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Trial vs Paid', data: [{ name: 'Paid', val: stats.paid_users }, { name: 'Trial', val: stats.trial_users }], color1: '#10B981', color2: '#F87404' },
                { label: 'Platform Activity', data: [{ name: 'Meals', val: stats.total_food_logs }, { name: 'Workouts', val: stats.total_workouts }], color1: '#004AAD', color2: '#7C3AED' },
              ].map(({ label, data, color1, color2 }) => (
                <Card key={label}>
                  <div className="p-4">
                    <h4 className="font-semibold text-content-primary text-xs mb-3">{label}</h4>
                    <div className="space-y-2">
                      {data.map((item, i) => (
                        <div key={item.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-content-secondary">{item.name}</span>
                            <span className="font-semibold text-content-primary">{item.val.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${(item.val / Math.max(...data.map(d => d.val), 1)) * 100}%`,
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
          </>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
