'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Calendar, MessageCircle, User } from 'lucide-react';
import { mockConversations } from '@/lib/mockData';

const tabs = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/social', icon: Users, label: 'Social' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/messages', icon: MessageCircle, label: 'Messages' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const unreadMessages = mockConversations.reduce((a, c) => a + c.unread, 0);

  const isActive = (href: string) => pathname?.startsWith(href);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/[0.07] pb-safe">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          const isMessages = href === '/messages';
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[52px] transition-all ${
                active ? 'text-[#F87404]' : 'text-gray-500 dark:text-gray-500'
              }`}
            >
              <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-[#F87404]/10' : ''}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {isMessages && unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#F87404] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadMessages}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium transition-all ${active ? 'text-[#F87404]' : ''}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
