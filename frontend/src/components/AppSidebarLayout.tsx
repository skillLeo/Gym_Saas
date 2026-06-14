'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { isAuthenticated } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import api from '@/lib/api';
import { mockConversations } from '@/lib/mockData';
import {
  LayoutDashboard, Utensils, Dumbbell, Users, MessageCircle,
  BookOpen, CalendarDays, User, Settings, LogOut, Bot, CreditCard,
  Shield, Key, Bell, Search, ChevronDown, X, Menu, PanelLeft, LayoutList,
} from 'lucide-react';

const NAV_MAIN = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/food-log',     icon: Utensils,        label: 'Food Log' },
  { href: '/food-journal', icon: Utensils,        label: 'Food Journal' },
  { href: '/fitness',      icon: Dumbbell,        label: 'Fitness' },
  { href: '/social',       icon: Users,           label: 'Community' },
  { href: '/messages',     icon: MessageCircle,   label: 'Messages' },
  { href: '/recipes',      icon: BookOpen,        label: 'Recipes' },
  { href: '/calendar',     icon: CalendarDays,    label: 'Calendar' },
  { href: '/ai-trainer',   icon: Bot,             label: 'AI Trainer' },
];

const NAV_ACCOUNT = [
  { href: '/membership', icon: CreditCard, label: 'Membership' },
  { href: '/profile',    icon: User,       label: 'Profile' },
  { href: '/settings',   icon: Settings,   label: 'Settings' },
];

const MOBILE_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/food-log',  icon: Utensils,        label: 'Food' },
  { href: '/fitness',   icon: Dumbbell,        label: 'Fitness' },
  { href: '/social',    icon: Users,           label: 'Social' },
  { href: '/profile',   icon: User,            label: 'Profile' },
];

const NAV_ADMIN = [
  { href: '/admin',          icon: Shield, label: 'Admin Panel' },
  { href: '/admin/api-keys', icon: Key,    label: 'API Keys' },
  { href: '/admin/users',    icon: Users,  label: 'Manage Users' },
];

