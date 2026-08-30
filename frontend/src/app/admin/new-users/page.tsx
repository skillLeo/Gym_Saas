'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import { Loader2, Utensils, Dumbbell, CheckCircle, XCircle } from 'lucide-react';

interface NewUser {
  id: number; name: string; email: string; avatar: string | null;
  signed_up_at: string; onboarding_completed: boolean;
  account_state: 'trial' | 'subscriber' | 'grace' | 'deactivated';
  last_active_at: string | null;
  first_food_log_at: string | null;
  first_workout_at: string | null;
}

const STATE_BADGE: Record<NewUser['account_state'], 'orange' | 'green' | 'red' | 'gray'> = {
  trial: 'orange', subscriber: 'green', grace: 'red', deactivated: 'gray',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function AdminNewUsersPage() {
  const [users, setUsers] = useState<NewUser[]>([]);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/new-users', { params: { days } }).then(r => setUsers(r.data.users)).finally(() => setLoading(false));
  }, [days]);

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title="New User Monitoring" subtitle={`${users.length} members, last ${days} days`} back="/admin" />

        <div className="flex gap-2 mb-5">
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-all ${days === d ? 'bg-accent text-white border-accent' : 'bg-surface-raised border-border-strong text-content-secondary'}`}>
              {d} days
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-content-tertiary text-sm">No signups in this window.</div>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
              <Card key={u.id}>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-accent font-bold text-sm">{u.name[0]?.toUpperCase()}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-content-primary truncate">{u.name}</p>
                        <Badge variant={STATE_BADGE[u.account_state]} size="sm">{u.account_state}</Badge>
                      </div>
                      <p className="text-xs text-content-tertiary truncate">{u.email} · joined {new Date(u.signed_up_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-md bg-gray-50 dark:bg-white/[0.04]">
                      {u.onboarding_completed ? <CheckCircle size={13} className="mx-auto mb-1 text-green-500" /> : <XCircle size={13} className="mx-auto mb-1 text-content-tertiary" />}
                      <div className="text-[9px] text-content-tertiary">Onboarded</div>
                    </div>
                    <div className="p-2 rounded-md bg-gray-50 dark:bg-white/[0.04]">
                      <Utensils size={13} className="mx-auto mb-1" style={{ color: u.first_food_log_at ? '#10B981' : '#9ca3af' }} />
                      <div className="text-[9px] text-content-tertiary">{u.first_food_log_at ? `First log ${timeAgo(u.first_food_log_at)}` : 'No food logs'}</div>
                    </div>
                    <div className="p-2 rounded-md bg-gray-50 dark:bg-white/[0.04]">
                      <Dumbbell size={13} className="mx-auto mb-1" style={{ color: u.first_workout_at ? '#F87404' : '#9ca3af' }} />
                      <div className="text-[9px] text-content-tertiary">{u.first_workout_at ? `First w/o ${timeAgo(u.first_workout_at)}` : 'No workouts'}</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-content-tertiary mt-2 text-center">Last active: {timeAgo(u.last_active_at)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
