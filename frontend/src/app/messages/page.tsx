'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import type { Locale } from '@/store/i18nStore';
import { formatDate, formatNumber } from '@/lib/format';
import { MessageImage } from '@/components/ui/MessageImage';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Search, Send, Phone, Video, MoreHorizontal, X,
  MessageCircle, Loader2, UserPlus, Paperclip
} from 'lucide-react';
import toast from 'react-hot-toast';

type OtherUser = { id: number; name: string; avatar: string | null };

type Conversation = {
  id:             number;
  other_user:     OtherUser | null;
  latest_message: Message | null;
  unread_count:   number;
  updated_at:     string;
};

type Message = {
  id:         number;
  content:    string;
  image_url?: string | null;
  is_mine:    boolean;
  sender:     OtherUser | null;
  created_at: string;
};

/**
 * The compact stamp on each conversation row.
 *
 * Was hardcoded to 'en-US', so a Spanish member's chat list still read "Aug 26".
 * The narrow unit format keeps it as short as the old "5m"/"2h" while still
 * being the member's language, and the fallback date now follows the locale.
 */
function fmtTime(iso: string, locale: Locale, t: (k: string) => string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);

  if (diffMin < 1) return t('messages.now');
  if (diffMin < 60) {
    return formatNumber(diffMin, locale, { style: 'unit', unit: 'minute', unitDisplay: 'narrow' });
  }

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return formatNumber(diffH, locale, { style: 'unit', unit: 'hour', unitDisplay: 'narrow' });
  }

  return formatDate(d, locale, { month: 'short', day: 'numeric' });
}

