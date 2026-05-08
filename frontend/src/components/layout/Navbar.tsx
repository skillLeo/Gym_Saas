'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Bell, MessageCircle, ChevronDown, Menu, X, User, Settings,
  CreditCard, LogOut, LayoutDashboard, Utensils, Dumbbell,
  Users, BookOpen, Calendar, Bot, Shield, Key,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { mockNotifications, mockConversations } from '@/lib/mockData';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/food-journal', label: 'Food Journal', icon: Utensils },
  { href: '/fitness', label: 'Fitness', icon: Dumbbell },
  { href: '/social', label: 'Community', icon: Users },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/ai-trainer', label: 'AI Trainer', icon: Bot },
];

export function Navbar() {
  const { user, role } = useUser();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unreadNotifs = mockNotifications.filter(n => !n.read).length;
  const unreadMessages = mockConversations.reduce((a, c) => a + c.unread, 0);

  const isActive = (href: string) => pathname?.startsWith(href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/80 dark:border-white/[0.07] bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/dashboard" className="shrink-0 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F87404] flex items-center justify-center text-white font-display font-bold text-sm shadow-md">
            MX
          </div>
          <span className="font-display text-[15px] font-semibold text-gray-900 dark:text-white hidden sm:block">
            My EXtreme Trainer
          </span>
        </Link>

        {/* Center nav — desktop */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive(href)
                  ? 'bg-[#F87404]/10 text-[#F87404] dark:bg-[#F87404]/15'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              {label}
            </Link>
          ))}
          {role === 'admin' && (
            <>
              <Link href="/admin" className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${isActive('/admin') && !isActive('/admin/api-keys') ? 'bg-blue-500/10 text-blue-500' : 'text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]'}`}>
                <Shield size={14} /> Admin
              </Link>
              <Link href="/admin/api-keys" className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${isActive('/admin/api-keys') ? 'bg-blue-500/10 text-blue-500' : 'text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]'}`}>
                <Key size={14} /> API Keys
              </Link>
            </>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Notifications */}
          <Link href="/notifications" className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
            <Bell size={19} />
            {unreadNotifs > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-[#F87404] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadNotifs}
              </span>
            )}
          </Link>

          {/* Messages */}
          <Link href="/messages" className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
            <MessageCircle size={19} />
            {unreadMessages > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-[#F87404] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadMessages}
              </span>
            )}
          </Link>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
            >
              <Avatar src={user.avatar} name={user.name} size={32} online />
              <ChevronDown size={14} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-12 z-20 w-56 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-100 dark:border-white/[0.07] py-2 animate-fade-in">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.07]">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                  {[
                    { href: '/profile', icon: User, label: 'My Profile' },
                    { href: '/profile/settings', icon: Settings, label: 'Settings' },
                    { href: '/membership', icon: CreditCard, label: 'Subscription' },
                  ].map(({ href, icon: Icon, label }) => (
                    <Link key={href} href={href} onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors">
                      <Icon size={16} className="text-gray-400" />
                      {label}
                    </Link>
                  ))}
                  <div className="border-t border-gray-100 dark:border-white/[0.07] mt-1 pt-1">
                    <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 w-full transition-colors">
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Hamburger — mobile */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-100 dark:border-white/[0.07] bg-white dark:bg-[#0d0d0d] px-4 py-3 flex flex-col gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(href) ? 'bg-[#F87404]/10 text-[#F87404]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
              }`}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
          {role === 'admin' && (
            <>
              <div className="px-3 pt-2 pb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Super Admin</p>
              </div>
              <Link href="/admin" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-500 hover:bg-blue-50 transition-all">
                <Shield size={18} /> Admin Panel
              </Link>
              <Link href="/admin/api-keys" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-500 hover:bg-blue-50 transition-all">
                <Key size={18} /> API Keys
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
