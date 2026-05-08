'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { mockBodyStats } from '@/lib/mockData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { ChevronLeft, Scale, TrendingDown, Plus, Camera, Activity } from 'lucide-react';
import Link from 'next/link';

const measurements = [
  { label: 'Chest', current: '40.5"', change: '-0.5"', positive: true },
  { label: 'Waist', current: '33.8"', change: '-0.8"', positive: true },
  { label: 'Hips', current: '38.2"', change: '-0.3"', positive: true },
  { label: 'Thighs', current: '23.0"', change: '-0.2"', positive: true },
  { label: 'Arms', current: '15.5"', change: '+0.5"', positive: false },
  { label: 'Calves', current: '14.8"', change: '+0.2"', positive: false },
];

type ActiveMetric = 'weight' | 'bodyFat' | 'waist';

export default function BodyStatsPage() {
  const [activeMetric, setActiveMetric] = useState<ActiveMetric>('weight');
  const [showLogModal, setShowLogModal] = useState(false);
  const [logValues, setLogValues] = useState({ weight: '', bodyFat: '', waist: '', notes: '' });

  const latest = mockBodyStats[mockBodyStats.length - 1];
  const prev = mockBodyStats[0];
  const weightChange = (latest.weight - prev.weight).toFixed(1);
  const fatChange = (latest.bodyFat - prev.bodyFat).toFixed(1);

  const metricConfig: Record<ActiveMetric, { label: string; unit: string; color: string; domain: [number, number] }> = {
    weight: { label: 'Weight', unit: 'lbs', color: '#F87404', domain: [180, 200] },
    bodyFat: { label: 'Body Fat', unit: '%', color: '#7C3AED', domain: [18, 26] },
    waist: { label: 'Waist', unit: '"', color: '#004AAD', domain: [32, 36] },
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const cfg = metricConfig[activeMetric];
    return (
      <div className="bg-white dark:bg-[#222] border border-gray-100 dark:border-white/10 rounded-xl p-3 shadow-xl text-xs">
        <p className="font-semibold text-gray-600 dark:text-gray-400 mb-1">{payload[0]?.payload?.date}</p>
        <p style={{ color: cfg.color }}>{cfg.label}: <strong>{payload[0]?.value} {cfg.unit}</strong></p>
      </div>
    );
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/fitness">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Body Stats</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track your physical progress</p>
          </div>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowLogModal(true)}>Log Stats</Button>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Weight', val: `${latest.weight} lbs`, change: `${parseFloat(weightChange) < 0 ? '' : '+'}${weightChange} lbs`, positive: parseFloat(weightChange) < 0, icon: Scale, color: '#F87404' },
            { label: 'Body Fat', val: `${latest.bodyFat}%`, change: `${parseFloat(fatChange) < 0 ? '' : '+'}${fatChange}%`, positive: parseFloat(fatChange) < 0, icon: Activity, color: '#7C3AED' },
            { label: 'Waist', val: `${latest.waist}"`, change: '-0.8"', positive: true, icon: TrendingDown, color: '#004AAD' },
          ].map(({ label, val, change, positive, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-3.5 text-center">
                <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />
                <div className="font-bold text-gray-900 dark:text-white text-lg">{val}</div>
                <div className="text-xs text-gray-400">{label}</div>
                <div className={`text-xs font-medium mt-1 ${positive ? 'text-green-500' : 'text-red-500'}`}>{change}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Progress Chart</h3>
              <div className="flex gap-1">
                {(Object.entries(metricConfig) as [ActiveMetric, typeof metricConfig[ActiveMetric]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setActiveMetric(key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${activeMetric === key ? 'text-white' : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.07]'}`}
                    style={{ backgroundColor: activeMetric === key ? cfg.color : undefined }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockBodyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={metricConfig[activeMetric].domain} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={activeMetric}
                    stroke={metricConfig[activeMetric].color}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: metricConfig[activeMetric].color, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Progress Photos Prompt */}
        <div className="flex items-center gap-4 bg-gradient-to-r from-[#004AAD]/10 to-[#F87404]/10 border border-[#004AAD]/20 rounded-2xl p-4 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#004AAD] to-[#F87404] flex items-center justify-center shrink-0">
            <Camera size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 dark:text-white text-sm">Progress Photos</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Visual proof of your transformation</div>
          </div>
          <Button size="sm" variant="outline">Upload</Button>
        </div>

        {/* Measurements */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Body Measurements</h3>
              <span className="text-xs text-gray-400">vs. 12 weeks ago</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {measurements.map(({ label, current, change, positive }) => (
                <div key={label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                    <div className="font-semibold text-gray-900 dark:text-white text-sm">{current}</div>
                  </div>
                  <span className={`text-xs font-bold ${positive ? 'text-green-500' : 'text-[#F87404]'}`}>{change}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Log Stats Modal */}
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogModal(false)} />
            <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1a1a1a] rounded-t-3xl sm:rounded-3xl p-6 z-10 border border-gray-100 dark:border-white/[0.07] shadow-2xl">
              <h3 className="font-display text-xl font-bold text-gray-900 dark:text-white mb-5">Log Today&apos;s Stats</h3>
              <div className="space-y-4 mb-5">
                {[
                  { key: 'weight', label: 'Weight (lbs)', placeholder: '185' },
                  { key: 'bodyFat', label: 'Body Fat (%)', placeholder: '18.5' },
                  { key: 'waist', label: 'Waist (inches)', placeholder: '33.5' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{label}</label>
                    <input type="number" step="0.1" placeholder={placeholder}
                      value={(logValues as any)[key]}
                      onChange={e => setLogValues(v => ({ ...v, [key]: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
                  </div>
                ))}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Notes</label>
                  <textarea rows={2} placeholder="How are you feeling?"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 resize-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={() => setShowLogModal(false)}>Cancel</Button>
                <Button fullWidth onClick={() => setShowLogModal(false)}>Save Stats</Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
