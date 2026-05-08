'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-gray-500 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-medium" style={{ color: p.color }}>{p.name}: {Math.round(p.value)}{p.name === 'Calories' ? ' kcal' : 'g'}</p>
      ))}
    </div>
  );
};

export default function FoodLogHistoryPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  const { data, isLoading } = useQuery({
    queryKey: ['food-log-history', period],
    queryFn: () => api.get('/food-log/history', { params: { period } }).then(r => r.data.data),
  });

  const formatted = data?.map((d: any) => ({
    ...d, date: format(parseISO(d.date), period === 'week' ? 'EEE' : 'MMM d'),
  })) ?? [];

  const avgCal    = data?.length ? Math.round(data.reduce((s: number, d: any) => s + d.calories, 0) / data.length) : 0;
  const avgPro    = data?.length ? Math.round(data.reduce((s: number, d: any) => s + d.protein_g, 0) / data.length) : 0;
  const avgCarbs  = data?.length ? Math.round(data.reduce((s: number, d: any) => s + d.carbs_g, 0) / data.length) : 0;
  const avgFat    = data?.length ? Math.round(data.reduce((s: number, d: any) => s + d.fat_g, 0) / data.length) : 0;
  const maxDay    = data?.reduce((max: any, d: any) => d.calories > (max?.calories ?? 0) ? d : max, null);
  const minDay    = data?.filter((d: any) => d.calories > 0).reduce((min: any, d: any) => !min || d.calories < min.calories ? d : min, null);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Nutrition History</h1>
        <div className="flex gap-2">
          {(['week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${period === p ? 'bg-[#F87404] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'}`}>{p}</button>
          ))}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><LoadingSpinner /></div> : (
        <>
          <Card>
            <CardHeader><CardTitle>Calorie Trend</CardTitle></CardHeader>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={user?.daily_calorie_goal ?? 2000} stroke="#3FB950" strokeDasharray="4 4" label={{ value: 'Goal', fill: '#3FB950', fontSize: 10 }} />
                  <Line type="monotone" dataKey="calories" name="Calories" stroke="#F87404" strokeWidth={2} dot={{ fill: '#F87404', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Macros Breakdown</CardTitle></CardHeader>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#6B7280' }} />
                  <Bar dataKey="protein_g" name="Protein" fill="#F87404" radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="carbs_g"   name="Carbs"   fill="#F97316" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="fat_g"     name="Fat"     fill="#FACC15" radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardTitle className="mb-3">Averages ({period})</CardTitle>
              <div className="space-y-2">
                {[['Calories', `${avgCal} kcal`, '#111827'], ['Protein', `${avgPro}g`, '#F87404'], ['Carbs', `${avgCarbs}g`, '#F97316'], ['Fat', `${avgFat}g`, '#FACC15']].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between text-sm">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-semibold" style={{ color: c as string }}>{v}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardTitle className="mb-3">Highlights</CardTitle>
              <div className="space-y-2 text-sm">
                {maxDay && <div><p className="text-gray-500">Highest day</p><p className="font-semibold text-gray-900">{Math.round(maxDay.calories)} kcal</p><p className="text-xs text-gray-400">{maxDay.date}</p></div>}
                {minDay && <div className="mt-2"><p className="text-gray-500">Lowest day</p><p className="font-semibold text-gray-900">{Math.round(minDay.calories)} kcal</p><p className="text-xs text-gray-400">{minDay.date}</p></div>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
