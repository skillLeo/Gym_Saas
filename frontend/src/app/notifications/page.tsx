'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui/Avatar';
import { mockNotifications } from '@/lib/mockData';
import {
  Heart, MessageCircle, UserPlus, Bell, Trophy, Settings, Check, Trash2
} from 'lucide-react';
import Link from 'next/link';

const typeIcon: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  message: MessageCircle,
  achievement: Trophy,
  system: Bell,
};

const typeColor: Record<string, string> = {
  like: '#FF0404',
  comment: '#004AAD',
  follow: '#10B981',
  message: '#F87404',
  achievement: '#FFC000',
  system: '#7C3AED',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications.map(n => ({ ...n, localRead: n.read })));

  const markAllRead = () => setNotifications(p => p.map(n => ({ ...n, localRead: true })));
  const markRead = (id: string) => setNotifications(p => p.map(n => n.id === id ? { ...n, localRead: true } : n));
  const remove = (id: string) => setNotifications(p => p.filter(n => n.id !== id));

  const unread = notifications.filter(n => !n.localRead).length;

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            {unread > 0 && (
              <p className="text-sm text-[#F87404]">{unread} unread</p>
            )}
          </div>
          <div className="flex gap-2">
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-[#F87404] font-medium hover:underline">
                <Check size={13} /> Mark all read
              </button>
            )}
            <Link href="/profile/settings">
              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
                <Settings size={16} className="text-gray-600 dark:text-gray-400" />
              </button>
            </Link>
          </div>
        </div>

        <div className="space-y-1">
          {notifications.map(notif => {
            const Icon = typeIcon[notif.type] || Bell;
            const color = typeColor[notif.type] || '#F87404';

            return (
              <Link key={notif.id} href={notif.link}>
                <div
                  onClick={() => markRead(notif.id)}
                  className={`flex items-start gap-3 p-4 rounded-2xl transition-all cursor-pointer ${!notif.localRead ? 'bg-[#F87404]/5 dark:bg-[#F87404]/5 border border-[#F87404]/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'}`}
                >
                  <div className="relative shrink-0">
                    {notif.actor ? (
                      <Avatar src={notif.actor.avatar} name={notif.actor.name} size={36} />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                    )}
                    {notif.actor && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0d0d0d]" style={{ backgroundColor: color }}>
                        <Icon size={10} className="text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                      {notif.actor && (
                        <span className="font-semibold">{notif.actor.name} </span>
                      )}
                      <span className={notif.localRead ? '' : 'font-medium'}>{notif.content}</span>
                      {notif.target && (
                        <span className="text-gray-500 dark:text-gray-400"> — {notif.target}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{notif.time}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!notif.localRead && (
                      <div className="w-2 h-2 rounded-full bg-[#F87404]" />
                    )}
                    <button onClick={(e) => { e.preventDefault(); remove(notif.id); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}

          {notifications.length === 0 && (
            <div className="text-center py-16">
              <Bell size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
            </div>
          )}
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
