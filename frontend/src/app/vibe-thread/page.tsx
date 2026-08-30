'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import { Bell, BellOff, CornerUpLeft, Loader2, Send, Shield, Trash2, X } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader, HeaderAction } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface VibeMessage {
  id: number;
  body: string;
  is_admin: boolean;
  edited_at: string | null;
  created_at: string;
  user: { id: number | null; name: string | null; username: string | null; avatar: string | null };
  reply_to: { id: number; body: string; name: string | null } | null;
}

/**
 * Polling interval.
 *
 * The private-messaging screen polls every 3s, but that is one conversation
 * between two people. This is a single channel every online member watches at
 * once, so the same cadence multiplies by the whole active user base. 5s keeps
 * it feeling live while roughly halving that load — a judgment call, easily
 * reverted by changing this constant.
 */
const POLL_MS = 5000;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export default function VibeThreadPage() {
  const { t } = useI18nStore();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<VibeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<VibeMessage | null>(null);

  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Only auto-scroll when the reader is already at the bottom, so new traffic
  // never yanks someone away from what they are reading.
  const pinnedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/vibe-thread');
      const list: VibeMessage[] = data.data ?? [];
      setMessages(list);
      setHasMore(Boolean(data.meta?.has_more));
      setMuted(Boolean(data.meta?.muted));
      if (list.length) lastIdRef.current = list[list.length - 1].id;
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Incremental poll, matching the dedup guard used by private messaging.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { data } = await api.get('/vibe-thread', { params: { since: lastIdRef.current } });
        const incoming: VibeMessage[] = data.data ?? [];
        if (!incoming.length) return;

        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const fresh = incoming.filter((m) => !seen.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id));
      } catch { /* silent — polling must not spam toasts */ }
    }, POLL_MS);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function loadEarlier() {
    if (!messages.length) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get('/vibe-thread', { params: { before: messages[0].id } });
      const older: VibeMessage[] = data.data ?? [];
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(Boolean(data.meta?.has_more));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const { data } = await api.post('/vibe-thread', {
        body: text,
        reply_to_id: replyTo?.id ?? null,
      });
      setMessages((prev) => (prev.some((m) => m.id === data.data.id) ? prev : [...prev, data.data]));
      lastIdRef.current = Math.max(lastIdRef.current, data.data.id);
      setBody('');
      setReplyTo(null);
      pinnedRef.current = true;
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      toast.error(status === 429
        ? 'Slow down a moment — you are posting very quickly.'
        : getErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function toggleMute() {
    try {
      const { data } = await api.post('/vibe-thread/mute', { muted: !muted });
      setMuted(data.muted);
      toast.success(data.message);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/vibe-thread/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto flex flex-col">
        <PageHeader
          title={t('vibe.title')}
          subtitle={t('vibe.subtitle')}
          actions={
            <HeaderAction label={muted ? 'Unmute notifications' : 'Mute notifications'} onClick={toggleMute}>
              {muted ? <BellOff size={20} strokeWidth={1.75} /> : <Bell size={20} strokeWidth={1.75} />}
            </HeaderAction>
          }
        />

        {muted && (
          <p className="text-caption text-content-tertiary mb-3">
            Notifications are muted. You are still reading the thread as normal.
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label="Loading thread" />
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : (
          <>
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="space-y-3"
            >
              {hasMore && (
                <div className="flex justify-center">
                  <Button size="sm" variant="ghost" loading={loadingMore} onClick={loadEarlier}>
                    {t('vibe.loadEarlier')}
                  </Button>
                </div>
              )}

              {messages.length === 0 ? (
                <EmptyState title={t('vibe.empty')} description={t('vibe.emptyHint')} />
              ) : (
                messages.map((m) => {
                  const mine = m.user.id === user?.id;
                  return (
                    <article
                      key={m.id}
                      className={[
                        'rounded-md p-3.5 flex gap-3',
                        // Admin posts are visually distinct, per the brief.
                        m.is_admin
                          ? 'border-2 border-accent bg-accent-surface'
                          : 'border border-border bg-surface-raised',
                      ].join(' ')}
                    >
                      <Avatar src={m.user.avatar ?? undefined} name={m.user.name ?? '?'} size="sm" />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-body-sm text-content-primary">
                            {m.user.name ?? t('vibe.badge.member')}
                          </span>
                          {m.is_admin && (
                            <span className="inline-flex items-center gap-1 text-caption font-semibold text-accent">
                              <Shield size={11} strokeWidth={2.25} aria-hidden /> {t('vibe.badge.team')}
                            </span>
                          )}
                          <span className="text-caption text-content-tertiary">{timeOf(m.created_at)}</span>
                          {m.edited_at && <span className="text-caption text-content-tertiary">edited</span>}
                        </div>

                        {m.reply_to && (
                          <p className="mt-1.5 pl-2.5 border-l-2 border-border-strong text-caption text-content-tertiary truncate">
                            {m.reply_to.name}: {m.reply_to.body}
                          </p>
                        )}

                        <p className="text-body-sm text-content-secondary mt-1 whitespace-pre-wrap break-words">
                          {m.body}
                        </p>

                        <div className="flex items-center gap-1 mt-1.5 -ml-1.5">
                          <button type="button" onClick={() => setReplyTo(m)}
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-sm text-caption text-content-tertiary hover:text-content-primary hover:bg-surface-sunken transition-colors">
                            <CornerUpLeft size={12} strokeWidth={2} aria-hidden /> {t('vibe.reply')}
                          </button>
                          {(mine || user?.is_admin) && (
                            <button type="button" onClick={() => remove(m.id)}
                              aria-label={t('vibe.deleteMessage')}
                              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-sm text-caption text-content-tertiary hover:text-error hover:bg-surface-sunken transition-colors">
                              <Trash2 size={12} strokeWidth={2} aria-hidden /> {t('vibe.delete')}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="sticky bottom-0 pt-3 pb-1 bg-surface-base mt-4">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-sm bg-surface-sunken border border-border-subtle">
                  <CornerUpLeft size={13} strokeWidth={2} className="text-content-tertiary shrink-0" aria-hidden />
                  <p className="text-caption text-content-secondary truncate flex-1">
                    Replying to {replyTo.user.name}
                  </p>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label={t('vibe.cancelReply')}
                    className="h-7 w-7 rounded-sm flex items-center justify-center text-content-tertiary hover:text-content-primary">
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(e); }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder={t('vibe.compose')}
                  className="flex-1 min-h-11 max-h-32 bg-surface-sunken border border-border-strong rounded-md px-3.5 py-2.5 text-body-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors resize-none"
                />
                <Button type="submit" loading={sending} disabled={!body.trim() || sending}
                  aria-label={t('vibe.sendMessage')} icon={<Send size={16} strokeWidth={2} />}>
                  {t('vibe.send')}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
