'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import type { Locale } from '@/store/i18nStore';
import { formatRelative } from '@/lib/format';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Send, Users, Heart, Eye, Play, Clock, MessageCircle,
  ThumbsUp, Share2, Volume2, Maximize2, Loader2, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';

type LiveSession = {
  id:               number;
  title:            string;
  description:      string | null;
  instructor_name:  string;
  thumbnail_url:    string | null;
  stream_url:       string | null;
  status:           'scheduled' | 'live' | 'ended';
  scheduled_at:     string | null;
  viewers_count:    number;
  likes_count:      number;
  duration_minutes: number | null;
  category:         string;
  difficulty:       string;
  created_at:       string;
};

type Comment = {
  id:         number;
  content:    string;
  user:       { id: number; name: string; avatar: string | null };
  created_at: string;
};

/**
 * Relative time in the member's language.
 *
 * Was hand-rolled English ("3m ago"), which cannot translate — the wording and
 * the plural rules differ per language. Intl knows them.
 */
const fmtTime = (iso: string, locale: Locale): string => formatRelative(iso, locale);

export default function LivePage() {
  const { t, locale } = useI18nStore();
  const { user }  = useAuthStore();
  const [session,  setSession]  = useState<LiveSession | null>(null);
  const [replays,  setReplays]  = useState<LiveSession[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text,     setText]     = useState('');
  const [tab,      setTab]      = useState<'chat' | 'replays'>('chat');
  const [playing,  setPlaying]  = useState(false);
  const [liked,    setLiked]    = useState(false);
  const [likeCount,setLikeCount]= useState(0);
  const [loading,  setLoading]  = useState(true);
  const [viewingReplay, setViewingReplay] = useState<LiveSession | null>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const lastCommentId = useRef<number>(0);

  const fetchAll = useCallback(async () => {
    try {
      const [sessionRes, replaysRes] = await Promise.all([
        api.get('/live/current'),
        api.get('/live/replays'),
      ]);
      const s: LiveSession | null = sessionRes.data.session;
      setSession(s);
      if (s) {
        setLikeCount(s.likes_count);
        const commentsRes = await api.get(`/live/${s.id}/comments`);
        const c: Comment[] = commentsRes.data.comments;
        setComments(c);
        lastCommentId.current = c.length > 0 ? c[c.length - 1].id : 0;
      }
      setReplays(replaysRes.data.replays);
    } catch {
      toast.error(t('live.error.load'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Poll comments every 5s when session is live
  useEffect(() => {
    if (!session || session.status !== 'live') return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/live/${session.id}/comments`);
        const all: Comment[] = res.data.comments;
        const newOnes = all.filter(c => c.id > lastCommentId.current);
        if (newOnes.length > 0) {
          setComments(prev => [...prev.slice(-40), ...newOnes]);
          lastCommentId.current = newOnes[newOnes.length - 1].id;
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (chatPanelRef.current) {
      chatPanelRef.current.scrollTop = chatPanelRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!text.trim() || !session) return;
    const content = text.trim();
    setText('');
    const optimistic: Comment = {
      id:         Date.now(),
      content,
      user:       { id: user?.id ?? 0, name: user?.name ?? 'You', avatar: user?.avatar_url ?? null },
      created_at: new Date().toISOString(),
    };
    setComments(prev => [...prev, optimistic]);
    try {
      const res = await api.post(`/live/${session.id}/comments`, { content });
      const saved: Comment = res.data.comment;
      setComments(prev => prev.map(c => c.id === optimistic.id ? saved : c));
    } catch {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      setText(content);
    }
  };

  const handleLike = async () => {
    if (!session) return;
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    try { await api.post(`/live/${session.id}/like`); } catch { /* silent */ }
  };

  return (
    <DashboardShell>
      <div>

        <PageHeader title={t('live.title')} subtitle={t('live.subtitle')} />

        {/* Status banner (content, not a page header — it reports stream state) */}
        <div className="bg-black px-4 md:px-8 py-3 flex items-center gap-3 border-b border-white/10 rounded-sm">
          <div className="flex items-center gap-2">
            {session?.status === 'live' ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF0404] animate-pulse" />
                <span className="text-white font-bold text-sm tracking-wide">{t('live.badgeLive')}</span>
              </>
            ) : (
              <>
                <CalendarClock size={14} className="text-yellow-400" />
                <span className="text-yellow-400 font-bold text-sm tracking-wide">{t('live.badgeUpcoming')}</span>
              </>
            )}
          </div>
          <span className="text-content-tertiary text-sm truncate">{session?.title ?? t('live.noSession')}</span>
          {session && (
            <div className="ml-auto flex items-center gap-3 text-xs text-content-tertiary flex-shrink-0">
              <span className="flex items-center gap-1.5"><Eye size={12} className="text-accent" /> {t('live.joined', { count: session.viewers_count })}</span>
              <span className="flex items-center gap-1.5"><Users size={12} /> {session.instructor_name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row min-h-0 max-w-7xl mx-auto px-4 md:px-8 py-6 gap-6">

          {/* ── Left: Video + controls ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-accent" /></div>
            ) : !session ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Play size={32} className="text-content-tertiary" />
                </div>
                <p className="font-bold text-content-primary mb-1">{t('live.none')}</p>
                <p className="text-sm text-content-tertiary">{t('live.noneHint')}</p>
              </div>
            ) : (
              <>
                {/* Video player */}
                <div className="relative w-full rounded-md overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                  {session.stream_url && playing ? (
                    <iframe src={`${session.stream_url}?autoplay=1`} className="w-full h-full" allowFullScreen allow="autoplay" />
                  ) : (
                    <>
                      {session.thumbnail_url ? (
                        <img src={session.thumbnail_url} alt={t('live.streamAlt')} className="w-full h-full object-cover" style={{ opacity: playing ? 0.4 : 1 }} />
                      ) : (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <Play size={48} className="text-content-secondary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                      {/* LIVE badge */}
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        {session.status === 'live' && (
                          <div className="flex items-center gap-1.5 bg-[#FF0404] text-white text-xs font-black px-3 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                          </div>
                        )}
                        <div className="flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                          <Eye size={11} /> {session.viewers_count}
                        </div>
                      </div>

                      {!playing && (
                        <button onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center group">
                          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center group-hover:bg-accent/80 transition-all duration-300">
                            <Play size={32} className="text-white fill-white ml-2" />
                          </div>
                        </button>
                      )}

                      {playing && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-3">
                              {[0,1,2,3,4].map(i => (
                                <div key={i} className="w-1.5 rounded-full bg-accent animate-bounce"
                                  style={{ height: [32,48,24,40,32][i], animationDelay: `${i * 150}ms` }} />
                              ))}
                            </div>
                            <p className="text-white text-sm font-semibold">{t('live.streamPlaying')}</p>
                            <button onClick={() => setPlaying(false)} className="text-xs text-content-tertiary mt-1 hover:text-white transition-colors">{t('live.clickToPause')}</button>
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPlaying(p => !p)}
                            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:bg-accent transition-colors">
                            <Play size={14} className="fill-white ml-0.5" />
                          </button>
                          <button className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                            <Volume2 size={14} />
                          </button>
                        </div>
                        <button className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                          <Maximize2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Trainer info + actions */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                        {session.instructor_name[0]}
                      </div>
                      {session.status === 'live' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF0404] border-2 border-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-content-primary">{session.instructor_name}</p>
                      <p className="text-sm text-content-secondary">Team Extreme Fitness Coach · {session.status === 'live' ? t('live.now') : t('live.upcoming')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleLike}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold border transition-all ${liked ? 'bg-[#FF0404] text-white border-[#FF0404]' : 'border-border-strong text-content-secondary hover:border-[#FF0404] hover:text-brand-red'}`}>
                      <ThumbsUp size={14} className={liked ? 'fill-white' : ''} /> {likeCount}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success(t('live.linkCopied')); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold border border-border-strong text-content-secondary hover:border-accent hover:text-accent transition-all">
                      <Share2 size={14} /> {t('live.share')}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-surface-raised rounded-md border border-border-subtle p-4">
                  <h1 className="font-bold text-content-primary text-lg mb-1">{session.title}</h1>
                  {session.description && <p className="text-sm text-content-secondary">{session.description}</p>}
                  <div className="flex gap-3 mt-2 text-xs text-content-tertiary">
                    <span className="flex items-center gap-1"><Eye size={11} /> {t('live.joined', { count: session.viewers_count })}</span>
                    <span className="flex items-center gap-1"><Heart size={11} /> {t('live.likes', { count: likeCount })}</span>
                    <span className="flex items-center gap-1 capitalize">{session.difficulty} · {session.category}</span>
                  </div>
                </div>

                {/* Replays desktop */}
                <div className="hidden lg:block">
                  <ReplaysList replays={replays} onSelect={setViewingReplay} />
                </div>
              </>
            )}
          </div>

          {/* ── Right: Chat ── */}
          {session && (
            <div className="w-full lg:w-80 flex flex-col bg-surface-raised rounded-md border border-border-subtle overflow-hidden shadow-sm" style={{ height: 600 }}>
              <div className="flex border-b border-border-subtle shrink-0">
                {(['chat', 'replays'] as const).map(tabKey => (
                  <button key={tabKey} onClick={() => setTab(tabKey)}
                    className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${tab === tabKey ? 'text-accent border-b-2 border-accent' : 'text-content-secondary'}`}>
                    {tabKey === 'chat' ? t('live.chatCount', { count: comments.length }) : t('live.replays')}
                  </button>
                ))}
              </div>

              {tab === 'chat' ? (
                <>
                  <div ref={chatPanelRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50 dark:bg-black/10">
                    {comments.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageCircle size={24} className="text-content-tertiary dark:text-content-secondary mb-2" />
                        <p className="text-xs text-content-tertiary">{t('live.firstComment')}</p>
                      </div>
                    )}
                    {comments.map(c => {
                      const isMe = c.user.id === (user?.id ?? -1);
                      return (
                        <div key={c.id} className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <Avatar src={c.user.avatar || undefined} name={c.user.name} size={28} />
                          <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            <p className="text-[10px] text-content-tertiary mb-0.5 px-1">{isMe ? 'You' : c.user.name}</p>
                            <div className={`px-3 py-1.5 rounded-md text-xs leading-relaxed ${isMe ? 'bg-accent text-white rounded-br-sm' : 'bg-white dark:bg-white/10 text-gray-800 dark:text-gray-200 border border-border-subtle rounded-bl-sm'}`}>
                              {c.content}
                            </div>
                            <p className="text-[9px] text-content-tertiary mt-0.5 px-1">{fmtTime(c.created_at, locale)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-3 border-t border-border-subtle shrink-0">
                    <div className="flex items-center gap-2 bg-surface-sunken border border-border-strong rounded-md px-3 py-2 focus-within:border-accent transition-colors">
                      <input value={text} onChange={e => setText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder={t('live.comment')}
                        className="flex-1 bg-transparent text-xs text-content-primary placeholder:text-content-tertiary field-inset outline-none"
                      />
                      <button onClick={handleSend} disabled={!text.trim()}
                        className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white hover:bg-accent-hover transition-colors disabled:opacity-40">
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-3">
                  <ReplaysList replays={replays} compact onSelect={setViewingReplay} />
                </div>
              )}
            </div>
          )}

          {/* Replays mobile */}
          {session && (
            <div className="lg:hidden">
              <ReplaysList replays={replays} onSelect={setViewingReplay} />
            </div>
          )}
        </div>
      </div>

      {/* Replay detail modal */}
      {viewingReplay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setViewingReplay(null)}>
          <div className="bg-surface-raised rounded-md w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
              {viewingReplay.thumbnail_url ? (
                <img src={viewingReplay.thumbnail_url} alt={viewingReplay.title} className="w-full h-full object-cover opacity-60" />
              ) : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <Play size={32} className="text-white/80" />
                <p className="text-white/80 text-sm font-medium">{t('live.replayUnavailable')}</p>
                <p className="text-white/50 text-xs">{t('live.savedBelow')}</p>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-content-primary text-lg mb-1">{viewingReplay.title}</h3>
              <p className="text-xs text-content-tertiary mb-3">{viewingReplay.instructor_name} · {viewingReplay.category} · {viewingReplay.difficulty}</p>
              {viewingReplay.description && (
                <p className="text-sm text-content-secondary mb-3">{viewingReplay.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-content-tertiary mb-4">
                <span className="flex items-center gap-1"><Eye size={12} /> {viewingReplay.viewers_count.toLocaleString()} watched</span>
                <span className="flex items-center gap-1"><Heart size={12} /> {t('live.likes', { count: viewingReplay.likes_count })}</span>
                {viewingReplay.duration_minutes && <span className="flex items-center gap-1"><Clock size={12} /> {viewingReplay.duration_minutes}m</span>}
              </div>
              <button onClick={() => setViewingReplay(null)}
                className="w-full py-2.5 rounded-md bg-surface-sunken text-sm font-semibold text-content-secondary hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function ReplaysList({ replays, compact = false, onSelect }: { replays: LiveSession[]; compact?: boolean; onSelect: (r: LiveSession) => void }) {
  const { t, locale } = useI18nStore();

  return (
    <div>
      {!compact && (
        <h2 className="text-lg font-bold text-content-primary mb-4 flex items-center gap-2">
          <MessageCircle size={18} className="text-accent" /> {t('live.past')}
        </h2>
      )}
      {replays.length === 0 && (
        <p className="text-sm text-content-tertiary text-center py-4">{t('live.noReplays')}</p>
      )}
      <div className="space-y-3">
        {replays.map(replay => (
          <div key={replay.id} onClick={() => onSelect(replay)}
            className="group flex gap-3 bg-surface-raised rounded-md border border-border-subtle overflow-hidden hover:border-accent/30 hover: transition-all cursor-pointer">
            <div className="relative flex-shrink-0 w-28 overflow-hidden bg-gray-100 dark:bg-white/5">
              {replay.thumbnail_url ? (
                <img src={replay.thumbnail_url} alt={replay.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-20 flex items-center justify-center"><Play size={18} className="text-content-tertiary" /></div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play size={18} className="text-white fill-white" />
              </div>
              {replay.duration_minutes && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  {replay.duration_minutes}m
                </div>
              )}
            </div>
            <div className="flex-1 py-2.5 pr-3 min-w-0">
              <p className="font-bold text-sm text-content-primary leading-tight line-clamp-2 mb-1 group-hover:text-accent transition-colors">{replay.title}</p>
              <p className="text-[11px] text-content-tertiary mb-1.5">{replay.instructor_name} · {replay.category}</p>
              <div className="flex items-center gap-3 text-[10px] text-content-tertiary">
                <span className="flex items-center gap-1"><Eye size={9} /> {replay.viewers_count.toLocaleString()}</span>
                <span className="flex items-center gap-1"><Heart size={9} /> {replay.likes_count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
