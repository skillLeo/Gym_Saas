'use client';
import { usePathname } from 'next/navigation';
import { Utensils, Dumbbell, BookOpen, CalendarDays, Users } from 'lucide-react';

/**
 * Split auth layout: brand panel on the left (lg+), form on the right.
 *
 * Rebuilt for the design system. Notable removals:
 *  - A second <Toaster>. The root layout already mounts one, so every toast on
 *    an auth page was rendering twice.
 *  - Fabricated stats ("16 Day Streak", "1,340 Kcal Today", "47% Goal Hit")
 *    shown to logged-out visitors, and a "Join 10,000+ athletes" claim. The
 *    platform is pre-launch — invented numbers are not something to ship.
 *  - Layered gradients, a decorative dot grid, two blurred glow circles, and a
 *    hotlinked Unsplash photo, replaced by the client's own local image with a
 *    single flat scrim.
 */

const PANELS = {
  login: {
    eyebrow: 'Welcome back',
    heading: ['Pick up', 'where you left off.'],
    sub: 'Your logs, workouts, and progress are exactly as you left them.',
  },
  register: {
    eyebrow: 'Free for 30 days',
    heading: ['Start training', 'with a plan.'],
    sub: 'Track what you eat, log what you lift, and see the pattern over time.',
  },
} as const;

const FEATURES = [
  { icon: Utensils, text: 'Calorie and macro tracking' },
  { icon: Dumbbell, text: 'Workout logging and history' },
  { icon: BookOpen, text: 'Recipes and meal planning' },
  { icon: CalendarDays, text: 'One calendar for training and meals' },
  { icon: Users, text: 'A community that shows up' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname?.includes('register');
  const panel = isRegister ? PANELS.register : PANELS.login;

  return (
    <div className="min-h-dvh flex bg-surface-base">
      {/* ── Brand panel (lg+) ── */}
      <aside className="hidden lg:flex w-[46%] xl:w-1/2 relative flex-col justify-between p-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/hero-team.jpg)' }}
          aria-hidden="true"
        />
        {/* Single flat scrim — enough contrast for AA text, no layered gradients */}
        <div className="absolute inset-0 bg-[#0C0A09]/78" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <span className="h-10 w-10 rounded-sm bg-accent text-white font-display text-body flex items-center justify-center">
            MX
          </span>
          <span className="font-display text-h3 text-white">My EXtreme Trainer</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-overline font-semibold uppercase text-accent mb-3">{panel.eyebrow}</p>
          <h2 className="font-display text-white leading-[1.1] mb-4">
            <span className="block text-[2.5rem] xl:text-[3rem]">{panel.heading[0]}</span>
            <span className="block text-[2.5rem] xl:text-[3rem]">{panel.heading[1]}</span>
          </h2>
          <p className="text-body-lg text-white/70 text-pretty mb-8">{panel.sub}</p>

          <ul className="flex flex-col gap-3">
            {FEATURES.map(({ icon: FeatureIcon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-sm bg-white/10 flex items-center justify-center shrink-0">
                  <FeatureIcon size={16} strokeWidth={1.75} className="text-accent" />
                </span>
                <span className="text-body text-white/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-caption text-white/40">
          © {new Date().getFullYear()} My EXtreme Trainer
        </p>
      </aside>

      {/* ── Form panel ── */}
      <main className="w-full lg:w-[54%] xl:w-1/2 flex items-center justify-center bg-surface-raised">
        <div className="w-full max-w-[420px] px-6 sm:px-8 py-10">
          <div className="lg:hidden mb-8 flex flex-col items-center gap-2.5">
            <span className="h-12 w-12 rounded-sm bg-accent text-white font-display text-body-lg flex items-center justify-center">
              MX
            </span>
            <p className="font-display text-h3 text-content-primary">My EXtreme Trainer</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
