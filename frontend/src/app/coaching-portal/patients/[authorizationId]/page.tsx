'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Send, Dumbbell, Apple, Scale, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import coachingApi from '@/lib/coachingApi';

interface Paginated<T> { data: T[]; current_page: number; last_page: number; }

interface Workout {
  id: number; exercise_name: string; category: string | null;
  duration_minutes: number | null; calories_burned: number | null; logged_date: string;
}

interface NutritionDay {
  logged_date: string; calories: number; protein: number; carbs: number; fat: number;
}

interface BodyStat {
  id: number; logged_date: string; weight_lbs: number | null; body_fat_pct: number | null;
  waist_inches: number | null; hips_inches: number | null; chest_inches: number | null;
  arms_inches: number | null; thighs_inches: number | null;
}

interface Message {
  id: number; sender_type: 'admin' | 'physician'; body: string; created_at: string;
}

const TABS = [
  { key: 'workouts', label: 'Workouts', icon: Dumbbell },
  { key: 'nutrition', label: 'Nutrition', icon: Apple },
  { key: 'body-stats', label: 'Body Stats', icon: Scale },
  { key: 'messages', label: 'Messages', icon: MessageCircle },
] as const;

export default function PatientDetailPage() {
  const params = useParams<{ authorizationId: string }>();
  const authId = params.authorizationId;
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('workouts');

  return (
    <div>
      <PageHeader title="Patient" subtitle="Read-only coaching data" back="/coaching-portal" />

      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'workouts' && <WorkoutsTab authId={authId} />}
      {tab === 'nutrition' && <NutritionTab authId={authId} />}
      {tab === 'body-stats' && <BodyStatsTab authId={authId} />}
      {tab === 'messages' && <MessagesTab authId={authId} />}
    </div>
  );
}

