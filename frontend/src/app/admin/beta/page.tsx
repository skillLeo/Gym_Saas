'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Controls';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2, Rocket } from 'lucide-react';

interface AllowlistEntry {
  id: number; email: string; note: string | null; used_at: string | null; created_at: string;
  inviter: { name: string } | null;
}

export default function AdminBetaPage() {
  const [inviteOnly, setInviteOnly] = useState(false);
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/beta/status'),
      api.get('/admin/beta/allowlist'),
    ]).then(([status, list]) => {
      setInviteOnly(status.data.invite_only_mode);
      setEntries(list.data.data ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = async (on: boolean) => {
    setToggling(true);
    try {
      await api.post('/admin/beta/toggle', { invite_only_mode: on });
      setInviteOnly(on);
      toast.success(on ? 'Invite-only mode is now ON.' : 'Invite-only mode is now OFF — anyone can register.');
    } catch {
      toast.error('Failed to change invite-only mode.');
    } finally {
      setToggling(false);
    }
  };

  const addEntry = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const res = await api.post('/admin/beta/allowlist', { email: newEmail.trim(), note: newNote.trim() || undefined });
      setEntries(prev => [res.data.entry, ...prev]);
      setNewEmail('');
      setNewNote('');
      toast.success('Added to the allowlist.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add this email.');
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (entry: AllowlistEntry) => {
    try {
      await api.delete(`/admin/beta/allowlist/${entry.id}`);
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch {
      toast.error('Failed to remove this entry.');
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title="Beta Launch" subtitle="Invite-only mode and the beta allowlist" back="/admin" />

        <Card className="mb-6">
          <div className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-accent-surface flex items-center justify-center shrink-0">
              <Rocket size={18} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-content-primary">Invite-only mode</p>
              <p className="text-xs text-content-tertiary">
                {inviteOnly ? 'Only allowlisted emails can register — password and Google sign-up both enforce this.' : 'Anyone can register right now.'}
              </p>
            </div>
            {loading ? <Loader2 size={18} className="animate-spin text-accent" /> : (
              <Switch checked={inviteOnly} onChange={toggle} disabled={toggling} label="" />
            )}
          </div>
        </Card>

        <Card className="mb-5">
          <div className="p-5 space-y-3">
            <h3 className="font-semibold text-content-primary text-sm">Add to allowlist</h3>
            <div className="flex gap-2">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" type="email"
                className="flex-1 px-4 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
            </div>
            <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Note (optional)"
              className="w-full px-4 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
            <Button fullWidth size="sm" onClick={addEntry} loading={adding} icon={<Plus size={14} />}>Add</Button>
          </div>
        </Card>

        <h3 className="font-semibold text-content-primary text-sm mb-3">Allowlist ({entries.length})</h3>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-accent" /></div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-content-tertiary text-center py-10">No allowlisted emails yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-md bg-surface-raised border border-border-subtle">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary truncate">{e.email}</p>
                  <p className="text-xs text-content-tertiary">
                    {e.note ? `${e.note} · ` : ''}{e.used_at ? `Registered ${new Date(e.used_at).toLocaleDateString()}` : 'Not used yet'}
                  </p>
                </div>
                <button onClick={() => removeEntry(e)} className="text-content-tertiary hover:text-red-500 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
