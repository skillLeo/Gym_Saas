'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Bot, AlertTriangle, CheckCircle, Flag, Plus, X, Search, Shield, Zap, Clock, Loader2,
} from 'lucide-react';

type Severity = 'high' | 'medium' | 'low';
type FlagStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

interface TriggerWord { id: number; term: string; severity: Severity; is_active: boolean }
interface FlaggedItem {
  id: number;
  type: 'post' | 'comment';
  reason: 'keyword' | 'user_report';
  matched_terms: string[] | null;
  severity: Severity;
  status: FlagStatus;
  reported_by: string | null;
  created_at: string;
  content: { id: number; body: string; author: string | null } | null;
}

const severityColor: Record<Severity, { bg: string; text: string; label: string }> = {
  high:   { bg: 'bg-red-50 dark:bg-red-500/10',    text: 'text-red-500',             label: 'High' },
  medium: { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-500',         label: 'Medium' },
  low:    { bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-brand-blue-deep',           label: 'Low' }
};

type Tab = 'queue' | 'triggers';

export default function ContentFlagsPage() {
  const [flags, setFlags]             = useState<FlaggedItem[]>([]);
  const [triggers, setTriggers]       = useState<TriggerWord[]>([]);
  const [tab, setTab]                 = useState<Tab>('queue');
  const [search, setSearch]           = useState('');
  const [newWord, setNewWord]         = useState('');
  const [newSev, setNewSev]           = useState<Severity>('medium');
  const [showAdd, setShowAdd]         = useState(false);
  const [filterSev, setFilterSev]     = useState('all');
  const [loading, setLoading]         = useState(true);
  const [actingId, setActingId]       = useState<number | null>(null);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [flagsPage, setFlagsPage]     = useState(1);
  const [flagsHasMore, setFlagsHasMore] = useState(false);
  const [loadingMoreFlags, setLoadingMoreFlags] = useState(false);

  const loadFlags = useCallback(async () => {
    try {
      const res = await api.get('/admin/content-flags', { params: { page: 1 } });
      setFlags(res.data.data ?? []);
      setFlagsPage(1);
      setFlagsHasMore((res.data.current_page ?? 1) < (res.data.last_page ?? 1));
    } catch {
      toast.error('Failed to load the flag queue.');
    }
  }, []);

  const loadMoreFlags = async () => {
    setLoadingMoreFlags(true);
    try {
      const res = await api.get('/admin/content-flags', { params: { page: flagsPage + 1 } });
      setFlags(prev => [...prev, ...(res.data.data ?? [])]);
      setFlagsPage(flagsPage + 1);
      setFlagsHasMore((res.data.current_page ?? 1) < (res.data.last_page ?? 1));
    } finally {
      setLoadingMoreFlags(false);
    }
  };

  const loadTriggers = useCallback(async () => {
    try {
      const res = await api.get('/admin/content-flags/keywords');
      setTriggers(res.data.keywords ?? []);
    } catch {
      toast.error('Failed to load trigger words.');
    }
  }, []);

  const loadPendingTotal = useCallback(async () => {
    try {
      const res = await api.get('/admin/content-flags/pending-count');
      setPendingTotal(res.data.pending_count ?? 0);
    } catch { /* non-critical stat */ }
  }, []);

  useEffect(() => {
    Promise.all([loadFlags(), loadTriggers(), loadPendingTotal()]).finally(() => setLoading(false));
  }, [loadFlags, loadTriggers, loadPendingTotal]);

  // Severity breakdown has no dedicated endpoint, so it reflects only the
  // pages loaded so far — accurate for the common case (queue under ~20),
  // approximate once older pages exist. `pendingTotal` above is always exact.
  const pending = flags.filter(f => f.status === 'pending');
  const highCount = pending.filter(f => f.severity === 'high').length;

  const resolveFlag = async (id: number, action: 'dismiss' | 'escalate') => {
    setActingId(id);
    try {
      const res = await api.post(`/admin/content-flags/${id}/${action}`);
      setFlags(prev => prev.map(f => f.id === id ? { ...f, status: res.data.flag.status } : f));
      if (res.data.flag.status !== 'pending') setPendingTotal(prev => Math.max(0, prev - 1));
      toast.success(action === 'dismiss' ? 'Flag dismissed.' : 'Flag escalated.');
    } catch {
      toast.error('Failed to update this flag.');
    } finally {
      setActingId(null);
    }
  };

  const visibleFlags = flags.filter(f => {
    if (filterSev !== 'all' && f.severity !== filterSev) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.content?.body.toLowerCase().includes(q) && !f.content?.author?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const addTrigger = async () => {
    if (!newWord.trim()) return;
    try {
      const res = await api.post('/admin/content-flags/keywords', { term: newWord.trim().toLowerCase(), severity: newSev });
      setTriggers(prev => [...prev, res.data.keyword]);
      setNewWord('');
      setShowAdd(false);
      toast.success('Trigger word added.');
    } catch {
      toast.error('Failed to add this trigger word.');
    }
  };

  const removeTrigger = async (id: number) => {
    try {
      await api.delete(`/admin/content-flags/keywords/${id}`);
      setTriggers(prev => prev.filter(t => t.id !== id));
    } catch {
      toast.error('Failed to remove this trigger word.');
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto px-4 py-6">

        <PageHeader
          title="Content Flagging"
          subtitle={`${pendingTotal} pending review · ${triggers.length} trigger words`}
          back="/admin"
          actions={
            highCount > 0 ? (
              <Badge variant="error">{highCount} urgent</Badge>
            ) : undefined
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Pending Review', val: pendingTotal, icon: Clock, color: '#F87404' },
            { label: 'High Severity', val: highCount, icon: AlertTriangle, color: '#FF0404' },
            { label: 'Trigger Words', val: triggers.length, icon: Zap, color: '#004AAD' },
          ].map(({ label, val, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4 text-center">
                <div className="w-8 h-8 rounded-md mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div className="font-display font-bold text-xl text-content-primary">{val}</div>
                <div className="text-xs text-content-tertiary mt-0.5">{label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-sunken rounded-md p-1 mb-5">
          {([['queue', 'Review Queue', Flag], ['triggers', 'Trigger Words', Zap]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id as Tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-semibold transition-all ${tab === id ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary'}`}>
              <Icon size={14} />{label}
              {id === 'queue' && pendingTotal > 0 && <span className="text-xs bg-accent text-white rounded-full px-1.5 py-0.5 leading-none">{pendingTotal}</span>}
            </button>
          ))}
        </div>

        {/* Review Queue */}
        {tab === 'queue' && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flagged content..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-md border border-border-strong bg-surface-raised text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
              </div>
              <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
                className="px-3 py-2.5 rounded-md border border-border-strong bg-surface-raised text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                <option value="all">All Severity</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-3">
              {visibleFlags.map(item => (
                <Card key={item.id} className={item.status !== 'pending' ? 'opacity-50' : ''}>
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-content-primary">{item.content?.author ?? 'Deleted content'}</span>
                          <span className="text-[10px] bg-surface-sunken text-content-secondary px-2 py-0.5 rounded-full capitalize">{item.type}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${severityColor[item.severity].bg} ${severityColor[item.severity].text}`}>
                            {severityColor[item.severity].label}
                          </span>
                          <span className="text-[10px] text-content-tertiary flex items-center gap-0.5 ml-auto"><Clock size={9} />{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-content-secondary mt-1 leading-relaxed">
                          {item.content?.body ?? '(This content no longer exists.)'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-content-tertiary flex-1">
                        {item.reason === 'keyword' ? (
                          <>
                            <Bot size={11} className="text-accent" />
                            <span>Triggered by: <strong className="text-content-secondary">&quot;{item.matched_terms?.join('", "')}&quot;</strong></span>
                          </>
                        ) : (
                          <span>Reported by <strong className="text-content-secondary">{item.reported_by}</strong></span>
                        )}
                      </div>
                      {item.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button onClick={() => resolveFlag(item.id, 'dismiss')} disabled={actingId === item.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors disabled:opacity-40">
                            <CheckCircle size={12} /> Dismiss
                          </button>
                          <button onClick={() => resolveFlag(item.id, 'escalate')} disabled={actingId === item.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-40">
                            <AlertTriangle size={12} /> Escalate
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.status === 'dismissed' ? 'bg-green-50 dark:bg-green-500/10 text-green-600' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                          {item.status === 'dismissed' ? 'Dismissed' : 'Escalated'}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {visibleFlags.length === 0 && (
                <div className="text-center py-16">
                  <Shield size={32} className="mx-auto text-content-tertiary dark:text-content-secondary mb-3" />
                  <p className="text-content-tertiary">No flagged content matching your filters</p>
                </div>
              )}
            </div>
            {flagsHasMore && (
              <Button variant="secondary" fullWidth size="sm" className="mt-3" loading={loadingMoreFlags} onClick={loadMoreFlags}>
                Load more
              </Button>
            )}
          </div>
        )}

        {/* Trigger Words */}
        {tab === 'triggers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-content-secondary">Posts and comments are scanned for these words and auto-queued for review.</p>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
                <Plus size={15} /> Add Word
              </button>
            </div>

            {showAdd && (
              <Card className="mb-4">
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <input value={newWord} onChange={e => setNewWord(e.target.value)} placeholder="Enter trigger word or phrase..."
                      className="flex-1 px-4 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                    <select value={newSev} onChange={e => setNewSev(e.target.value as Severity)}
                      className="px-3 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" fullWidth variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button size="sm" fullWidth onClick={addTrigger}>Add</Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">
              {triggers.map(t => (
                <div key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium ${severityColor[t.severity].bg} border-transparent`}>
                  <span className={`${severityColor[t.severity].text} capitalize text-[10px] font-bold`}>{t.severity[0].toUpperCase()}</span>
                  <span className="text-gray-800 dark:text-gray-200">&quot;{t.term}&quot;</span>
                  <button onClick={() => removeTrigger(t.id)}
                    className="text-content-tertiary hover:text-red-500 transition-colors ml-1">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {triggers.length === 0 && <p className="text-sm text-content-tertiary">No trigger words configured yet.</p>}
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
