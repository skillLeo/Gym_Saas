'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  UserCheck, Plus, Trash2, Shield, AlertTriangle, Loader2,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface UndercoverAccount {
  id: number;
  label: string;
  is_active: boolean;
  created_at: string;
  user: { id: number; name: string; email: string; avatar: string | null; created_at: string };
  created_by_admin: { id: number; name: string };
}

export default function AdminUndercoverPage() {
  const { confirm } = useConfirm();
  const [accounts, setAccounts] = useState<UndercoverAccount[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [newForm, setNewForm]   = useState({ name: '', email: '', password: '', label: '' });

  const load = () => {
    setLoading(true);
    api.get('/admin/undercover').then(r => setAccounts(r.data.accounts ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (acc: UndercoverAccount) => {
    setActingId(acc.id);
    try {
      const res = await api.put(`/admin/undercover/${acc.id}`, { is_active: !acc.is_active });
      setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, is_active: res.data.account.is_active } : a));
    } catch {
      toast.error('Failed to update this account.');
    } finally {
      setActingId(null);
    }
  };

  const removeFlag = async (acc: UndercoverAccount) => {
    if (!(await confirm({ title: `Remove the undercover flag from "${acc.user.name}"?`, message: 'The member account itself will NOT be deleted — only the internal admin-controlled marker is removed.', confirmLabel: 'Remove flag', destructive: true }))) return;
    setActingId(acc.id);
    try {
      await api.delete(`/admin/undercover/${acc.id}`);
      setAccounts(prev => prev.filter(a => a.id !== acc.id));
      toast.success('Undercover flag removed.');
    } catch {
      toast.error('Failed to remove this flag.');
    } finally {
      setActingId(null);
    }
  };

  const addAccount = async () => {
    if (!newForm.name || !newForm.email || !newForm.password || !newForm.label) {
      toast.error('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/admin/undercover', newForm);
      setAccounts(prev => [res.data.account, ...prev]);
      setNewForm({ name: '', email: '', password: '', label: '' });
      setShowAdd(false);
      toast.success('Undercover account created.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create this account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <PageHeader
          title="Undercover Accounts"
          subtitle={`${accounts.filter(a => a.is_active).length} active · admin-controlled member accounts`}
          back="/admin"
          actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Create Account</Button>}
        />

        <div className="flex items-start gap-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-md p-4 mb-5">
          <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            Undercover accounts are ordinary member accounts that browse and behave normally. The
            "admin-controlled" flag is internal only and never appears anywhere a member could see it.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16 text-content-tertiary text-sm">No undercover accounts yet.</div>
        ) : (
          <div className="space-y-3">
            {accounts.map(acc => (
              <Card key={acc.id}>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      {acc.user.avatar ? (
                        <img src={acc.user.avatar} alt={acc.user.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                          {acc.user.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center border-2 border-white dark:border-[#1a1a1a]">
                        <Shield size={10} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm text-content-primary">{acc.user.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${acc.is_active ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-surface-sunken text-content-tertiary'}`}>
                          {acc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-content-tertiary">{acc.user.email}</p>
                      <p className="text-xs text-content-secondary mt-1 italic">&quot;{acc.label}&quot;</p>
                      <p className="text-[10px] text-content-tertiary mt-1">Created by {acc.created_by_admin.name} · {new Date(acc.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => toggleActive(acc)} disabled={actingId === acc.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors disabled:opacity-40" title={acc.is_active ? 'Deactivate' : 'Activate'}>
                        {actingId === acc.id ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} className={acc.is_active ? 'text-green-500' : ''} />}
                      </button>
                      <button onClick={() => removeFlag(acc)} disabled={actingId === acc.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <div className="relative w-full sm:max-w-md bg-surface-raised rounded-t-3xl sm:rounded-md p-6 z-10 border border-border-subtle">
              <h3 className="font-display text-xl font-bold text-content-primary mb-5">Create Undercover Account</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Display Name</label>
                  <input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Login Email</label>
                  <input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} placeholder="account@example.com"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Password</label>
                  <input type="password" value={newForm.password} onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 characters"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Purpose (internal note)</label>
                  <input value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Monitor community behavior"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button fullWidth onClick={addAccount} loading={saving}>Create Account</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
