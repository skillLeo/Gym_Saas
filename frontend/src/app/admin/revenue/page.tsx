'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import api from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { DollarSign, Users, TrendingDown, TrendingUp, Loader2 } from 'lucide-react';

interface RevenueData {
  active_subscribers: number;
  mrr: number;
  trial_conversion_rate: number;
  churn_rate: number;
  total_revenue: number;
  revenue_by_month: { month: string; revenue: number; payment_count: number }[];
  by_plan: { key: string; name: string; price: number; interval: string; active_count: number }[];
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/revenue').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      </DashboardShell>
    );
  }
  if (!data) {
    return (
      <DashboardShell>
        <div className="text-center py-24 text-content-tertiary">Could not load revenue data.</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHeader title="Revenue" subtitle="Real subscription and payment data — no projections" back="/admin" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'MRR',               val: `$${data.mrr.toLocaleString()}`, icon: DollarSign, color: '#10B981' },
            { label: 'Active Subscribers',val: data.active_subscribers.toLocaleString(), icon: Users, color: '#F87404' },
            { label: 'Trial Conversion',  val: `${data.trial_conversion_rate}%`, icon: TrendingUp, color: '#004AAD' },
            { label: 'Churn (30d)',       val: `${data.churn_rate}%`, icon: TrendingDown, color: '#FF0404' },
          ].map(({ label, val, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-content-secondary">{label}</span>
                  <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                </div>
                <div className="font-display text-2xl font-bold text-content-primary">{val}</div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <div className="p-5">
            <h3 className="font-semibold text-content-primary text-sm mb-1">Revenue by month</h3>
            <p className="text-xs text-content-tertiary mb-4">From real succeeded payments, last 12 months. Empty until real payments exist.</p>
            {data.revenue_by_month.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-content-tertiary">No payments recorded yet</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenue_by_month}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip formatter={(v) => `$${Number(v ?? 0).toLocaleString()}`} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <h3 className="font-semibold text-content-primary text-sm mb-4">By plan</h3>
            <div className="space-y-3">
              {data.by_plan.map(plan => (
                <div key={plan.key} className="flex items-center justify-between p-3 rounded-md bg-surface-sunken">
                  <div>
                    <div className="text-sm font-semibold text-content-primary">{plan.name}</div>
                    <div className="text-xs text-content-tertiary">${plan.price}/{plan.interval}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-bold text-content-primary">{plan.active_count}</div>
                    <div className="text-xs text-content-tertiary">active</div>
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
