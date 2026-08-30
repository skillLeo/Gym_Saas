'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/store/i18nStore';
import { useI18nStore } from '@/store/i18nStore';
import { MessageImage } from '@/components/ui/MessageImage';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import api from '@/lib/api';
import { ChevronLeft, Send, Phone, Video, MoreHorizontal, Loader2, Paperclip, X, Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';

type OtherUser = { id: number; name: string; avatar: string | null };
type Message = {
  id:         number;
  content:    string;
  image_url?: string | null;
  is_mine:    boolean;
  sender:     OtherUser | null;
  created_at: string;
};
type ConvInfo = {
  id:         number;
  other_user: OtherUser | null;
};

/** Module scope, so the locale is passed in rather than read here. */
function fmtTime(iso: string, locale: Locale): string {
  return formatDate(new Date(iso), locale, { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationPage() {
  const { t, locale } = useI18nStore();
  const params = useParams();
  const convId = params?.conversationId as string;

  const [conv,     setConv]     = useState<ConvInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [denied,   setDenied]   = useState(false);
  const [sending,  setSending]  = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIdRef    = useRef<number>(0);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversation = useCallback(async () => {
    if (!convId) return;
    try {
      const res = await api.get(`/messages/${convId}`);
      setConv(res.data.conversation);
      const msgs: Message[] = res.data.messages;
      setMessages(msgs);
      lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
    } catch (e: unknown) {
      // Typing someone else's conversation id into the address bar is correctly
      // refused by the server, but this used to render an empty chat with no
      // name and a toast that had already faded — indistinguishable from the app
      // being broken. Say plainly that the conversation is not theirs.
      const status = (e as { response?: { status?: number } })?.response?.status;
      setDenied(status === 403 || status === 404);
      if (status !== 403 && status !== 404) toast.error(t('conversation.error.load'));
    } finally {
      setLoading(false);
    }
  }, [convId]);

  useEffect(() => { fetchConversation(); }, [fetchConversation]);

  useEffect(() => {
    // `denied` stops the poll re-asking for a conversation the server has
    // already refused; without it the page sat quietly firing a 403 every few
    // seconds for as long as it was open.
    if (!convId || denied) return;
    // Skipped while the tab is hidden: the backend serves one request at a
    // time in development, so a background tab polling forever competes with
    // the window the member is actually looking at.
    pollRef.current = setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await api.get(`/messages/${convId}/messages`, { params: { since: lastIdRef.current } });
        const newMsgs: Message[] = res.data.messages;
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const deduped = newMsgs.filter(m => !existingIds.has(m.id));
            return deduped.length > 0 ? [...prev, ...deduped] : prev;
          });
          lastIdRef.current = Math.max(lastIdRef.current, ...newMsgs.map(m => m.id));
        }
      } catch { /* silent */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [convId, denied]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'messages');
      const res = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPendingImage(res.data.image_url);
    } catch {
      toast.error(t('messages.error.upload'));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !pendingImage) || sending || !convId) return;
    const content = input.trim();
    const image = pendingImage;
    setInput('');
    setPendingImage(null);
    setSending(true);
    const optimistic: Message = {
      id:         Date.now(),
      content,
      image_url:  image,
      is_mine:    true,
      sender:     null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const res = await api.post(`/messages/${convId}/messages`, { content, image_url: image });
      const saved: Message = res.data.message;
      setMessages(prev => {
        // The poll may have already fetched this message while the send was in flight
        if (prev.some(m => m.id === saved.id)) return prev.filter(m => m.id !== optimistic.id);
        return prev.map(m => m.id === optimistic.id ? saved : m);
      });
      lastIdRef.current = Math.max(lastIdRef.current, saved.id);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(content);
      setPendingImage(image);
      toast.error(t('conversation.error.send'));
    } finally {
      setSending(false);
    }
  };

  if (denied) {
    return (
      <DashboardShell>
        <div className="max-w-md mx-auto text-center py-20 px-4">
          <div className="w-14 h-14 rounded-md bg-surface-sunken flex items-center justify-center mx-auto mb-4">
            <Lock size={24} strokeWidth={1.75} className="text-content-tertiary" />
          </div>
          <h1 className="font-semibold text-content-primary mb-1.5">{t('conversation.notYours')}</h1>
          <p className="text-body-sm text-content-secondary mb-6">
            {t('conversation.notYoursHint')}
          </p>
          <Link href="/messages"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-colors">
            <ChevronLeft size={16} strokeWidth={2} />
            {t('conversation.backLong')}
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    // `fullWidth` is what gives the shell a real height (see AppShell). Without
    // it the `h-full` below had nothing to measure against, so the message list
    // never became its own scroll container and the whole page scrolled — which
    // on mobile meant the composer scrolled off the bottom of the screen.
    <DashboardShell fullWidth>
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full px-4 md:px-6">

        {/*
          Intentionally NOT the shared <PageHeader />. A chat detail header's job
          is to show WHO you are talking to — avatar, name, presence — which
          PageHeader has no slot for. Swapping it in would drop the avatar and
          make the screen less useful. Documented so it does not read as a miss.

          Removed: Phone and Video buttons. Neither had an onClick — they looked
          tappable and did nothing. There is no calling feature to wire them to.
        */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle shrink-0 bg-surface-raised rounded-t-md">
          <Link
            href="/messages"
            aria-label={t('conversation.back')}
            className="w-9 h-9 flex items-center justify-center rounded-sm hover:bg-surface-sunken transition-colors text-content-secondary"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </Link>
          {conv?.other_user && (
            <>
              <Avatar src={conv.other_user.avatar || undefined} name={conv.other_user.name} size={38} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-body-sm text-content-primary truncate">{conv.other_user.name}</p>
              </div>
            </>
          )}
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 rounded-md flex items-center justify-center text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><MoreHorizontal size={17} /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30 dark:bg-black/10">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <p className="text-sm text-content-tertiary">{t('messages.emptyMessages')}</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.is_mine ? 'flex-row-reverse' : ''}`}>
                {!msg.is_mine && conv?.other_user && (
                  <Avatar src={conv.other_user.avatar || undefined} name={conv.other_user.name} size={28} />
                )}
                <div className={`max-w-xs md:max-w-sm px-4 py-2.5 rounded-md text-sm shadow-sm ${
                  msg.is_mine
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-surface-raised text-gray-800 dark:text-gray-200 border border-border-subtle rounded-bl-sm'
                }`}>
                  {msg.image_url && (
                    <MessageImage src={msg.image_url} />
                  )}
                  {msg.content && <p className="leading-relaxed">{msg.content}</p>}
                  <p className={`text-[10px] mt-1 ${msg.is_mine ? 'text-white/70 text-right' : 'text-content-tertiary'}`}>
                    {fmtTime(msg.created_at, locale)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3.5 border-t border-border-subtle shrink-0 bg-white dark:bg-[#111] rounded-b-2xl">
          {pendingImage && (
            <div className="relative inline-block mb-2">
              <img src={pendingImage} alt="" className="h-16 rounded-md object-cover" />
              <button onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors">
                <X size={11} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 bg-surface-sunken border border-border-strong rounded-md px-4 py-2.5 focus-within:border-accent transition-colors">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAttach} disabled={uploadingImage} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-accent hover:bg-accent-surface transition-colors shrink-0">
              {uploadingImage ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={t('messages.typeMessage')}
              className="flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary field-inset outline-none"
            />
            <button onClick={sendMessage} disabled={(!input.trim() && !pendingImage) || sending}
              className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-white hover:bg-accent-hover transition-colors disabled:opacity-40">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
