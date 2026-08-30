'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Utensils, Dumbbell, MessageCircle, Shield, ShieldOff } from 'lucide-react';

type AccountState = 'trial' | 'subscriber' | 'grace' | 'deactivated';

interface UserDetail {
  id: number; name: string; username: string | null; email: string; avatar: string | null;
  bio: string | null; created_at: string; email_verified_at: string | null;
  account_state: AccountState; is_admin: boolean; onboarding_completed: boolean;
  trial_starts_at: string | null; trial_ends_at: string | null;
  deactivated_at: string | null; scheduled_deletion_at: string | null;
  active_subscription: { status: string; current_period_end: string | null } | null;
  stats: { food_logs: number; workouts: number; posts: number };
}

const STATE_BADGE: Record<AccountState, 'orange' | 'green' | 'red' | 'gray'> = {
  trial: 'orange', subscriber: 'green', grace: 'red', deactivated: 'gray',
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/admin/users/${userId}`).then(r => setUser(r.data.user)).finally(() => setLoading(false));
  };

  useEffect(() => { if (userId) load(); }, [userId]);

  const changeState = async (state: AccountState) => {
    if (!user) return;
    setSaving(true);
    try {
      await api.put(`/admin/users/${user.id}`, { account_state: state });
      toast.success(`Account state changed to ${state}.`);
      load();
    } catch {
      toast.error('Failed to update this account.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAdmin = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.put(`/admin/users/${user.id}`, { is_admin: !user.is_admin });
      toast.success(user.is_admin ? 'Admin access removed.' : 'Admin access granted.');
      load();
    } catch {
      toast.error('Failed to update admin access.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      </DashboardShell>
    );
  }
  if (!user) {
    return (
      <DashboardShell>
        <div className="text-center py-24 text-content-tertiary">User not found</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title={user.name} subtitle={user.email} back="/admin/users" />

        <Card className="mb-5">
          <div className="p-5 flex items-center gap-4">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xl">
                {user.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-content-primary">{user.name}</h2>
                <Badge variant={STATE_BADGE[user.account_state]} size="sm">{user.account_state}</Badge>
                {user.is_admin && <Badge variant="blue" size="sm">Admin</Badge>}
              </div>
              <p className="text-sm text-content-tertiary truncate">{user.email}</p>
              {user.username && <p className="text-xs text-content-tertiary">@{user.username}</p>}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Food Logs', val: user.stats.food_logs, icon: Utensils, color: '#F87404' },
            { label: 'Workouts',  val: user.stats.workouts,  icon: Dumbbell, color: '#FF0404' },
            { label: 'Posts',     val: user.stats.posts,     icon: MessageCircle, color: '#004AAD' },
          ].map(({ label, val, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4 text-center">
                <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />
                <div className="font-display font-bold text-lg text-content-primary">{val}</div>
                <div className="text-xs text-content-tertiary">{label}</div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mb-5">
          <div className="p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-content-primary mb-2">Account details</h3>
            <div className="flex justify-between"><span className="text-content-tertiary">Joined</span><span className="text-content-primary">{new Date(user.created_at).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-content-tertiary">Email verified</span><span className="text-content-primary">{user.email_verified_at ? new Date(user.email_verified_at).toLocaleDateString() : 'Not verified'}</span></div>
            <div className="flex justify-between"><span className="text-content-tertiary">Onboarding</span><span className="text-content-primary">{user.onboarding_completed ? 'Completed' : 'Incomplete'}</span></div>
            {user.trial_ends_at && <div className="flex justify-between"><span className="text-content-tertiary">Trial ends</span><span className="text-content-primary">{new Date(user.trial_ends_at).toLocaleDateString()}</span></div>}
            {user.active_subscription && <div className="flex justify-between"><span className="text-content-tertiary">Subscription</span><span className="text-content-primary capitalize">{user.active_subscription.status}</span></div>}
            {user.deactivated_at && <div className="flex justify-between"><span className="text-content-tertiary">Deactivated</span><span className="text-content-primary">{new Date(user.deactivated_at).toLocaleDateString()}</span></div>}
            {user.scheduled_deletion_at && <div className="flex justify-between"><span className="text-content-tertiary">Scheduled deletion</span><span className="text-error">{new Date(user.scheduled_deletion_at).toLocaleDateString()}</span></div>}
          </div>
        </Card>

        <Card>
          <div className="p-5 space-y-3">
            <h3 className="font-semibold text-content-primary mb-1">Manage account</h3>
            <p className="text-xs text-content-tertiary mb-2">
              A manual state change may be reverted automatically if it disagrees with real billing facts
              (e.g. setting "subscriber" without an actual active subscription).
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['trial', 'subscriber', 'grace', 'deactivated'] as AccountState[]).map(state => (
                <Button key={state} size="sm" variant={user.account_state === state ? 'primary' : 'outline'}
                  disabled={saving || user.account_state === state} onClick={() => changeState(state)}>
                  {state === 'grace' ? 'Expired' : state.charAt(0).toUpperCase() + state.slice(1)}
                </Button>
              ))}
            </div>
            <Button size="sm" fullWidth variant="ghost" disabled={saving} onClick={toggleAdmin}
              icon={user.is_admin ? <ShieldOff size={14} /> : <Shield size={14} />}>
              {user.is_admin ? 'Remove admin access' : 'Grant admin access'}
            </Button>
          </div>
        </Card>

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
