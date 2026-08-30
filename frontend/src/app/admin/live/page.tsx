'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Radio, Play, Eye, MessageCircle, Trash2, Clock, Settings2, Video,
  X, Zap, AlertCircle, Loader2,
} from 'lucide-react';
import { ImageWithFallback } from '@/components/ui/RecipeImage';

type LiveSession = {
  id:          number;
  title:       string;
  description: string | null;
  status:      'scheduled' | 'live' | 'ended';
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  duration_minutes: number | null;
  created_at:  string;
};

export default function AdminLivePage() {
  const [isLive,         setIsLive]         = useState(false);
  const [currentSession, setCurrentSession] = useState<LiveSession | null>(null);
  const [replays,        setReplays]        = useState<LiveSession[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showSetup,      setShowSetup]      = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);
  const [title,          setTitle]          = useState('');
  const [description,    setDescription]    = useState('');
  const [viewers,        setViewers]        = useState(0);
  // The comment tile used to render Math.floor(viewers * 0.4) — a number
  // invented from another number. This is the real count from the API.
  const [commentCount,   setCommentCount]   = useState(0);
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/live/current').catch(() => ({ data: { session: null } })),
      api.get('/live/replays'),
    ]).then(([cur, rep]) => {
      const sess = cur.data.session;
      if (sess?.status === 'live') { setCurrentSession(sess); setIsLive(true); setViewers(sess.viewers_count ?? 0); }
      setReplays(rep.data.replays ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // While live, keep the counters honest rather than static.
  useEffect(() => {
    if (!isLive || !currentSession) return;
    const tick = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const [cur, com] = await Promise.all([
          api.get('/live/current'),
          api.get(`/live/${currentSession.id}/comments`),
        ]);
        if (cur.data.session) setViewers(cur.data.session.viewers_count ?? 0);
        setCommentCount((com.data.comments ?? com.data.data ?? []).length);
      } catch { /* a counter must never break the page */ }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [isLive, currentSession]);

  const handleGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/live/admin/sessions', {
        title:          title,
        description:    description || null,
        status:         'live',
        instructor_name:'Kelvin Silas',
        stream_url:     null,
        category:       'General',
        difficulty:     'All Levels',
      });
      setCurrentSession(res.data.session);
      setIsLive(true);
      setShowSetup(false);
      setViewers(0);
      toast.success('You are now live!');
      // No synthetic ticker here. `live_session_views` records one row per
      // member who opens the session and the 10s poll above reads that real
      // count. This used to add 0-2 invented viewers every 5s, and the number
      // it produced was then saved to the database on end.
    } catch { toast.error('Failed to go live'); } finally { setSaving(false); }
  };

  const handleEndLive = async () => {
    if (!currentSession) return;
    setSaving(true);
    try {
      // Deliberately does not send viewers_count: the server already holds the
      // true distinct-viewer total. Sending the browser's copy would overwrite it.
      const res = await api.put(`/live/admin/sessions/${currentSession.id}`, { status: 'ended' });
      setReplays(prev => [res.data.session, ...prev]);
      setIsLive(false);
      setCurrentSession(null);
      setShowEndConfirm(false);
      setTitle('');
      setDescription('');
      setViewers(0);
      toast.success('Stream ended and saved as replay');
    } catch { toast.error('Failed to end stream'); } finally { setSaving(false); }
  };

  const handleDeleteReplay = async (id: number) => {
    setReplays(prev => prev.filter(r => r.id !== id));
    setDeleteConfirm(null);
    try { await api.delete(`/live/admin/sessions/${id}`); } catch {
      api.get('/live/replays').then(r => setReplays(r.data.replays ?? []));
    }
  };

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto w-full">

        <PageHeader
          title="Live Manager"
          subtitle={isLive ? 'You are live now' : 'Start a stream for your members'}
          back="/admin"
          actions={
            !isLive ? (
              <Button
                size="sm"
                onClick={() => setShowSetup(true)}
                icon={<Radio size={15} strokeWidth={2} />}
              >
                Go live
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setShowEndConfirm(true)}
                icon={<span className="h-2 w-2 rounded-full bg-white animate-pulse" />}
              >
                End stream
              </Button>
            )
          }
        />

        {isLive && currentSession ? (
          <div className="bg-black rounded-md p-6 mb-6 border border-[#FF0404]/30">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF0404] animate-pulse" />
                  <span className="text-brand-red font-black text-sm tracking-widest">LIVE NOW</span>
                </div>
                <h2 className="text-white font-bold text-xl">{currentSession.title}</h2>
                <p className="text-content-tertiary text-sm mt-1">{currentSession.description || 'No description set.'}</p>
              </div>
              <div className="bg-[#FF0404]/20 border border-[#FF0404]/40 rounded-md px-4 py-2 text-center flex-shrink-0">
                <p className="text-brand-red font-black text-2xl">{viewers}</p>
                {/* "watching" implied a live presence count nothing tracks.
                    This is how many members have opened the session. */}
                <p className="text-content-tertiary text-xs">joined</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Joined',   value: viewers, icon: Eye, color: 'text-accent' },
                { label: 'Duration', value: '—',     icon: Clock, color: 'text-white' },
                { label: 'Comments', value: commentCount, icon: MessageCircle, color: 'text-blue-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-md p-3 text-center">
                  <s.icon size={16} className={`mx-auto mb-1.5 ${s.color}`} />
                  <p className={`font-black text-lg ${s.color}`}>{s.value}</p>
                  <p className="text-content-secondary text-[10px] uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-white/5 border border-white/10 rounded-md p-3 flex items-start gap-2">
              <Zap size={14} className="text-accent flex-shrink-0 mt-0.5" />
              <p className="text-content-tertiary text-xs leading-relaxed">Members are being notified that you're live. Keep going!</p>
            </div>
          </div>
        ) : !loading && (
          <div className="bg-surface-raised rounded-md border border-border-subtle p-6 mb-6 shadow-sm">
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-[#FF0404]/10 flex items-center justify-center mx-auto mb-4">
                <Radio size={32} className="text-brand-red" />
              </div>
              <h2 className="font-bold text-content-primary text-xl mb-2">You're Not Live</h2>
              <p className="text-content-tertiary text-sm max-w-xs mx-auto mb-6 leading-relaxed">
                Go live to your members instantly. They'll be notified the moment you start, and the session saves automatically as a replay.
              </p>
              <button onClick={() => setShowSetup(true)}
                className="inline-flex items-center gap-2 bg-[#FF0404] hover:bg-[#cc0000] text-white font-bold px-8 py-3 rounded-md transition-all text-sm">
                <Radio size={16} /> Start Going Live
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-border-subtle">
              {[
                { step: '1', title: 'Set a title',       desc: 'Give your session a name',         icon: Settings2 },
                { step: '2', title: 'Click Go Live',     desc: 'Members get notified instantly',    icon: Radio },
                { step: '3', title: 'Auto-saves replay', desc: 'Saved automatically when you end', icon: Video },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3 p-3 rounded-md bg-surface-sunken">
                  <div className="w-7 h-7 rounded-lg bg-[#FF0404] flex items-center justify-center flex-shrink-0 text-white text-xs font-black">{s.step}</div>
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{s.title}</p>
                    <p className="text-xs text-content-tertiary mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-accent" /></div>}

        {!loading && (
          <div>
            <h2 className="font-bold text-content-primary text-lg mb-4 flex items-center gap-2">
              <Play size={18} className="text-accent" />
              Past Live Replays
              <span className="text-sm font-normal text-content-tertiary">({replays.length})</span>
            </h2>

            {replays.length === 0 ? (
              <div className="bg-surface-raised rounded-md border border-border-subtle py-12 text-center">
                <Play size={28} className="text-content-tertiary dark:text-content-secondary mx-auto mb-3" />
                <p className="text-content-secondary text-sm">No replays yet. Go live to create your first one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {replays.map(r => (
                  <div key={r.id} className="flex items-center gap-4 bg-surface-raised rounded-md border border-border-subtle p-4 hover:border-accent/30 hover: transition-all">
                    <div className="relative w-20 h-14 rounded-md overflow-hidden flex-shrink-0 bg-gray-900">
                      {r.thumbnail_url ? (
                        <ImageWithFallback src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Radio size={18} className="text-content-secondary" /></div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play size={14} className="text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-content-primary truncate">{r.title}</p>
                      <p className="text-xs text-content-tertiary mt-0.5">{fmtDate(r.created_at)} · {r.duration_minutes ? `${r.duration_minutes} min` : 'N/A'}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-content-tertiary">
                        <span className="flex items-center gap-1"><Eye size={10} /> {r.views_count} views</span>
                        <span className="flex items-center gap-1"><MessageCircle size={10} /> comments</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setDeleteConfirm(r.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-red-50 hover:text-brand-red transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Go Live modal */}
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowSetup(false)}>
            <div className="bg-surface-raised rounded-md w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                <div>
                  <h2 className="font-bold text-content-primary text-lg">Setup Live Session</h2>
                  <p className="text-xs text-content-tertiary mt-0.5">Members will be notified instantly when you go live</p>
                </div>
                <button onClick={() => setShowSetup(false)} className="w-8 h-8 rounded-md bg-surface-sunken flex items-center justify-center text-content-secondary hover:bg-gray-200 transition-colors"><X size={15} /></button>
              </div>
              <form onSubmit={handleGoLive} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Session Title *</label>
                  <input required value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Upper Body Strength — Chest &amp; Back"
                    className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 placeholder:text-content-tertiary outline-none focus-visible:border-[#FF0404] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Description (optional)</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                    placeholder="Tell your members what this session covers..."
                    className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 placeholder:text-content-tertiary outline-none focus-visible:border-[#FF0404] transition-colors resize-none" />
                </div>
                <div className="bg-surface-sunken rounded-md p-3 border border-border-subtle">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={13} className="text-accent" />
                    <p className="text-xs font-bold text-content-secondary">Member Notification Preview</p>
                  </div>
                  <div className="bg-surface-raised rounded-lg px-3 py-2 border border-border-subtle">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Kelvin Silas is LIVE!</p>
                    <p className="text-[11px] text-content-secondary mt-0.5 truncate">{title || 'Live Training Session'}</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowSetup(false)}
                    className="flex-1 py-2.5 rounded-md border border-border-strong text-sm font-semibold text-content-secondary hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-md bg-[#FF0404] text-white text-sm font-black hover:bg-[#cc0000] transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    Go Live Now
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* End stream confirm */}
        {showEndConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-raised rounded-md w-full max-w-sm p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-surface-sunken flex items-center justify-center mx-auto mb-4">
                <Radio size={22} className="text-content-secondary" />
              </div>
              <h3 className="font-bold text-content-primary text-lg mb-2">End the Stream?</h3>
              <p className="text-sm text-content-secondary mb-6 leading-relaxed">The session will be saved automatically as a replay.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowEndConfirm(false)}
                  className="flex-1 py-2.5 rounded-md border border-border-strong text-sm font-semibold text-content-secondary hover:bg-gray-50 transition-colors">Keep Streaming</button>
                <button onClick={handleEndLive} disabled={saving}
                  className="flex-1 py-2.5 rounded-md bg-gray-900 dark:bg-white text-content-primary text-sm font-bold hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors disabled:opacity-60">
                  {saving ? 'Ending...' : 'End Stream'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete replay confirm */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-raised rounded-md w-full max-w-sm p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-brand-red" />
              </div>
              <h3 className="font-bold text-content-primary text-lg mb-2">Delete Replay?</h3>
              <p className="text-sm text-content-secondary mb-6">Members will no longer be able to watch this session.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-md border border-border-strong text-sm font-semibold text-content-secondary hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => handleDeleteReplay(deleteConfirm)}
                  className="flex-1 py-2.5 rounded-md bg-[#FF0404] text-white text-sm font-bold hover:bg-red-600 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
