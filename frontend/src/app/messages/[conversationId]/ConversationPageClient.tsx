'use client';

import { useState, useRef, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { mockConversations, mockMembers } from '@/lib/mockData';
import { ChevronLeft, Send, Image, Smile, Phone, Video, MoreHorizontal, Check, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ConversationPage() {
  const params = useParams();
  const convId = params?.conversationId as string;

  const conv = mockConversations.find(c => c.id === convId) || mockConversations[0];
  const me = mockMembers[0];

  const [messages, setMessages] = useState(conv.messages);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg = { id: `m${Date.now()}`, senderId: '1', text: input.trim(), time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), isOwn: true };
    setMessages(prev => [...prev, newMsg]);
    setInput('');

    // Simulate reply
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, {
        id: `m${Date.now() + 1}`,
        senderId: conv.participant.id,
        text: "That's awesome! Keep up the great work! 💪",
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        isOwn: false,
      }]);
    }, 1800);
  };

  const quickReplies = ["👍", "🔥 Let's go!", "Nice work!", "When's the next session?", "Proud of you!"];

  return (
    <DashboardShell fullWidth>
      <div className="flex-1 min-h-0 flex flex-col max-w-lg mx-auto w-full">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-white/[0.07] shrink-0">
          <Link href="/messages">
            <button className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>

          <Link href={`/social/${conv.participant.username}`} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative shrink-0">
              <img src={conv.participant.avatar} alt={conv.participant.name}
                className="w-9 h-9 rounded-full object-cover" />
              {conv.participant.isOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-[#1a1a1a]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{conv.participant.name}</div>
              <div className="text-xs text-gray-400">{conv.participant.isOnline ? 'Online now' : 'Last seen recently'}</div>
            </div>
          </Link>

          <div className="flex gap-1 shrink-0">
            <button className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500">
              <Phone size={15} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500">
              <Video size={15} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500">
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-[#0d0d0d]">

          {/* Date separator */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
            <span className="text-xs text-gray-400">Today</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              {!msg.isOwn && (
                <img src={conv.participant.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mb-0.5" />
              )}
              <div className={`max-w-[75%] ${msg.isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.isOwn
                    ? 'bg-[#F87404] text-white rounded-br-sm'
                    : 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border border-gray-100 dark:border-white/[0.07] rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
                <div className={`flex items-center gap-1 text-[10px] text-gray-400 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
                  <span>{msg.time}</span>
                  {msg.isOwn && <CheckCheck size={12} className="text-[#F87404]" />}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="flex items-end gap-2">
              <img src={conv.participant.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Replies */}
        <div className="flex gap-2 px-4 py-2 bg-white dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-white/[0.07] overflow-x-auto scrollbar-hide shrink-0">
          {quickReplies.map(r => (
            <button key={r} onClick={() => setInput(r)}
              className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-xs text-gray-700 dark:text-gray-300 hover:border-[#F87404]/40 hover:text-[#F87404] transition-all whitespace-nowrap shrink-0">
              {r}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 px-4 py-3 bg-white dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-white/[0.07] shrink-0">
          <button className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-[#F87404] hover:bg-[#F87404]/10 transition-colors shrink-0">
            <Image size={18} />
          </button>
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Message..."
              className="w-full px-4 py-3 pr-10 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#F87404] transition-colors">
              <Smile size={16} />
            </button>
          </div>
          <button onClick={sendMessage} disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-[#F87404] flex items-center justify-center text-white shadow-md shadow-orange-500/20 hover:bg-[#e66a00] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0">
            <Send size={16} />
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
