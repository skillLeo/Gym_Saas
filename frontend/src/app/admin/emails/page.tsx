'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Mail, Send, Loader2, Clock } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type Audience = 'all' | 'trial' | 'subscribers' | 'inactive_days';

interface Campaign {
  id: number; subject: string; audience: Audience;
  audience_params: { days?: number } | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  recipient_count: number; sent_at: string | null; created_at: string;
  recipients_count?: number;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'All Members', trial: 'Trial Users', subscribers: 'Subscribers', inactive_days: 'Inactive members',
};
const STATUS_BADGE: Record<Campaign['status'], 'gray' | 'orange' | 'green' | 'red'> = {
  draft: 'gray', scheduled: 'orange', sending: 'orange', sent: 'green', failed: 'red',
};

export default function AdminEmailsPage() {
  const { confirm } = useConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [subject, setSubject]     = useState('');
  const [body, setBody]           = useState('');
  const [audience, setAudience]   = useState<Audience>('all');
  const [inactiveDays, setInactiveDays] = useState(30);
  const [creating, setCreating]   = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/email-campaigns', { params: { page: 1 } }).then(r => {
      setCampaigns(r.data.data ?? []);
      setPage(1);
      setHasMore((r.data.current_page ?? 1) < (r.data.last_page ?? 1));
    }).finally(() => setLoading(false));
  };

  const loadMore = () => {
    setLoadingMore(true);
    api.get('/admin/email-campaigns', { params: { page: page + 1 } }).then(r => {
      setCampaigns(prev => [...prev, ...(r.data.data ?? [])]);
      setPage(page + 1);
      setHasMore((r.data.current_page ?? 1) < (r.data.last_page ?? 1));
    }).finally(() => setLoadingMore(false));
  };

  useEffect(() => { load(); }, []);

  const createCampaign = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and message body are required.');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { subject, body_html: `<p>${body.replace(/\n/g, '</p><p>')}</p>`, audience };
      if (audience === 'inactive_days') payload.audience_params = { days: inactiveDays };
      const res = await api.post('/admin/email-campaigns', payload);
      setCampaigns(prev => [res.data.campaign, ...prev]);
      setSubject('');
      setBody('');
      toast.success(`Campaign created for ${res.data.campaign.recipient_count} recipients. Review, then send.`);
    } catch {
      toast.error('Failed to create this campaign.');
    } finally {
      setCreating(false);
    }
  };

  const send = async (campaign: Campaign) => {
    if (!(await confirm({
      title: 'Send this campaign?',
      message: `"${campaign.subject}" will be emailed to ${campaign.recipient_count} recipient(s). This cannot be undone.`,
      confirmLabel: 'Send now',
      destructive: true,
    }))) return;
    setSendingId(campaign.id);
    try {
      const res = await api.post(`/admin/email-campaigns/${campaign.id}/send`);
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? res.data.campaign : c));
      toast.success(`Sent to ${res.data.sent_this_run} recipients${res.data.failed_this_run ? `, ${res.data.failed_this_run} failed` : ''}.`);
    } catch {
      toast.error('Sending failed partway through — safe to retry, already-sent recipients will not be re-sent.');
      load();
    } finally {
      setSendingId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title="Email Campaigns" subtitle="Real, chunked, resumable sends — no queue worker, so sending happens while you wait" back="/admin" />

        <Card className="mb-6">
          <div className="p-5 space-y-4">
            <h3 className="font-semibold text-content-primary text-sm flex items-center gap-2"><Mail size={15} className="text-accent" /> New campaign</h3>
            <div>
              <label className="text-sm font-medium text-content-secondary mb-1.5 block">Audience</label>
              <div className="grid grid-cols-2 gap-2">
                {(['all', 'trial', 'subscribers', 'inactive_days'] as Audience[]).map(a => (
                  <button key={a} onClick={() => setAudience(a)}
                    className={`py-2.5 rounded-md text-sm font-medium border-2 transition-all ${audience === a ? 'border-accent bg-accent-surface text-accent' : 'border-border-strong text-content-secondary'}`}>
                    {AUDIENCE_LABEL[a]}
                  </button>
                ))}
              </div>
              {audience === 'inactive_days' && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-content-secondary">Inactive for at least</label>
                  <input type="number" min={1} max={730} value={inactiveDays}
                    onChange={e => setInactiveDays(Math.max(1, Math.min(730, parseInt(e.target.value) || 1)))}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    className="w-20 px-2 py-1.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary text-center" />
                  <span className="text-xs text-content-secondary">days</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-content-secondary mb-1.5 block">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. New feature: Vibe Thread is live"
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
            </div>
            <div>
              <label className="text-sm font-medium text-content-secondary mb-1.5 block">Message</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Write your message..."
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
            </div>
            <Button fullWidth onClick={createCampaign} loading={creating} icon={<Mail size={15} />}>Create Campaign</Button>
          </div>
        </Card>

        <h3 className="font-semibold text-content-primary text-sm mb-3">Campaigns</h3>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-accent" /></div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-content-tertiary text-center py-10">No campaigns yet.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <Card key={c.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content-primary truncate">{c.subject}</p>
                      <p className="text-xs text-content-tertiary">{AUDIENCE_LABEL[c.audience]} · {c.recipient_count} recipients</p>
                    </div>
                    <Badge variant={STATUS_BADGE[c.status]} size="sm">{c.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-content-tertiary flex items-center gap-1">
                      <Clock size={10} /> {c.sent_at ? `Sent ${new Date(c.sent_at).toLocaleString()}` : `Created ${new Date(c.created_at).toLocaleDateString()}`}
                    </span>
                    {c.status !== 'sent' && (
                      <Button size="sm" onClick={() => send(c)} loading={sendingId === c.id} icon={<Send size={13} />}>
                        Send
                      </Button>
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
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
