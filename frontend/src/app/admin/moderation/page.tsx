'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import { Shield, CheckCircle, XCircle, AlertTriangle, Eye, Loader2, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type Report = {
  id:           string | number;
  type:         string;
  content:      string;
  reporter:     string;
  reportedUser: string;
  reason:       string;
  date:         string;
  status:       'pending' | 'reviewed' | 'removed';
};

interface PendingGroup {
  id: number; name: string; description: string | null;
  creator: { id: number; name: string };
  created_at: string;
}

export default function ModerationPage() {
  const { prompt } = useConfirm();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  useEffect(() => {
    api.get('/admin/moderation').then(r => setReports(r.data.reports ?? [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get('/admin/groups/pending').then(r => setPendingGroups(r.data.data ?? [])).finally(() => setGroupsLoading(false));
  }, []);

  const decideGroup = async (id: number, action: 'approve' | 'reject') => {
    // Rejecting now asks why. The server has always accepted a reason and the
    // creator's own Groups tab displays it — but nothing ever collected one, so
    // every rejection reached the member with no explanation at all.
    let reason: string | undefined;
    if (action === 'reject') {
      const answer = await prompt({
        title: 'Reject this group?',
        message: 'The member will see this reason on their profile, so keep it clear and civil.',
        placeholder: 'e.g. The name is too vague',
        confirmLabel: 'Reject group',
        destructive: true,
        multiline: true,
      });
      // null means the admin backed out — that must abort, not reject with a
      // blank reason.
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }

    setDecidingId(id);
    try {
      await api.post(`/admin/groups/${id}/${action}`, action === 'reject' ? { reason } : {});
      setPendingGroups(prev => prev.filter(g => g.id !== id));
      toast.success(action === 'approve' ? 'Group approved — the creator has been notified.' : 'Group rejected — the creator has been notified.');
    } catch {
      toast.error('Failed to update group');
    } finally {
      setDecidingId(null);
    }
  };

  const resolve = (id: string | number, action: 'approve' | 'remove') => {
    setReports(p => p.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'reviewed' : 'removed' } : r));
  };

  const pending = reports.filter(r => r.status === 'pending').length;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <PageHeader
          title="Moderation"
          subtitle={pending > 0 ? `${pending} pending review${pending !== 1 ? 's' : ''}` : undefined}
          back="/admin"
        />

        {/* Pending Groups */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-accent" />
            <h2 className="font-bold text-content-primary text-sm">Pending Group Approvals</h2>
            {pendingGroups.length > 0 && <Badge variant="red" size="sm">{pendingGroups.length}</Badge>}
          </div>
          {groupsLoading ? (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-accent" /></div>
          ) : pendingGroups.length === 0 ? (
            <div className="bg-surface-raised rounded-md border border-border-subtle p-5 text-center text-sm text-content-tertiary shadow-sm">
              No groups awaiting approval
            </div>
          ) : (
            <div className="space-y-3">
              {pendingGroups.map(g => (
                <div key={g.id} className="bg-surface-raised rounded-md border border-border-subtle p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-content-primary text-sm">{g.name}</p>
                      <p className="text-xs text-content-tertiary">Created by {g.creator.name}</p>
                    </div>
                    <span className="text-xs text-content-tertiary">{new Date(g.created_at).toLocaleDateString()}</span>
                  </div>
                  {g.description && <p className="text-sm text-content-secondary mb-3">{g.description}</p>}
                  <div className="flex gap-2">
                    <Button onClick={() => decideGroup(g.id, 'approve')} disabled={decidingId === g.id} variant="outline" size="sm" icon={<CheckCircle size={14} />} className="flex-1">Approve</Button>
                    <Button onClick={() => decideGroup(g.id, 'reject')} disabled={decidingId === g.id} variant="danger" size="sm" icon={<XCircle size={14} />} className="flex-1">Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-accent" /></div>
        ) : reports.length === 0 ? (
          <div className="bg-surface-raised rounded-md border border-border-subtle p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-md bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-green-500" />
            </div>
            <h3 className="font-bold text-content-primary text-lg mb-2">All Clear!</h3>
            <p className="text-sm text-content-secondary">No reported content to review at this time.</p>
          </div>
        ) : (
          <>
            {pending > 0 && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md p-4 mb-5">
                <AlertTriangle size={18} className="text-red-500 shrink-0" />
                <div>
                  <div className="font-semibold text-red-700 dark:text-red-400 text-sm">{pending} Reports Need Attention</div>
                  <div className="text-xs text-red-600 dark:text-red-500">Review and take action on reported content</div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {reports.map(report => (
                <div key={report.id} className="bg-surface-raised rounded-md border border-border-subtle p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield size={15} className={report.status === 'pending' ? 'text-red-500' : 'text-green-500'} />
                      <Badge variant={report.status === 'pending' ? 'red' : 'green'} size="sm">{report.status}</Badge>
                      <Badge variant="gray" size="sm">{report.type}</Badge>
                    </div>
                    <span className="text-xs text-content-tertiary">{report.date}</span>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm font-medium text-content-primary mb-1">Reported Content</p>
                    <p className="text-sm text-content-secondary bg-gray-50 dark:bg-white/[0.04] rounded-md p-3">
                      &ldquo;{report.content}&rdquo;
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                    <div><span className="text-content-tertiary">Reported by</span><div className="font-medium text-content-primary">{report.reporter}</div></div>
                    <div><span className="text-content-tertiary">Reported user</span><div className="font-medium text-content-primary">{report.reportedUser}</div></div>
                    <div><span className="text-content-tertiary">Reason</span><div className="font-medium text-red-500">{report.reason}</div></div>
                  </div>

                  {report.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button onClick={() => resolve(report.id, 'approve')} variant="outline" size="sm" icon={<CheckCircle size={14} />} className="flex-1">Approve (Keep)</Button>
                      <Button onClick={() => resolve(report.id, 'remove')} variant="danger" size="sm" icon={<XCircle size={14} />} className="flex-1">Remove Content</Button>
                      <button className="w-9 h-9 flex items-center justify-center rounded-md border border-border-strong text-content-tertiary hover:border-accent/40 hover:text-accent transition-colors shrink-0">
                        <Eye size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle size={14} />
                      <span>Reviewed — no action taken</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
