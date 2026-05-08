'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { mockConversations } from '@/lib/mockData';
import { useUser } from '@/contexts/UserContext';
import { Search, Send, MoreHorizontal, Phone, Video } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useUser();
  const [selected, setSelected] = useState(mockConversations[0]);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState(mockConversations[0].messages);
  const [search, setSearch] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: `m-${Date.now()}`, senderId: '1', text, time: 'Just now', isOwn: true }]);
    setText('');
  };

  const filtered = mockConversations.filter(c =>
    c.participant.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardShell fullWidth>
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
          <div className="flex h-full">

            {/* Conversations list */}
            <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-base mb-3">Messages</h2>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search messages..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#F87404]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filtered.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => { setSelected(conv); setMessages(conv.messages); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${selected.id === conv.id ? 'bg-[#F87404]/5 border-l-2 border-l-[#F87404]' : ''}`}
                  >
                    <div className="flex-shrink-0">
                      <Avatar src={conv.participant.avatar} name={conv.participant.name} size={44} online={conv.participant.isOnline} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-gray-900 truncate">{conv.participant.name}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{conv.time}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                    </div>
                    {conv.unread > 0 && (
                      <span className="w-5 h-5 bg-[#F87404] rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Chat header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Avatar src={selected.participant.avatar} name={selected.participant.name} size={40} online={selected.participant.isOnline} />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{selected.participant.name}</p>
                    <p className="text-xs text-gray-400">{selected.participant.isOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><Phone size={17} /></button>
                  <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><Video size={17} /></button>
                  <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><MoreHorizontal size={17} /></button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex items-end gap-2.5 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
                    {!msg.isOwn && <Avatar src={selected.participant.avatar} name={selected.participant.name} size={32} />}
                    <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.isOwn ? 'bg-[#F87404] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'}`}>
                      <p className="leading-relaxed">{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${msg.isOwn ? 'text-white/70 text-right' : 'text-gray-400'}`}>{msg.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 focus-within:border-[#F87404] transition-colors">
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!text.trim()}
                    className="w-8 h-8 rounded-xl bg-[#F87404] flex items-center justify-center text-white hover:bg-[#e06000] transition-colors disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