export default function MessagesPage() {
  const { t, locale } = useI18nStore();
  const router        = useRouter();
  const { user }      = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected,      setSelected]      = useState<Conversation | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [text,          setText]          = useState('');
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [searching,     setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; avatar: string | null; username?: string }>>([]);
  const [showSearch,    setShowSearch]    = useState(false);
  const [pendingImage, setPendingImage]   = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const attachRef   = useRef<HTMLInputElement>(null);
  const lastMsgIdRef = useRef<number>(0);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read by the list poll below, which must not be torn down and rebuilt every
  // time you click a different conversation.
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages');
      const convs: Conversation[] = res.data.conversations;
      // The open thread is being read as it arrives (both the open-thread poll
      // and GET /messages/{id} push `last_read_at` forward), but a message that
      // landed between that write and this response would otherwise flash an
      // unread badge on the conversation you are currently looking at.
      setConversations(convs.map(c =>
        c.id === selectedIdRef.current ? { ...c, unread_count: 0 } : c
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  // The list used to be fetched exactly once, on mount. Only the OPEN thread
  // polled, so an incoming message from someone you were not currently reading
  // changed nothing on screen — no unread badge, no new preview line, no
  // reordering — until the page was reloaded by hand.
  useEffect(() => {
    fetchConversations();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchConversations();
    }, 10_000);
    // Coming back to the tab should feel instant rather than waiting out the
    // remainder of the interval.
    const onVis = () => { if (document.visibilityState === 'visible') fetchConversations(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchConversations]);

  /**
   * Guards against two ways the wrong messages could end up under a name.
   *
   * The header switched to the newly-clicked person immediately while the old
   * conversation's messages stayed on screen for as long as the request took —
   * which on a slow connection is long enough to read them. Nothing leaked (the
   * server scopes every conversation to its participants), but it looked exactly
   * like someone else's private chat had been opened.
   *
   * The counter additionally settles the race when two conversations are clicked
   * in quick succession: without it, whichever response happens to land last
   * wins, so a slow first reply can overwrite the second one you asked for.
   */
  const selectSeqRef = useRef(0);

  const selectConversation = async (conv: Conversation) => {
    const seq = ++selectSeqRef.current;
    setSelected(conv);
    setMessages([]);
    setThreadLoading(true);
    lastMsgIdRef.current = 0;
    try {
      const res = await api.get(`/messages/${conv.id}`);
      if (seq !== selectSeqRef.current) return;
      const msgs: Message[] = res.data.messages;
      setMessages(msgs);
      lastMsgIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
      // mark as read locally
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    } catch {
      if (seq !== selectSeqRef.current) return;
      toast.error(t('messages.error.load'));
    } finally {
      if (seq === selectSeqRef.current) setThreadLoading(false);
    }
  };

  // Poll for new messages when a conversation is open.
  //
  // Every 4s rather than 3s, and skipped entirely while the tab is hidden. It
  // used to keep firing in a background tab, which on a development server that
  // handles one request at a time meant an unattended window could eat most of
  // the backend's capacity on its own.
  useEffect(() => {
    if (!selected) return;
    pollRef.current = setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await api.get(`/messages/${selected.id}/messages`, {
          params: { since: lastMsgIdRef.current }
        });
        const newMsgs: Message[] = res.data.messages;
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const deduped = newMsgs.filter(m => !existingIds.has(m.id));
            return deduped.length > 0 ? [...prev, ...deduped] : prev;
          });
          lastMsgIdRef.current = Math.max(lastMsgIdRef.current, ...newMsgs.map(m => m.id));
          // Keep the row in the list in step with the thread beside it, rather
          // than leaving a stale preview until the 10s list poll comes round.
          const latest = newMsgs[newMsgs.length - 1];
          setConversations(prev => prev.map(c =>
            c.id === selected.id ? { ...c, latest_message: latest, unread_count: 0 } : c
          ));
        }
      } catch { /* silent */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected]);

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
      if (attachRef.current) attachRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !pendingImage) || !selected || sending) return;
    const content = text.trim();
    const image = pendingImage;
    setText('');
    setPendingImage(null);
    setSending(true);
    const optimistic: Message = {
      id:         Date.now(),
      content,
      image_url:  image,
      is_mine:    true,
      sender:     null,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const res = await api.post(`/messages/${selected.id}/messages`, { content, image_url: image });
      const saved: Message = res.data.message;
      setMessages(prev => {
        // The poll may have already fetched this message while the send was in flight
        if (prev.some(m => m.id === saved.id)) return prev.filter(m => m.id !== optimistic.id);
        return prev.map(m => m.id === optimistic.id ? saved : m);
      });
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, saved.id);
      setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, latest_message: saved } : c));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(content);
      setPendingImage(image);
      toast.error(t('messages.error.send'));
    } finally {
      setSending(false);
    }
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get('/social/search', { params: { q } });
      setSearchResults(res.data.data?.slice(0, 8) ?? []);
    } finally {
      setSearching(false);
    }
  };

  const startConversation = async (userId: number) => {
    try {
      const res = await api.post('/messages/start', { user_id: userId });
      const conv: Conversation = res.data.conversation;
      setConversations(prev => {
        const exists = prev.find(c => c.id === conv.id);
        return exists ? prev : [conv, ...prev];
      });
      setShowSearch(false);
      setSearch('');
      selectConversation(conv);
    } catch {
      toast.error(t('messages.error.start'));
    }
  };

  const q = search.toLowerCase().trim();
  const filteredConvs = q
    ? conversations.filter(c => c.other_user?.name?.toLowerCase().includes(q))
    : conversations;

  const listPanel = (mobile: boolean) => (
    <div className={mobile ? 'flex flex-col h-full' : 'w-80 flex-shrink-0 border-r border-border-subtle flex flex-col'}>
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-content-primary text-base">Messages</h2>
          <button onClick={() => setShowSearch(s => !s)}
            className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center text-accent hover:bg-accent/20 transition-colors" title="New message">
            <UserPlus size={15} />
          </button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('messages.searchConversations')}
            className="w-full pl-9 pr-8 py-2.5 bg-surface-sunken border border-border-strong rounded-md text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent transition-colors"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary"><X size={13} /></button>}
        </div>
      </div>

      {showSearch && (
        <div className="px-3 py-2 bg-surface-sunken border-b border-border-subtle">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" />
            <input
              autoFocus
              placeholder={t('messages.searchUsers')}
              onChange={e => searchUsers(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-surface-raised border border-border-strong rounded-md text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent transition-colors"
            />
          </div>
          {searching && <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-content-tertiary" /></div>}
          <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
            {searchResults.map(u => (
              <button key={u.id} onClick={() => startConversation(u.id)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-left">
                <Avatar src={u.avatar || undefined} name={u.name} size={32} />
                <span className="text-sm font-medium text-content-primary">{u.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-content-tertiary" /></div>
        ) : filteredConvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <MessageCircle size={24} className="text-content-tertiary" />
            </div>
            <p className="text-sm font-semibold text-content-secondary">{t('messages.emptyConversations')}</p>
            <p className="text-xs text-content-tertiary mt-1">{t('messages.emptyHint')}</p>
          </div>
        ) : (
          filteredConvs.map(conv => (
            <button key={conv.id}
              onClick={() => {
                if (mobile) { router.push(`/messages/${conv.id}`); }
                else { selectConversation(conv); }
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left border-b border-gray-50 dark:border-white/5
                ${!mobile && selected?.id === conv.id ? 'bg-accent/5 border-l-2 border-l-[#F87404]' : ''}`}
            >
              <Avatar src={conv.other_user?.avatar || undefined} name={conv.other_user?.name ?? '?'} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="font-semibold text-sm text-content-primary truncate">{conv.other_user?.name ?? 'Unknown'}</p>
                  <span className="text-[10px] text-content-tertiary flex-shrink-0">
                    {conv.latest_message ? fmtTime(conv.latest_message.created_at, locale, t) : fmtTime(conv.updated_at, locale, t)}
                  </span>
                </div>
                <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'text-content-primary font-medium' : 'text-content-secondary'}`}>
                  {conv.latest_message ? conv.latest_message.content : t('messages.noMessagesYet')}
                </p>
              </div>
              {conv.unread_count > 0 && (
                <span className="min-w-[20px] h-5 bg-accent rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 px-1">
                  {conv.unread_count}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <DashboardShell fullWidth>
      {/* Header sits OUTSIDE the flex container: the panels below use
          `flex-1 min-h-0` for a full-height chat layout, and a sticky header
          nested inside that would fight the scroll containers. */}
      <div className="px-4 md:px-6">
        <PageHeader
          title={t('messages.title')}
          actions={
            <Link
              href="/messages/search"
              aria-label={t('messages.searchMessages')}
              className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
            >
              <Search size={20} strokeWidth={1.75} />
            </Link>
          }
        />
      </div>
      <div className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full px-4 md:px-6">

        {/* Mobile */}
        <div className="md:hidden flex-1 min-h-0 bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden flex flex-col">
          {listPanel(true)}
        </div>

        {/* Desktop split */}
        <div className="hidden md:flex flex-1 min-h-0 bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
          {listPanel(false)}

          {/* Chat pane */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
                <div className="w-20 h-20 rounded-md bg-accent-surface flex items-center justify-center">
                  <MessageCircle size={36} className="text-accent" />
                </div>
                <div>
                  <p className="font-bold text-xl text-content-primary mb-1">{t('messages.selectConversation')}</p>
                  <p className="text-sm text-content-tertiary">{t('messages.selectHint')}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar src={selected.other_user?.avatar || undefined} name={selected.other_user?.name ?? '?'} size={40} />
                    <div>
                      <p className="font-semibold text-sm text-content-primary">{selected.other_user?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-content-tertiary">{t('messages.activeUser')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="w-9 h-9 rounded-md flex items-center justify-center text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><Phone size={17} /></button>
                    <button className="w-9 h-9 rounded-md flex items-center justify-center text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><Video size={17} /></button>
                    <button className="w-9 h-9 rounded-md flex items-center justify-center text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><MoreHorizontal size={17} /></button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/30 dark:bg-black/10">
                  {threadLoading && (
                    <div className="flex justify-center py-10">
                      <Loader2 size={20} className="animate-spin text-content-tertiary" aria-label="Loading conversation" />
                    </div>
                  )}
                  {!threadLoading && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <p className="text-sm text-content-tertiary">{t('messages.emptyMessages')}</p>
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2.5 ${msg.is_mine ? 'flex-row-reverse' : ''}`}>
                      {!msg.is_mine && (
                        <Avatar src={selected.other_user?.avatar || undefined} name={selected.other_user?.name ?? '?'} size={30} />
                      )}
                      <div className={`max-w-xs px-4 py-2.5 rounded-md text-sm shadow-sm ${
                        msg.is_mine ? 'bg-accent text-white rounded-br-sm' : 'bg-surface-raised text-gray-800 dark:text-gray-200 border border-border-subtle rounded-bl-sm'
                      }`}>
                        {msg.image_url && (
                          <MessageImage src={msg.image_url} />
                        )}
                        {msg.content && <p className="leading-relaxed">{msg.content}</p>}
                        <p className={`text-[10px] mt-1 ${msg.is_mine ? 'text-white/70 text-right' : 'text-content-tertiary'}`}>
                          {fmtTime(msg.created_at, locale, t)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-5 py-3.5 border-t border-border-subtle shrink-0">
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
                    <input ref={attachRef} type="file" accept="image/*" className="hidden" onChange={handleAttach} disabled={uploadingImage} />
                    <button onClick={() => attachRef.current?.click()} disabled={uploadingImage}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-content-tertiary hover:text-accent hover:bg-accent-surface transition-colors shrink-0">
                      {uploadingImage ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={16} />}
                    </button>
                    <input
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder={t('messages.typeMessage')}
                      className="flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary field-inset outline-none"
                    />
                    <button onClick={handleSend} disabled={(!text.trim() && !pendingImage) || sending}
                      className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-white hover:bg-accent-hover transition-colors disabled:opacity-40">
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