function Pager({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (p: number) => void }) {
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="h-9 w-9 rounded-md flex items-center justify-center bg-surface-sunken text-content-secondary disabled:opacity-40">
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs text-content-tertiary">Page {page} of {lastPage}</span>
      <button disabled={page >= lastPage} onClick={() => onChange(page + 1)} className="h-9 w-9 rounded-md flex items-center justify-center bg-surface-sunken text-content-secondary disabled:opacity-40">
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function WorkoutsTab({ authId }: { authId: string }) {
  const [data, setData] = useState<Paginated<Workout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    coachingApi.get(`/patients/${authId}/workouts`, { params: { page } })
      .then(res => setData(res.data)).finally(() => setLoading(false));
  }, [authId, page]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-accent" /></div>;
  if (!data || data.data.length === 0) return <EmptyState icon="dumbbell" title="No workouts logged" description="Nothing recorded yet by this member." />;

  return (
    <>
      <div className="space-y-2">
        {data.data.map(w => (
          <Card key={w.id} padding="sm">
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-content-primary truncate">{w.exercise_name}</p>
                <p className="text-xs text-content-tertiary">{w.category ?? 'General'} · {new Date(w.logged_date).toLocaleDateString()}</p>
              </div>
              <div className="text-right shrink-0 text-xs text-content-tertiary">
                {w.duration_minutes ? <p>{w.duration_minutes} min</p> : null}
                {w.calories_burned ? <p>{w.calories_burned} kcal</p> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Pager page={data.current_page} lastPage={data.last_page} onChange={setPage} />
    </>
  );
}

function NutritionTab({ authId }: { authId: string }) {
  const [goal, setGoal] = useState<{ calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null>(null);
  const [daily, setDaily] = useState<NutritionDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coachingApi.get(`/patients/${authId}/nutrition`).then(res => {
      setGoal(res.data.goal);
      setDaily(res.data.daily ?? []);
    }).finally(() => setLoading(false));
  }, [authId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-accent" /></div>;

  return (
    <>
      {goal && (
        <Card className="mb-4">
          <div className="p-4">
            <p className="text-xs font-semibold text-content-tertiary uppercase mb-2">Daily goal</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold text-content-primary">{goal.calories ?? '—'}</p><p className="text-[10px] text-content-tertiary">kcal</p></div>
              <div><p className="text-lg font-bold text-content-primary">{goal.protein ?? '—'}</p><p className="text-[10px] text-content-tertiary">protein g</p></div>
              <div><p className="text-lg font-bold text-content-primary">{goal.carbs ?? '—'}</p><p className="text-[10px] text-content-tertiary">carbs g</p></div>
              <div><p className="text-lg font-bold text-content-primary">{goal.fat ?? '—'}</p><p className="text-[10px] text-content-tertiary">fat g</p></div>
            </div>
          </div>
        </Card>
      )}
      {daily.length === 0 ? (
        <EmptyState icon="apple" title="No nutrition data" description="No food logs in the last 30 days." />
      ) : (
        <div className="space-y-2">
          {daily.map(d => (
            <Card key={d.logged_date} padding="sm">
              <div className="p-3 flex items-center justify-between">
                <p className="text-sm font-medium text-content-primary">{new Date(d.logged_date).toLocaleDateString()}</p>
                <p className="text-xs text-content-tertiary">{Math.round(d.calories)} kcal · P{Math.round(d.protein)} C{Math.round(d.carbs)} F{Math.round(d.fat)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function BodyStatsTab({ authId }: { authId: string }) {
  const [data, setData] = useState<Paginated<BodyStat> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    coachingApi.get(`/patients/${authId}/body-stats`, { params: { page } })
      .then(res => setData(res.data)).finally(() => setLoading(false));
  }, [authId, page]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-accent" /></div>;
  if (!data || data.data.length === 0) return <EmptyState icon="scale" title="No body stats logged" description="Nothing recorded yet by this member." />;

  return (
    <>
      <div className="space-y-2">
        {data.data.map(s => (
          <Card key={s.id} padding="sm">
            <div className="p-3">
              <p className="text-sm font-semibold text-content-primary mb-1">{new Date(s.logged_date).toLocaleDateString()}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-tertiary">
                {s.weight_lbs != null && <span>Weight: {s.weight_lbs} lb</span>}
                {s.body_fat_pct != null && <span>Body fat: {s.body_fat_pct}%</span>}
                {s.waist_inches != null && <span>Waist: {s.waist_inches}&quot;</span>}
                {s.chest_inches != null && <span>Chest: {s.chest_inches}&quot;</span>}
                {s.hips_inches != null && <span>Hips: {s.hips_inches}&quot;</span>}
                {s.arms_inches != null && <span>Arms: {s.arms_inches}&quot;</span>}
                {s.thighs_inches != null && <span>Thighs: {s.thighs_inches}&quot;</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Pager page={data.current_page} lastPage={data.last_page} onChange={setPage} />
    </>
  );
}

function MessagesTab({ authId }: { authId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    coachingApi.get(`/patients/${authId}/messages`).then(res => setMessages(res.data.messages ?? [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [authId]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await coachingApi.post(`/patients/${authId}/messages`, { body: reply.trim() });
      setMessages(prev => [...prev, res.data.message]);
      setReply('');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-accent" /></div>;

  return (
    <div className="flex flex-col">
      <div className="space-y-3 mb-4">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-content-tertiary py-8">No messages yet. Send a note to the platform team.</p>
        ) : messages.map(m => (
          <div key={m.id} className={`max-w-[85%] p-3 rounded-md text-sm ${m.sender_type === 'physician' ? 'bg-accent text-white ml-auto' : 'bg-surface-sunken text-content-primary'}`}>
            {m.body}
            <p className={`text-[10px] mt-1 ${m.sender_type === 'physician' ? 'text-white/70' : 'text-content-tertiary'}`}>
              {m.sender_type === 'physician' ? 'You' : 'Platform team'} · {new Date(m.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 sticky bottom-2">
        <input
          value={reply} onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="Message the platform team..."
          className="flex-1 min-w-0 px-4 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button size="sm" icon={<Send size={14} />} loading={sending} onClick={send} />
      </div>
    </div>
  );
}
