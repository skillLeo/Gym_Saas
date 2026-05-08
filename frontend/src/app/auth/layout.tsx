'use client';
import { usePathname } from 'next/navigation';

const LOGIN_PANEL = {
  badge: 'Welcome Back',
  heading: ['Your Journey', 'Continues.'],
  sub: 'Every rep brings you closer. Every meal moves the needle. Your best self is already in motion.',
  stats: [
    { value: '16', label: 'Day Streak', icon: '🔥' },
    { value: '1,340', label: 'Kcal Today', icon: '⚡' },
    { value: '47%', label: 'Goal Hit', icon: '🎯' },
  ],
  quote: '"The pain you feel today is the strength you feel tomorrow."',
  quoteAuthor: '— Arnold Schwarzenegger',
};

const REGISTER_PANEL = {
  badge: 'Start Free Today',
  heading: ['Begin Your', 'Transformation.'],
  sub: 'Join 10,000+ athletes who use My EXtreme Trainer to crush their goals — completely free for 30 days.',
  features: [
    { icon: '📊', text: 'Smart calorie & macro tracking' },
    { icon: '🏋️', text: 'Custom workout & fitness plans' },
    { icon: '🥗', text: '500+ healthy recipes & meal plans' },
    { icon: '📅', text: 'Built-in fitness calendar & reminders' },
    { icon: '🤝', text: 'Supportive fitness community' },
  ],
  quote: '"The secret to getting ahead is getting started."',
  quoteAuthor: '— Mark Twain',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname?.includes('register');
  const panel = isRegister ? REGISTER_PANEL : LOGIN_PANEL;

  return (
    <div className="min-h-screen flex bg-[#0A0A0A]">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex w-[52%] relative flex-col overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1400&h=1900&fit=crop&q=90)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
        }}
      >
        {/* Multi-layer gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-[#F87404]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Decorative orange glow bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-[#F87404]/10 to-transparent" />

        {/* Decorative dots grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Top: Logo */}
        <div className="relative z-10 flex items-center gap-3 p-10 pb-0">
          <div className="w-10 h-10 rounded-2xl bg-[#F87404] flex items-center justify-center shadow-xl shadow-[#F87404]/40">
            <span className="text-white font-black text-sm tracking-tight">MX</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none tracking-wider">My EXtreme Trainer</p>
            <p className="text-gray-400 text-[10px] tracking-widest uppercase mt-0.5">Premium Fitness Platform</p>
          </div>
        </div>

        {/* Center: Main message */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10">
          <span className="inline-flex items-center gap-2 bg-[#F87404]/20 border border-[#F87404]/40 text-[#F87404] text-xs font-semibold px-3 py-1.5 rounded-full w-fit mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F87404] animate-pulse" />
            {panel.badge}
          </span>

          <h2 className="font-display font-black text-white leading-[1.05] mb-4">
            <span className="block text-[2.8rem] xl:text-[3.4rem]">{panel.heading[0]}</span>
            <span className="block text-[2.8rem] xl:text-[3.4rem] text-[#F87404]">{panel.heading[1]}</span>
          </h2>

          <p className="text-gray-300 text-[15px] leading-relaxed max-w-xs mb-8">
            {panel.sub}
          </p>

          {/* Stats or Features */}
          {!isRegister && LOGIN_PANEL.stats && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {LOGIN_PANEL.stats.map(s => (
                <div key={s.label} className="bg-white/8 backdrop-blur-md border border-white/15 rounded-2xl p-4 hover:bg-white/12 transition-colors">
                  <p className="text-xl mb-1">{s.icon}</p>
                  <p className="text-2xl font-black text-[#F87404] leading-none">{s.value}</p>
                  <p className="text-[11px] text-gray-300 mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {isRegister && REGISTER_PANEL.features && (
            <div className="space-y-3 mb-8">
              {REGISTER_PANEL.features.map(f => (
                <div key={f.text} className="flex items-center gap-3 bg-white/6 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5">
                  <span className="text-base">{f.icon}</span>
                  <span className="text-sm text-gray-200 font-medium">{f.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Quote */}
          <div className="border-l-2 border-[#F87404]/60 pl-4">
            <p className="text-gray-300 text-xs leading-relaxed italic">{panel.quote}</p>
            <p className="text-gray-500 text-[11px] mt-1 font-medium">{panel.quoteAuthor}</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 px-10 pb-8">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span>© 2025 My EXtreme Trainer</span>
            <span>·</span>
            <span>All rights reserved</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-[48%] flex items-center justify-center bg-white min-h-screen relative">
        {/* Subtle top-right decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#F87404]/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#F87404]/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="w-full max-w-[420px] px-8 py-12 relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F87404] flex items-center justify-center text-white font-black text-lg mx-auto mb-3 shadow-lg shadow-[#F87404]/30">MX</div>
            <p className="font-bold text-gray-900 text-sm tracking-wide">My EXtreme Trainer</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
