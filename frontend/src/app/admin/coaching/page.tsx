'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Send, MessageCircle } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface Authorization {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  physician_name: string;
  practice_name: string;
  practice_address: string;
  practice_phone: string;
  representative_name: string;
  representative_email: string;
  created_at: string;
  member: { id: number; name: string; email: string };
}

interface Message {
  id: number;
  sender_type: 'admin' | 'physician';
  body: string;
  created_at: string;
}

const TABS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'revoked', label: 'Revoked' },
];

const STATUS_VARIANT: Record<Authorization['status'], string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  revoked: 'neutral',
};

export default function AdminCoachingPage() {
  const { confirm, prompt: promptDialog } = useConfirm();
  const [tab, setTab] = useState('pending');
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [messagesFor, setMessagesFor] = useState<Authorization | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = (status: string) => {
    setLoading(true);
    api.get('/admin/coaching-authorizations', { params: { status, page: 1 } })
      .then(r => {
        setAuthorizations(r.data.data ?? []);
        setPage(1);
        setHasMore((r.data.current_page ?? 1) < (r.data.last_page ?? 1));
      })
      .finally(() => setLoading(false));
  };

  const loadMore = () => {
    setLoadingMore(true);
    api.get('/admin/coaching-authorizations', { params: { status: tab, page: page + 1 } })
      .then(r => {
        setAuthorizations(prev => [...prev, ...(r.data.data ?? [])]);
        setPage(page + 1);
        setHasMore((r.data.current_page ?? 1) < (r.data.last_page ?? 1));
      })
      .finally(() => setLoadingMore(false));
  };

  useEffect(() => { load(tab); }, [tab]);

  const approve = async (a: Authorization) => {
    if (!(await confirm({ title: `Approve ${a.physician_name}?`, message: `A secure, single-use invite link will be emailed to ${a.representative_email}.`, confirmLabel: 'Approve and send invite' }))) return;
    setActingId(a.id);
    try {
      await api.post(`/admin/coaching-authorizations/${a.id}/approve`);
      toast.success('Approved. Invite email sent.');
      setAuthorizations(prev => prev.filter(x => x.id !== a.id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve this request.');
    } finally {
      setActingId(null);
    }
  };

  const reject = async (a: Authorization) => {
    const answer = await promptDialog({ title: `Reject ${a.physician_name}?`, message: 'Recorded internally for your own reference.', placeholder: 'Reason (optional)', confirmLabel: 'Reject request', destructive: true, multiline: true });
    if (answer === null) return;
    const reason = answer.trim() || undefined;
    setActingId(a.id);
    try {
      await api.post(`/admin/coaching-authorizations/${a.id}/reject`, { rejection_reason: reason });
      toast.success('Request rejected.');
      setAuthorizations(prev => prev.filter(x => x.id !== a.id));
    } catch {
      toast.error('Failed to reject this request.');
    } finally {
      setActingId(null);
    }
  };

  const revoke = async (a: Authorization) => {
    if (!(await confirm({ title: `Revoke ${a.physician_name}'s access?`, message: 'This takes effect immediately — their very next request will be refused.', confirmLabel: 'Revoke access', destructive: true }))) return;
    setActingId(a.id);
    try {
      await api.post(`/admin/coaching-authorizations/${a.id}/revoke`);
      toast.success('Access revoked.');
      setAuthorizations(prev => prev.filter(x => x.id !== a.id));
    } catch {
      toast.error('Failed to revoke access.');
    } finally {
      setActingId(null);
    }
  };

  const openMessages = async (a: Authorization) => {
    setMessagesFor(a);
    setMessagesLoading(true);
    try {
      const res = await api.get(`/admin/coaching-authorizations/${a.id}/messages`);
      setMessages(res.data.messages ?? []);
    } finally {
      setMessagesLoading(false);
    }
  };

  const sendReply = async () => {
    if (!messagesFor || !reply.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/admin/coaching-authorizations/${messagesFor.id}/messages`, { body: reply.trim() });
      setMessages(prev => [...prev, res.data.message]);
      setReply('');
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title="Coaching Portal" subtitle="Physician access requests and messaging" back="/admin" />

        <div className="flex gap-1.5 mb-5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === t.key ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
        ) : authorizations.length === 0 ? (
          <div className="text-center py-16 text-content-tertiary text-sm">No {tab} requests.</div>
        ) : (
          <div className="space-y-3">
            {authorizations.map(a => (
              <Card key={a.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content-primary truncate">{a.physician_name}</p>
                      <p className="text-xs text-content-tertiary truncate">{a.practice_name}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                  </div>
                  <div className="text-xs text-content-tertiary space-y-0.5 mb-3">
                    <p>Member: {a.member.name} ({a.member.email})</p>
                    <p>Address: {a.practice_address}</p>
                    <p>Phone: {a.practice_phone}</p>
                    <p>Contact: {a.representative_name} · {a.representative_email}</p>
                    <p>Requested {new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {a.status === 'pending' && (
                      <>
                        <Button size="sm" loading={actingId === a.id} onClick={() => approve(a)}>Approve</Button>
                        <Button size="sm" variant="secondary" disabled={actingId === a.id} onClick={() => reject(a)}>Reject</Button>
                      </>
                    )}
                    {a.status === 'approved' && (
                      <>
                        <Button size="sm" variant="ghost" icon={<MessageCircle size={13} />} onClick={() => openMessages(a)}>Messages</Button>
                        <Button size="sm" variant="danger" loading={actingId === a.id} onClick={() => revoke(a)}>Revoke</Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {hasMore && (
          <Button variant="secondary" fullWidth size="sm" className="mt-3" loading={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        )}

        {messagesFor && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMessagesFor(null)} />
            <div className="relative w-full sm:max-w-md h-[80vh] sm:h-[70vh] bg-surface-raised rounded-t-3xl sm:rounded-md z-10 border border-border-subtle flex flex-col">
              <div className="p-5 border-b border-border-subtle">
                <h3 className="font-display text-lg font-bold text-content-primary">{messagesFor.physician_name}</h3>
                <p className="text-xs text-content-tertiary">{messagesFor.practice_name}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-accent" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-content-tertiary py-8">No messages yet.</p>
                ) : (
                  messages.map(m => (
                    <div key={m.id} className={`max-w-[80%] p-3 rounded-md text-sm ${m.sender_type === 'admin' ? 'bg-accent text-white ml-auto' : 'bg-surface-sunken text-content-primary'}`}>
                      {m.body}
                      <p className={`text-[10px] mt-1 ${m.sender_type === 'admin' ? 'text-white/70' : 'text-content-tertiary'}`}>
                        {m.sender_type === 'admin' ? 'You' : messagesFor.physician_name} · {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-border-subtle flex gap-2">
                <input
                  value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendReply(); }}
                  placeholder="Reply..."
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
                <Button size="sm" icon={<Send size={14} />} loading={sending} onClick={sendReply} />
                <Button size="sm" variant="ghost" onClick={() => setMessagesFor(null)}>Close</Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
