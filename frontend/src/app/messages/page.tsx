'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { mockConversations, mockMembers } from '@/lib/mockData';
import { Search, Send, Phone, Video, MoreHorizontal, X, UserPlus, MessageCircle } from 'lucide-react';

const existingIds = new Set(mockConversations.map(c => c.participant.id));
const otherMembers = mockMembers.filter(m => m.id !== '1' && !existingIds.has(m.id));

export default function MessagesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState(mockConversations[0]);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState(mockConversations[0].messages);
  const [search, setSearch] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, {
      id: `m-${prev.length + 100}`,
      senderId: '1',
      text,
      time: 'Just now',
      isOwn: true,
    }]);
    setText('');
  };

  const selectConv = (conv: typeof mockConversations[0], isMobile: boolean) => {
    if (isMobile) {
      router.push(`/messages/${conv.id}`);
    } else {
      setSelected(conv);
      setMessages(conv.messages);
    }
  };

  const q = search.toLowerCase().trim();
  const filteredConvs = q
    ? mockConversations.filter(c =>
        c.participant.name.toLowerCase().includes(q) ||
        c.participant.username.toLowerCase().includes(q)
      )
    : mockConversations;

  const filteredOther = q
    ? otherMembers.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q)
      )
    : otherMembers;

  const ConvList = ({ mobile }: { mobile: boolean }) => (
    <div className={mobile ? 'flex flex-col h-full' : 'w-80 flex-shrink-0 border-r border-gray-100 flex flex-col'}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-base">Messages</h2>
          <button className="w-8 h-8 rounded-xl bg-[#F87404]/10 flex items-center justify-center text-[#F87404] hover:bg-[#F87404]/20 transition-colors" title="New message">
            <UserPlus size={15} />
          </button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people or messages..."
            className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#F87404] focus:bg-white transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">

        {/* Conversations */}
        {filteredConvs.length > 0 && (
          <div>
            {q && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Conversations
              </p>
            )}
            {filteredConvs.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConv(conv, mobile)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50
                  ${!mobile && selected.id === conv.id ? 'bg-[#F87404]/5 border-l-2 border-l-[#F87404]' : ''}`}
              >
                <Avatar src={conv.participant.avatar} name={conv.participant.name} size={44} online={conv.participant.isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-sm text-gray-900 truncate">{conv.participant.name}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{conv.time}</span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${conv.unread > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <span className="min-w-[20px] h-5 bg-[#F87404] rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 px-1">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Other members — always visible below conversations */}
        {filteredOther.length > 0 && (
          <div>
            <p className="px-4 pt-4 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {q ? 'People' : 'Start a Conversation'}
            </p>
            {filteredOther.map(member => (
              <button
                key={member.id}
                onClick={() => router.push(`/social/${member.username}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
              >
                <Avatar src={member.avatar} name={member.name} size={40} online={member.isOnline} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{member.name}</p>
                  <p className="text-xs text-gray-500 truncate">@{member.username} · {member.followers} followers</p>
                </div>
                <span className="text-[10px] text-[#F87404] font-bold border border-[#F87404]/40 rounded-full px-2.5 py-1 flex-shrink-0 whitespace-nowrap">
                  Message
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty */}
        {filteredConvs.length === 0 && filteredOther.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <MessageCircle size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No results</p>
            <p className="text-xs text-gray-400 mt-1">Try a different name or username</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DashboardShell fullWidth>
      <div className="max-w-5xl mx-auto">

        {/* Mobile */}
        <div className="md:hidden bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
          <ConvList mobile />
        </div>

        {/* Desktop split view */}
        <div className="hidden md:flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
          <ConvList mobile={false} />

          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <Avatar src={selected.participant.avatar} name={selected.participant.name} size={40} online={selected.participant.isOnline} />
                <div>
                  <p className="font-semibold text-sm text-gray-900">{selected.participant.name}</p>
                  <p className="text-xs text-gray-400">{selected.participant.isOnline ? 'Online now' : 'Offline'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><Phone size={17} /></button>
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><Video size={17} /></button>
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><MoreHorizontal size={17} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/30">
              {messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2.5 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
                  {!msg.isOwn && <Avatar src={selected.participant.avatar} name={selected.participant.name} size={30} />}
                  <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    msg.isOwn ? 'bg-[#F87404] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                  }`}>
                    <p className="leading-relaxed">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.isOwn ? 'text-white/70 text-right' : 'text-gray-400'}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3.5 border-t border-gray-100 shrink-0">
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-[#F87404] transition-colors">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                />
                <button onClick={handleSend} disabled={!text.trim()}
                  className="w-8 h-8 rounded-xl bg-[#F87404] flex items-center justify-center text-white hover:bg-[#e06000] transition-colors disabled:opacity-40">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