interface Props {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function AppSidebarLayout({ children, fullWidth = false }: Props) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout } = useAuthStore();
  const { mode, setMode } = useLayoutStore();
  const totalUnread = mockConversations.reduce((s, c) => s + c.unread, 0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/auth/login'); return; }
    if (user && !user.onboarding_completed) router.replace('/onboarding');
  }, [user, router]);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    document.cookie = 'auth_token=; path=/; max-age=0';
    logout();
    router.replace('/auth/login');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && href !== '/food-log' && pathname?.startsWith(href));

  const trialDays = user?.trial_days_remaining ?? 0;
  const isOnTrial = user?.is_on_trial;

  /* ─── Shared sidebar content ─── */
  const SidebarContent = () => (
    <div className="flex flex-col w-full" style={{ height: '100vh' }}>
      {/* Logo */}
      <div className="px-4 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#F87404]/30 group-hover:shadow-[#F87404]/50 transition-shadow">
            MX
          </div>
          <div>
            <p className="font-bold text-[13px] text-gray-900 leading-none">My EXtreme Trainer</p>
            <p className="text-[10px] text-gray-400 mt-0.5 tracking-wide">Premium Fitness Platform</p>
          </div>
        </Link>
        <button onClick={() => setMode('topnav')} title="Switch to top navigation"
          className="p-1.5 rounded-lg text-gray-300 hover:text-[#F87404] hover:bg-[#F87404]/10 transition-colors">
          <LayoutList size={15} />
        </button>
      </div>

      {/* Trial banner */}
      {isOnTrial && trialDays <= 7 && (
        <div className="mx-3 mt-3 bg-[#F87404]/8 border border-[#F87404]/20 rounded-xl px-3 py-2.5">
          <p className="text-xs text-[#F87404] font-semibold">⚡ {trialDays} days left in trial</p>
          <Link href="/membership" className="text-[11px] text-[#F87404]/80 hover:text-[#F87404] underline mt-0.5 block transition-colors">
            Upgrade to keep access →
          </Link>
        </div>
      )}

      {/* Main nav */}
      <nav className="px-3 py-4 space-y-0.5 overflow-y-auto" style={{ flex: '1 1 0', minHeight: 0 }}>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Main Menu</p>
        {NAV_MAIN.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          const isMessages = href === '/messages';
          return (
            <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/25'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}>
              <Icon size={17} className={active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
              <span className="flex-1">{label}</span>
              {isMessages && totalUnread > 0 && (
                <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${active ? 'bg-white text-[#F87404]' : 'bg-[#F87404] text-white'}`}>
                  {totalUnread}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-3 mt-3 border-t border-gray-100 space-y-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Account</p>
          {NAV_ACCOUNT.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  active
                    ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/25'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}>
                <Icon size={17} className={active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {user?.is_admin && (
          <div className="pt-3 mt-3 border-t border-gray-100 space-y-0.5">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest px-2 mb-2">Super Admin</p>
            {NAV_ADMIN.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname?.startsWith(href + '/');
              return (
                <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}>
                  <Icon size={17} className={active ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push('/profile')}>
          <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name ?? 'User'}</p>
            <span className={`text-[11px] font-medium ${isOnTrial ? 'text-[#F87404]' : 'text-emerald-500'}`}>
              {isOnTrial ? `${trialDays}d trial` : user?.subscription_status ?? 'active'}
            </span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); handleLogout(); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── Shared top header ─── */
  const TopHeader = () => (
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-gray-100 shrink-0 shadow-sm">
      <div className="h-full flex items-center justify-between px-4 md:px-6 gap-4">

        {/* LEFT: hamburger + mobile logo + desktop search */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/dashboard" className="lg:hidden flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center text-white font-black text-sm shadow-md">MX</div>
          </Link>

          {/* Search bar — desktop only */}
          <div className="hidden lg:block w-64 xl:w-80">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                placeholder="Search anything…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 outline-none focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* RIGHT: trial pill + divider + notifications + messages + divider + profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Trial pill */}
          {isOnTrial && (
            <Link href="/membership"
              className="hidden sm:flex items-center gap-1.5 bg-[#F87404]/10 text-[#F87404] text-xs font-bold px-3 py-1.5 rounded-full border border-[#F87404]/25 hover:bg-[#F87404]/20 transition-colors whitespace-nowrap">
              🔥 {trialDays}d left
            </Link>
          )}

          <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1" />

          {/* Notifications */}
          <Link href="/notifications"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F87404] rounded-full ring-2 ring-white" />
          </Link>

          {/* Messages */}
          <Link href="/messages"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <MessageCircle size={18} />
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[#F87404] text-white text-[9px] font-bold flex items-center justify-center px-0.5 ring-2 ring-white">
                {totalUnread}
              </span>
            )}
          </Link>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size={32} />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{user?.name?.split(' ')[0] ?? 'User'}</p>
                <p className="text-[11px] text-gray-400 leading-tight">{user?.is_admin ? 'Super Admin' : 'Member'}</p>
              </div>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-semibold text-sm text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email ?? ''}</p>
                    {user?.is_admin && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Shield size={10} /> Super Admin
                      </span>
                    )}
                  </div>
                  {[
                    { href: '/profile',    icon: User,       label: 'My Profile' },
                    { href: '/settings',   icon: Settings,   label: 'Settings' },
                    { href: '/membership', icon: CreditCard, label: 'Subscription' },
                  ].map(({ href, icon: Icon, label }) => (
                    <Link key={href} href={href} onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Icon size={15} className="text-gray-400" /> {label}
                    </Link>
                  ))}
                  {user?.is_admin && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <Link href="/admin" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                        <Shield size={15} /> Admin Panel
                      </Link>
                      <Link href="/admin/api-keys" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                        <Key size={15} /> API Keys
                      </Link>
                    </>
                  )}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 w-full transition-colors">
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  /* ─── Mobile bottom nav ─── */
  const MobileBottom = () => (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 z-30">
      <div className="flex items-center">
        {MOBILE_NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-2.5 text-[11px] font-medium transition-colors ${active ? 'text-[#F87404]' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className={`p-1.5 rounded-xl mb-0.5 ${active ? 'bg-[#F87404]/10' : ''}`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </div>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );

  /* ─── TOP NAV MODE ─── */
  if (mode === 'topnav') {
    // 5 primary links always visible, rest go into "More" dropdown
    const PRIMARY_NAV = NAV_MAIN.slice(0, 5);
    const MORE_NAV    = NAV_MAIN.slice(5);
    return (
      <div className="h-dvh bg-[#F8F9FA] flex flex-col overflow-hidden">
        <header className="shrink-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-xl h-16 flex items-center">
          <div className="w-full px-4 md:px-6 flex items-center gap-3">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#F87404]/30">MX</div>
              <span className="font-bold text-sm text-gray-900 hidden xl:block leading-none">My EXtreme <br /><span className="text-[#F87404]">Trainer</span></span>
            </Link>

            <div className="w-px h-6 bg-gray-100 hidden lg:block mx-1" />

            {/* Primary 5 nav items */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${active ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/20' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                    <Icon size={15} /> {label}
                  </Link>
                );
              })}

              {/* More ▾ dropdown */}
              <div className="relative">
                <button onClick={() => setMoreOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${moreOpen ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                  More <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                    <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2">
                      {MORE_NAV.map(({ href, icon: Icon, label }) => {
                        const active = isActive(href);
                        return (
                          <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${active ? 'text-[#F87404] bg-[#F87404]/5' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <Icon size={16} className={active ? 'text-[#F87404]' : 'text-gray-400'} /> {label}
                          </Link>
                        );
                      })}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        {NAV_ACCOUNT.map(({ href, icon: Icon, label }) => (
                          <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                            <Icon size={16} className="text-gray-400" /> {label}
                          </Link>
                        ))}
                      </div>
                      {user?.is_admin && (
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <p className="px-4 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Admin</p>
                          {NAV_ADMIN.map(({ href, icon: Icon, label }) => (
                            <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                              <Icon size={16} /> {label}
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button onClick={() => { setMode('sidebar'); setMoreOpen(false); }}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 w-full transition-colors">
                          <PanelLeft size={16} className="text-gray-400" /> Switch to Sidebar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </nav>

            {/* Right side — minimal icons */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {isOnTrial && (
                <Link href="/membership" className="hidden sm:flex items-center gap-1 bg-[#F87404]/10 text-[#F87404] text-xs font-bold px-3 py-1.5 rounded-full border border-[#F87404]/20 whitespace-nowrap">
                  🔥 {trialDays}d left
                </Link>
              )}
              <Link href="/notifications" className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F87404] rounded-full" />
              </Link>
              <Link href="/messages" className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                <MessageCircle size={18} />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[#F87404] text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {totalUnread}
                  </span>
                )}
              </Link>
              <div className="w-px h-6 bg-gray-200 mx-0.5" />

              {/* Profile dropdown — full nav inside */}
              <div className="relative">
                <button onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                  <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size={30} />
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-gray-900 leading-tight">{user?.name?.split(' ')[0] ?? 'User'}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{user?.is_admin ? 'Super Admin' : 'Member'}</p>
                  </div>
                  <ChevronDown size={13} className="text-gray-400 hidden sm:block" />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 overflow-hidden max-h-[80vh] overflow-y-auto">
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <Avatar src={user?.avatar_url} name={user?.name ?? '?'} size={36} />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">{user?.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email ?? ''}</p>
                            {user?.is_admin && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                <Shield size={10} /> Super Admin
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Switch layout */}
                        <button onClick={() => { setMode('sidebar'); setProfileOpen(false); }}
                          className="mt-2.5 w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-[#F87404]/10 text-xs font-semibold text-gray-600 hover:text-[#F87404] transition-colors border border-gray-200">
                          <PanelLeft size={13} /> Switch to Sidebar Layout
                        </button>
                      </div>

                      {/* Main nav */}
                      <div className="pt-1">
                        <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Main Menu</p>
                        {NAV_MAIN.map(({ href, icon: Icon, label }) => {
                          const active = isActive(href);
                          return (
                            <Link key={href} href={href} onClick={() => setProfileOpen(false)}
                              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${active ? 'text-[#F87404] bg-[#F87404]/5' : 'text-gray-700 hover:bg-gray-50'}`}>
                              <Icon size={15} className={active ? 'text-[#F87404]' : 'text-gray-400'} /> {label}
                            </Link>
                          );
                        })}
                      </div>

                      {/* Account nav */}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account</p>
                        {NAV_ACCOUNT.map(({ href, icon: Icon, label }) => (
                          <Link key={href} href={href} onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                            <Icon size={15} className="text-gray-400" /> {label}
                          </Link>
                        ))}
                      </div>

                      {/* Admin nav */}
                      {user?.is_admin && (
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <p className="px-4 py-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Admin</p>
                          {NAV_ADMIN.map(({ href, icon: Icon, label }) => (
                            <Link key={href} href={href} onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                              <Icon size={15} /> {label}
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Sign out */}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 w-full transition-colors">
                          <LogOut size={15} /> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className={`flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-8 ${fullWidth ? 'flex flex-col' : 'max-w-7xl mx-auto w-full px-4 md:px-6 py-6'}`}>
          {children}
        </main>
        <MobileBottom />
      </div>
    );
  }

  /* ─── SIDEBAR MODE ─── */
  return (
    <div className="h-dvh bg-[#F8F9FA] overflow-hidden">
      {/* Desktop sidebar — fixed, nav area scrolls internally */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 w-64 h-screen bg-white border-r border-gray-100 z-30 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 lg:hidden shadow-2xl flex flex-col">
            <SidebarContent />
          </div>
        </>
      )}

      {/* Main content — offset by sidebar width on desktop */}
      <div className="h-dvh flex flex-col min-h-0 overflow-hidden lg:ml-64">
        <TopHeader />

        <main className={`flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6 ${fullWidth ? 'flex flex-col' : 'px-4 md:px-6 py-5'}`}>
          {children}
        </main>
      </div>

      <MobileBottom />
    </div>
  );
}
