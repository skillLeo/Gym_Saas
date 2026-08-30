'use client';

import Link from 'next/link';
import { useI18nStore } from '@/store/i18nStore';
import { useState, useEffect } from 'react';
import {
  Utensils, Dumbbell, Users, Bot, BookOpen, Calendar,
  Play, ChevronRight, CheckCircle, Menu, X,
  ArrowRight, Zap, Target, Award, TrendingUp, Camera,
  Mic, BarChart3, ShoppingCart, MessageCircle, Flame,
  Trophy, Heart, Shield, Clock, ChevronDown
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { fetchPlans, formatMoney, type Plan } from '@/lib/subscription';

/* ─── DATA ─────────────────────────────────────────── */

/**
 * PRE-LAUNCH CONTENT RULES (agreed with the client):
 *  - No invented numbers. No member counts, no star ratings, no "join X people"
 *    until those figures are real.
 *  - No fabricated testimonials. The previous version shipped three invented
 *    endorsements attributed to named individuals with cities and specific
 *    weight-loss results, illustrated with Unsplash stock portraits. That
 *    section has been removed outright; it returns only when Kelvin has real
 *    quotes with permission to publish.
 *  - Features that are not built are labelled "Coming soon" and are NOT listed
 *    inside any paid tier, so nobody is charged for something that
 *    does not exist yet.
 */
// Dictionary keys, resolved at render — module scope runs before the component
// mounts and cannot call t().
const features = [
  { icon: Utensils, titleKey: 'landing.feature.foodTitle',      descKey: 'landing.feature.foodDesc',      color: '#F87404' },
  { icon: Dumbbell, titleKey: 'landing.feature.workoutTitle',   descKey: 'landing.feature.workoutDesc',   color: '#FF0404' },
  { icon: Users,    titleKey: 'landing.feature.communityTitle', descKey: 'landing.feature.communityDesc', color: '#F87404' },
  { icon: BookOpen, titleKey: 'landing.feature.recipeTitle',    descKey: 'landing.feature.recipeDesc',    color: '#FFC000' },
  { icon: Calendar, titleKey: 'landing.feature.plannerTitle',   descKey: 'landing.feature.plannerDesc',   color: '#10B981' },
  { icon: Bot,      titleKey: 'landing.feature.aiTitle',        descKey: 'landing.feature.aiDesc',        color: '#004AAD', comingSoon: true },
];

/**
 * A real video row as exposed by the public preview endpoint.
 *
 * Metadata only. `video_url` is deliberately absent server-side — the homepage
 * advertises the library, it does not serve it.
 */
interface PublicVideo {
  id: number;
  title: string;
  category: string | null;
  difficulty: string | null;
  thumbnail_url: string | null;
  duration: string;
}

async function fetchPublicVideos(): Promise<PublicVideo[]> {
  const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')}/api/videos/public`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.videos ?? [];
}

const galleryImages = [
  { src: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=700&fit=crop', span: 'row-span-2', captionKey: 'landing.gallery.morningHiit' },
  { src: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', span: '', captionKey: 'landing.gallery.eatingClean' },
  { src: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=300&fit=crop', span: '', captionKey: 'landing.gallery.hydration' },
  { src: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=300&fit=crop', span: '', captionKey: 'landing.gallery.mealPrep' },
  { src: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=600&fit=crop', span: 'row-span-2', captionKey: 'landing.gallery.healthy' },
  { src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop', span: '', captionKey: 'landing.gallery.wins' },
];

// Plan cards below are populated from GET /api/plans at render time — the
// real, Stripe-backed prices and feature lists — never hardcoded here. An
// earlier version of this page hardcoded tier prices that drifted out of
// sync with the actual checkout amount; anyone who then paid a different
// price than the one advertised on this page would rightly feel misled.
const PLAN_STYLES: Record<Plan['key'], { color: string; btnStyle: string; highlight: boolean; badgeKey?: string }> = {
  basic: {
    color: 'border-gray-200 dark:border-white/10',
    btnStyle: 'border-2 border-[#F87404] text-[#F87404] hover:bg-[#F87404] hover:text-white',
    highlight: false,
  },
  premium: {
    color: 'border-[#F87404]',
    btnStyle: 'bg-[#F87404] text-white hover:',
    highlight: true,
    badgeKey: 'landing.pricing.mostPopular',
  },
  annual_vip: {
    color: 'border-[#004AAD]',
    btnStyle: 'bg-[#004AAD] text-white shadow-blue-500/20 hover:shadow-blue-500/40',
    highlight: false,
    badgeKey: 'landing.pricing.bestValue',
  },
};

/* ─── COMPONENT ─────────────────────────────────────── */

export default function LandingPage() {
  const { t } = useI18nStore();

  // This page is outside AppShell, which is the only other place that rehydrates
  // the language store. The store uses skipHydration so a statically prerendered
  // page's first client render matches the server's — see the note in
  // i18nStore — so without this call a saved Spanish or French preference would
  // never reach the landing page and t() would always return English.
  useEffect(() => {
    useI18nStore.persist.rehydrate();
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  // memberCount (hardcoded 10,247) removed — the platform is pre-launch and had
  // no real member figure to show.

  // Video previews come from GET /api/videos/public — the real rows, with the
  // real durations and categories. This was previously a hardcoded array of
  // four invented titles ("Perfect Push-Up Form", "4:12"), which is exactly the
  // fabricated-content pattern the brief forbids.
  const [freeVideos, setFreeVideos] = useState<PublicVideo[]>([]);
  const [billing, setBilling] = useState<'month' | 'year'>('month');
  const annualPlan = plans.find((p) => p.interval === 'year');
  // The entry price and trial length are stated in the marketing copy above the
  // plan cards. They were hardcoded English strings ("Under $10/month",
  // "30-day free trial"), so raising a price or changing the trial setting in
  // admin left the homepage quietly making a false claim. Both now come from
  // /api/plans, and the sentence is suppressed until the real values arrive
  // rather than rendering a placeholder.
  const [entryPrice, setEntryPrice] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    fetchPlans()
      .then(({ plans, cheapestMonthlyCents, trialDays }) => {
        setPlans(plans);
        if (cheapestMonthlyCents != null) {
          setEntryPrice(formatMoney(cheapestMonthlyCents, plans[0]?.currency ?? 'USD'));
        }
        if (trialDays != null) setTrialDays(trialDays);
      })
      .catch(() => {});
    fetchPublicVideos().then(setFreeVideos).catch(() => {});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">

      {/* ── TOP BANNER ──
          Was raw untranslated English reading "Limited Offer — Start FREE for
          30 Days". Two problems: it stayed English in Spanish and French, and
          nothing about the trial is limited — it is the standard offer on every
          plan, so the urgency was invented. Now translated, and the day count
          comes from the admin trial setting via /api/plans. */}
      {trialDays != null && (
        <div className="bg-[#F87404] text-white text-center py-2.5 px-4 text-sm font-semibold relative z-50">
          {t('landing.banner.trial', { days: trialDays })}
          <Link href="/auth/register" className="ml-3 underline underline-offset-2 hover:no-underline font-bold">
            {t('landing.pricing.claimSpot')} </Link>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <header className={`sticky top-0 w-full z-40 transition-all duration-300 ${navScrolled ? 'bg-black/95 backdrop-blur-xl shadow-black/30' : 'bg-black/80 backdrop-blur-sm'} border-b border-white/[0.08]`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F87404] flex items-center justify-center text-white font-display font-bold text-sm">
              MX
            </div>
            <div>
              <span className="font-display text-white text-[15px] font-bold hidden sm:block leading-tight">My EXtreme Trainer</span>
              <span className="font-display text-white text-[15px] font-bold sm:hidden leading-tight">MXT</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {[[t('landing.nav.about'), '#about'], [t('landing.nav.features'), '#features'], [t('landing.nav.results'), '#results'], [t('landing.nav.pricing'), '#pricing']].map(([label, href]) => (
              <a key={label} href={href}
                className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all font-medium">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/auth/login" className="hidden sm:block px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors">
              {t('landing.nav.signIn')}
            </Link>
            <Link href="/auth/register"
              className="px-5 py-2.5 bg-[#F87404] hover:bg-[#FF5C04] text-white text-sm font-bold rounded-xl transition-all hover:-translate-y-px">
              {t('landing.hero.startTrial')}
            </Link>
            <button onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-black/98 border-t border-white/[0.08] px-4 py-4 space-y-1">
            {[[t('landing.nav.about'), '#about'], [t('landing.nav.features'), '#features'], [t('landing.nav.results'), '#results'], [t('landing.nav.pricing'), '#pricing']].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-white/80 text-sm rounded-xl hover:bg-white/10 transition-all font-medium">
                {label}
              </a>
            ))}
            <div className="pt-2 space-y-2">
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-white/80 text-sm rounded-xl hover:bg-white/10 text-center border border-white/10">
                {t('landing.nav.signIn')}
              </Link>
              <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3.5 bg-[#F87404] text-white text-sm font-bold rounded-xl text-center">
                 {t('landing.hero.startYourTrial')}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
        {/* Background: use /images/hero-team.jpg when available, fallback to Unsplash */}
        <div className="absolute inset-0">
          <img
            src="/images/hero-team.jpg"
            alt="Team Extreme — Go Team Extreme"
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&h=1080&fit=crop';
            }}
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/50 to-black/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/30" />
        </div>

        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-[#F87404]/10"
              style={{
                width: `${80 + i * 60}px`,
                height: `${80 + i * 60}px`,
                top: `${10 + i * 15}%`,
                left: `${5 + i * 18}%`,
                animation: `float ${4 + i * 0.8}s ease-in-out infinite`,
                animationDelay: `${i * 0.6}s`,
                filter: 'blur(40px)'
              }} />
          ))}
        </div>

        {/* Entrance is CSS-only (see .animate-hero-in). This block previously
            sat at opacity:0 until a React state flag flipped after hydration —
            so a stale build manifest or any chunk failure left the whole hero
            invisible. Its resting state is now visible. */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8 pb-20 text-center animate-hero-in">

          {/* Eyebrow badge */}
          {trialDays != null && (
            <div className="inline-flex items-center gap-2 bg-[#F87404]/20 border border-[#F87404]/50 text-[#F87404] text-sm font-bold px-5 py-2 rounded-full mb-8 backdrop-blur-sm">
              <Flame size={14} fill="currentColor" />
              {t('landing.hero.badge', { days: trialDays })}
              <Flame size={14} fill="currentColor" />
            </div>
          )}

          {/* Main headline */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[88px] text-white leading-[0.88] mb-6 max-w-5xl mx-auto">
            {t('landing.hero.transform')}
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #F87404 0%, #FF5C04 40%, #FF0404 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {t('landing.social.heading')}
            </span>
            <br />
            <span className="text-white/90">{t('landing.hero.own')}</span>
          </h1>

          {/* Sub headline */}
          <p className="text-white/75 text-lg sm:text-xl max-w-2xl mx-auto mb-4 leading-relaxed font-medium">
            {t('landing.hero.sub')}
          </p>
          {entryPrice && (
            <p className="text-[#F87404] font-bold text-lg mb-10">
              {t('landing.pricing.everything', { price: entryPrice })}
            </p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/auth/register"
              className="group inline-flex items-center gap-3 px-10 py-5 bg-[#F87404] hover:bg-[#FF5C04] text-white text-xl font-bold rounded-2xl transition-all hover:-translate-y-1 w-full sm:w-auto justify-center"
              style={{ boxShadow: '0 0 40px rgba(248, 116, 4, 0.4), 0 20px 60px rgba(0,0,0,0.3)' }}>
              <Zap size={22} fill="white" />
              {t('landing.hero.startYourTrial')}
              <ArrowRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 px-8 py-5 bg-white/10 hover:bg-white/20 border border-white/30 text-white text-lg font-semibold rounded-2xl transition-all backdrop-blur-sm w-full sm:w-auto justify-center">
              <Play size={20} fill="white" />
              {t('landing.hero.seeHow')}
            </a>
          </div>

          {/* Removed pre-launch: stock-photo "member" avatars, a "+9K" count, a
              4.9 star rating and a money-back guarantee — none of which were
              real. Replaced with claims that are actually true today. */}
          <p className="text-white/50 text-sm">
            {t('landing.hero.terms')}
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30">
          <span className="text-[11px] uppercase tracking-widest">{t('landing.hero.scroll')}</span>
          <ChevronDown size={18} className="animate-bounce" />
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="bg-gradient-to-r from-[#F87404] via-[#FF5C04] to-[#F87404] py-7">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white text-center">
            {[
              { num: t('landing.stat.30days'), label: t('landing.hero.freeTrial'), icon: '' },
              { num: t('landing.hero.noCardShort'), label: t('landing.coach.toGetStarted'), icon: '' },
              { num: t('landing.cancel'), label: t('landing.anyTime'), icon: '' },
              { num: t('landing.features.allInOne'), label: t('landing.features.sub'), icon: '' },
            ].map(({ num, label, icon }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className="text-2xl mb-1">{icon}</span>
                <div className="font-display text-3xl font-bold tracking-tight">{num}</div>
                <div className="text-white/80 text-sm font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KELVIN'S SIGNATURE PHRASE ── */}
      <section className="relative py-20 md:py-28 overflow-hidden bg-black">
        {/* Background image with strong overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1920&h=600&fit=crop"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80" />
          {/* Subtle orange glow from below */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-48 bg-[#F87404]/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 text-center">
          {/* Arrow pointing at visitor */}
          <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-[0.2em] mb-8">
            <div className="w-12 h-px bg-[#F87404]" />
            {t('landing.coach.heyThis')}
            <div className="w-12 h-px bg-[#F87404]" />
          </div>

          {/* The phrase — broken for maximum impact */}
          <h2 className="font-display leading-[1.05] mb-8">
            <span className="block text-3xl sm:text-4xl md:text-5xl text-white/90 mb-3">
              {t('landing.coach.whoElse')}
            </span>
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl"
              style={{
                background: 'linear-gradient(135deg, #F87404 0%, #FF5C04 50%, #FF0404 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
              {t('landing.coach.fasterEasier')}
            </span>
            <span className="block text-3xl sm:text-4xl md:text-5xl text-white/90 mt-3">
              {t('landing.coach.plusFeel')}
            </span>
          </h2>

          {/* Supporting copy */}
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('landing.coach.thatsWhatBuilt')}
            <span className="text-white font-semibold"> {t('landing.coach.nowYourTurnSpan')}</span>
          </p>

          {/* CTA */}
          <Link href="/auth/register"
            className="group inline-flex items-center gap-3 px-10 py-5 bg-[#F87404] hover:bg-[#FF5C04] text-white text-lg font-bold rounded-2xl transition-all hover:-translate-y-1"
            style={{ boxShadow: '0 0 50px rgba(248, 116, 4, 0.45), 0 20px 60px rgba(0,0,0,0.4)' }}>
            <Zap size={20} fill="white" />
            {t('landing.coach.yesIWant')}
            <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
          </Link>

          <p className="text-gray-600 text-sm mt-4">{t('landing.hero.termsShort')}</p>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-24 md:py-32 bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <div className="relative order-2 lg:order-1">
              <img
                src="https://images.unsplash.com/photo-1546483875-ad9014c88eba?w=700&h=800&fit=crop"
                alt="Kelvin Silas — Founder, Team Extreme"
                className="w-full rounded-3xl object-cover relative z-10"
                style={{ maxHeight: 580 }}
              />
              {/* Floating card */}
              <div className="absolute -bottom-6 -right-4 z-20 bg-white dark:bg-[#1a1a1a] rounded-2xl px-5 py-4 border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#F87404] flex items-center justify-center text-white font-display font-bold text-lg">
                    10+
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{t('landing.coach.years')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('landing.coach.helping')}</div>
                  </div>
                </div>
              </div>
              {/* Second floating card */}
              <div className="absolute -top-4 -left-4 z-20 bg-[#F87404] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-white">
                  <Trophy size={16} fill="white" />
                  <span className="font-bold text-sm">{t('landing.coach.founder')}</span>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
                <div className="w-8 h-0.5 bg-[#F87404]" />
                {t('landing.coach.heading')}
              </div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-[52px] text-gray-900 dark:text-white mb-6 leading-[1.05]">
                {t('landing.coach.builtBy')}
                <br />
                <span className="text-[#F87404]">{t('landing.coach.whoGetsIt')}</span>
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-8">
                <p>
                  {t('landing.coach.bio1', { name: 'Kelvin Silas', emphasis: t('landing.coach.bioEmphasis') })}
                </p>
                <p>
                  {t('landing.coach.bio2')}
                </p>
                <p className="text-gray-900 dark:text-white font-semibold">
                  {t('landing.coach.bio3')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { icon: Target, label: t('landing.coach.goalDriven'), color: '#F87404' },
                  { icon: Users, label: t('landing.coach.trueSupport'), color: '#10B981' },
                  { icon: Bot, label: t('landing.premium.aiCoaching'), color: '#004AAD' },
                  { icon: TrendingUp, label: t('landing.coach.measurable'), color: '#7C3AED' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-2xl border border-gray-100 dark:border-white/[0.06]">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18' }}>
                      <Icon size={17} style={{ color }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-tight">{label}</span>
                  </div>
                ))}
              </div>

              <Link href="/auth/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#F87404] text-white font-bold rounded-2xl hover: hover:-translate-y-0.5 transition-all group">
                {t('landing.pricing.joinToday')}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIFESTYLE — EAT, TRAIN, HYDRATE, CONNECT ── */}
      <section className="py-24 bg-white dark:bg-[#0d0d0d] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-orange-50 dark:bg-[#F87404]/10 border border-orange-100 dark:border-[#F87404]/20 text-[#F87404] text-sm font-bold px-5 py-2 rounded-full mb-5">
               {t('landing.social.healthyHappy')}
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-gray-900 dark:text-white mb-4 leading-tight">
              {t('landing.coach.fitnessIs')} <span className="text-[#F87404]">{t('landing.coach.lifestyle')}</span>,<br className="hidden sm:block" /> {t('landing.coach.notPunishment')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xl max-w-xl mx-auto">
              {t('landing.social.weMake')}
            </p>
          </div>

          {/* Big 2-column photo grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {/* Left — tall food hero */}
            <div className="relative group overflow-hidden rounded-3xl" style={{ minHeight: 420 }}>
              <img
                src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&h=700&fit=crop"
                alt="Healthy eating"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-7">
                <div className="inline-flex items-center gap-2 bg-[#F87404] text-white text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                   {t('landing.footer.nutritionPlanning')}
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">{t('landing.social.eatFood')}</h3>
                <p className="text-white/75 text-sm leading-relaxed">
                  {t('landing.social.eatFoodDesc')}
                </p>
              </div>
            </div>

            {/* Right — 2 stacked photos */}
            <div className="grid grid-rows-2 gap-5">
              <div className="relative group overflow-hidden rounded-3xl">
                <img
                  src="https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=320&fit=crop"
                  alt="Meal prep"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full mb-2">
                     {t('landing.social.mealPrepEasy')}
                  </div>
                  <h4 className="font-display text-xl font-bold text-white">{t('landing.social.planWeek')}</h4>
                  <p className="text-white/70 text-xs mt-1">{t('landing.premium.autoShopping')}</p>
                </div>
              </div>
              <div className="relative group overflow-hidden rounded-3xl">
                <img
                  src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=320&fit=crop"
                  alt="Healthy colorful bowl"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <div className="inline-flex items-center gap-2 bg-[#10B981]/80 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-2">
                     {t('landing.social.trackedRecipes')}
                  </div>
                  <h4 className="font-display text-xl font-bold text-white">{t('landing.social.nutritionTastes')}</h4>
                  <p className="text-white/70 text-xs mt-1">{t('landing.day.fullMacros')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row — hydration + community + workout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
            {[
              {
                img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
                badge: t('landing.footer.workoutTracker'),
                title: t('landing.day.everyRep'),
                sub: t('landing.social.everyRepDesc'),
                color: '#FF0404'
              },
              {
                img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&h=400&fit=crop',
                badge: t('landing.footer.hydration'),
                title: t('landing.social.stayHydrated'),
                sub: t('landing.social.trackWater'),
                color: '#004AAD'
              },
              {
                img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=400&fit=crop',
                badge: t('landing.feature.communityTitle'),
                title: t('landing.social.yourPeople'),
                sub: t('landing.social.postProgress'),
                color: '#10B981'
              },
            ].map(({ img, badge, title, sub, color }) => (
              <div key={title} className="group relative overflow-hidden rounded-3xl cursor-pointer" style={{ minHeight: 280 }}>
                <img src={img} alt={title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="inline-flex items-center gap-1.5 text-white text-[11px] font-bold px-2.5 py-1 rounded-full mb-2"
                    style={{ backgroundColor: color + 'cc' }}>
                    {badge}
                  </div>
                  <h4 className="font-display text-lg font-bold text-white mb-1">{title}</h4>
                  <p className="text-white/65 text-xs leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Kelvin quote */}
          <div className="bg-accent-surface rounded-3xl p-8 md:p-10 border border-[#F87404]/15 text-center relative overflow-hidden">
            <div className="absolute left-6 top-4 text-[80px] font-serif text-[#F87404]/15 leading-none select-none">&ldquo;</div>
            <p className="relative text-2xl md:text-3xl font-display text-gray-800 dark:text-white font-bold mb-3 max-w-3xl mx-auto">
              {t('landing.quote.part1')}{' '}
              <span className="text-[#F87404]">{t('landing.quote.consistent')}</span> {t('landing.quote.part2')}{' '}
              <span className="text-[#F87404]">{t('landing.quote.community')}</span> {t('landing.quote.part3')}
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 font-semibold">Kelvin Silas, Founder — Team Extreme</p>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
            </div>
          </div>
        </div>
      </section>

      {/* ── DAY IN YOUR LIFE ── */}
      <section className="py-20 bg-gray-50 dark:bg-[#080808]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-gray-900 dark:text-white mb-3">
              {t('landing.day.heading')} <span className="text-[#F87404]">My EXtreme Trainer</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">{t('landing.day.sub')}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { time: t('landing.time.0600'), emoji: '', label: t('landing.day.morning'), desc: t('landing.day.reviewTip'), color: '#F87404', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop' },
              { time: t('landing.time.0730'), emoji: '', label: t('landing.day.logBreakfast'), desc: t('landing.premium.scanSnap'), color: '#10B981', img: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=300&h=200&fit=crop' },
              { time: t('landing.time.1200'), emoji: '', label: t('landing.day.hydration'), desc: t('landing.day.hitWater'), color: '#004AAD', img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=200&fit=crop' },
              { time: t('landing.time.1600'), emoji: '', label: t('landing.day.crushWorkout'), desc: t('landing.day.aiSession'), color: '#FF0404', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=200&fit=crop' },
              { time: t('landing.time.1830'), emoji: '', label: t('landing.day.postWorkout'), desc: t('landing.social.recipesPicked'), color: '#FFC000', img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&h=200&fit=crop' },
              { time: t('landing.time.2100'), emoji: '', label: t('landing.day.community'), desc: t('landing.day.cheer'), color: '#7C3AED', img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=300&h=200&fit=crop' },
            ].map(({ time, emoji, label, desc, color, img }) => (
              <div key={time} className="group bg-white dark:bg-[#111] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/30 hover:-translate-y-1 transition-all shadow-sm hover: hover: cursor-pointer">
                <div className="h-24 overflow-hidden relative">
                  <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-2 text-white text-[10px] font-bold bg-black/50 px-2 py-0.5 rounded-full">{time}</div>
                  <div className="absolute top-2 right-2 text-lg">{emoji}</div>
                </div>
                <div className="p-3">
                  <div className="text-xs font-bold mb-0.5" style={{ color }}>{label}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32 bg-[#0a0a0a] relative overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(248,116,4,0.06) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#F87404]/8 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
              <div className="w-8 h-0.5 bg-[#F87404]" />
              {t('landing.features.heading')}
              <div className="w-8 h-0.5 bg-[#F87404]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-[56px] text-white mb-5 leading-tight">
              {t('landing.pricing.whatDoes')}<br />{t('landing.pricing.trainerInclude')}
            </h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">
              {t('landing.features.sixTools')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {features.map(({ icon: Icon, titleKey, descKey, color, comingSoon }) => (
              <div key={titleKey}
                className="bg-[#111] rounded-md p-6 border border-white/[0.06] hover:border-[#F87404]/30 transition-colors duration-150">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-sm flex items-center justify-center"
                    style={{ background: `${color}1F`, color }}>
                    <Icon size={22} strokeWidth={1.75} />
                  </div>
                  {comingSoon && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-xs bg-white/10 text-white/70">
                      {t('landing.features.comingSoon')}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl text-white mb-2 leading-tight">{t(titleKey)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(descKey)}</p>
                <div className="mt-4 flex items-center gap-1 text-[#F87404] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1 duration-300">
                  {t('landing.features.explore')} <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>

          {/* Bonus features strip */}
          <div className="bg-[#F87404] rounded-3xl p-8">
            <h3 className="font-display text-2xl font-bold text-white mb-6 text-center">
              {t('landing.premium.heading')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Camera, label: t('landing.premium.photoLog') },
                { icon: BarChart3, label: t('landing.premium.barcode') },
                { icon: Mic, label: t('landing.premium.voice') },
                { icon: ShoppingCart, label: t('landing.premium.shopping') },
                { icon: MessageCircle, label: t('landing.premium.dm') },
                { icon: Award, label: t('landing.premium.posters') },
                { icon: Target, label: t('landing.premium.bodyViz') },
                { icon: Zap, label: t('landing.premium.grocery') },
              ].map(({ icon: Icon, label }) => (
                <div key={label}
                  className="flex items-center gap-2.5 bg-black/20 hover:bg-black/30 rounded-2xl px-4 py-3 transition-colors cursor-pointer">
                  <Icon size={17} className="shrink-0 text-white/90" />
                  <span className="text-sm font-semibold text-white">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Removed pre-launch: a "community" strip built from 12 Unsplash stock
          portraits presented as real members (three carrying fake green
          "online" dots), a "10,247+ members already inside" count and a
          "4.9 avg rating". None of it was real. */}

      {/* ── CTA ──
          The former 'Real Results' section held three fabricated testimonials
          (named people, cities, specific weight-loss figures, stock-photo
          faces) under the heading 'No photoshop. No paid actors.' It was
          removed wholesale pre-launch. A real testimonials section can be
          rebuilt here once Kelvin has genuine quotes with permission. */}
      <section id="results" className="py-24 md:py-32 bg-surface-raised">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="font-display text-4xl md:text-5xl text-content-primary mb-4 leading-tight">
            {t('landing.coach.startWhere')}
          </h2>
          <p className="text-content-secondary text-lg mb-8">
            {t('landing.cta.startSmall')}
          </p>
          <Link href="/auth/register"
            className="inline-flex items-center gap-2.5 px-8 h-14 bg-accent hover:bg-accent-hover text-white text-lg font-semibold rounded-md transition-colors">
            {t('landing.hero.startFree30')}
            <ArrowRight size={20} strokeWidth={2} />
          </Link>
          <p className="text-content-tertiary text-sm mt-4">{t('landing.hero.noCard')}</p>
        </div>
      </section>
      {/* ── PHOTO GALLERY ── */}
      <section className="py-20 bg-[#0d0d0d]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#F87404]/15 text-[#F87404] text-sm font-bold px-4 py-2 rounded-full mb-4 border border-[#F87404]/20">
               {t('landing.gallery.heading')}
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-white mb-3">Eat. Train. Hydrate. <span className="text-[#F87404]">{t('landing.coach.thrive')}</span></h2>
            <p className="text-gray-400 text-lg">{t('landing.gallery.sub')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3" style={{ gridAutoRows: '180px' }}>
            {galleryImages.map((img, i) => (
              <div key={i} className={`${img.span} overflow-hidden rounded-2xl group cursor-pointer relative`}>
                <img src={img.src} alt={t(img.captionKey)}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-sm font-semibold">{t(img.captionKey)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── APP PREVIEW ── */}
      <section className="py-24 md:py-32 bg-white dark:bg-[#0a0a0a] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
                <div className="w-8 h-0.5 bg-[#F87404]" />
                {t('landing.pwa.heading')}
              </div>
              <h2 className="font-display text-4xl md:text-5xl text-gray-900 dark:text-white mb-6 leading-tight">
                {t('landing.pwa.addToHome')}<br />
                <span className="text-[#F87404]">{t('landing.pwa.homeScreen')}</span><br />
                <span className="text-gray-400 dark:text-gray-500 text-3xl">{t('landing.pwa.noDownload')}</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-8 leading-relaxed">
                {t('landing.pwa.body')}
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: Shield, text: t('landing.pwa.works') },
                  { icon: Zap, text: t('landing.pwa.fullScreen') },
                  { icon: Clock, text: t('landing.pwa.camera') },
                  { icon: Heart, text: t('landing.pwa.instant') },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-white/[0.04] rounded-xl border border-gray-100 dark:border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-[#F87404]/15 flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-[#F87404]" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone mockup */}
            <div className="relative flex justify-center">
              <div className="absolute inset-0 bg-[#F87404]/10 rounded-full blur-3xl scale-75" />
              <div className="relative w-72">
                <div className="bg-gray-900 rounded-[2.5rem] p-2 ring-2 ring-[#F87404]/20"
                  style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 40px rgba(248,116,4,0.2)' }}>
                  <div className="bg-[#0d0d0d] rounded-[2rem] overflow-hidden">
                    <div className="h-8 bg-gray-900 flex items-center justify-center">
                      <div className="w-24 h-3.5 bg-gray-700 rounded-full" />
                    </div>
                    <div className="bg-[#0d0d0d] px-4 pt-4 pb-6 space-y-3">
                      <div className="text-white text-sm font-display text-center mb-2 font-bold">{t('landing.mock.goodMorning', { name: 'Kelvin' })}</div>
                      <div className="text-[#F87404] text-[9px] font-bold tracking-widest text-center opacity-70 mb-3">MY EXTREME TRAINER</div>

                      {/* Dashboard tiles */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: t('landing.footer.exercise'), color: '#FF0404', emoji: '', sub: t('landing.mock.sessions') },
                          { label: t('landing.footer.nutrition'), color: '#F87404', emoji: '', sub: t('landing.mock.calories') },
                          { label: t('landing.footer.recipes'), color: '#FFC000', emoji: '‍', sub: t('landing.mock.savedRecipes') },
                          { label: t('landing.feature.communityTitle'), color: '#004AAD', emoji: '', sub: t('landing.mock.newPosts') },
                        ].map(({ label, color, emoji, sub }) => (
                          <div key={label} className="rounded-2xl p-3 text-center cursor-pointer hover:scale-105 transition-transform"
                            style={{ background: `${color}18`, border: `1px solid ${color}20` }}>
                            <div className="text-2xl mb-1">{emoji}</div>
                            <div className="text-white text-[9px] font-bold">{label}</div>
                            <div className="text-[8px] mt-0.5 opacity-60" style={{ color }}>{sub}</div>
                          </div>
                        ))}
                      </div>

                      {/* Today's cal bar */}
                      <div className="bg-[#F87404]/12 rounded-xl p-3 border border-[#F87404]/15">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-orange-400 text-[9px] font-bold tracking-wider">{t('landing.mock.todayCalories')}</span>
                          <span className="text-gray-400 text-[9px]">67%</span>
                        </div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-white text-sm font-bold">1,340</span>
                          <span className="text-gray-500 text-[9px]">{t('landing.mock.ofKcal')}</span>
                        </div>
                        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#F87404]" style={{ width: '67%' }} />
                        </div>
                      </div>

                      {/* Streak */}
                      <div className="flex items-center justify-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                        <span className="text-lg"></span>
                        <span className="text-white text-xs font-bold">{t('landing.mock.streak')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FREE FITNESS VIDEOS ── */}
      <section className="py-24 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
              <div className="w-8 h-0.5 bg-[#F87404]" />
              {t('landing.videos.tryBefore')}
              <div className="w-8 h-0.5 bg-[#F87404]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-white mb-4 leading-tight">
              {t('landing.pricing.freeFitness')} <span className="text-[#F87404]">{t('landing.footer.videos')}</span>
            </h2>
            <p className="text-gray-400 text-xl max-w-xl mx-auto">
              {t('landing.videos.taste')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {freeVideos.map((v, i) => (
              <button key={v.id} onClick={() => setActiveVideo(i)}
                className="group relative rounded-2xl overflow-hidden bg-[#111] border border-white/[0.06] hover:border-[#F87404]/30 transition-all text-left">
                <div className="relative aspect-video overflow-hidden">
                  <img src={v.thumbnail_url ?? ''} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[#F87404] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={18} className="text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md">{v.duration}</span>
                </div>
                <div className="p-4">
                  <span className="text-[11px] font-bold text-[#F87404] uppercase tracking-wide">{v.category}</span>
                  <h3 className="font-semibold text-white text-sm mt-1 leading-snug">{v.title}</h3>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#F87404] hover:bg-[#e06000] text-white font-bold rounded-2xl hover: hover:-translate-y-0.5 transition-all">
              {t('landing.videos.heading')}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 bg-gray-50 dark:bg-[#060606]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
              <div className="w-8 h-0.5 bg-[#F87404]" />
              {t('landing.pricing.heading')}
              <div className="w-8 h-0.5 bg-[#F87404]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-[56px] text-gray-900 dark:text-white mb-4 leading-tight">
              {t('landing.pricing.lessThan')}<br />
              <span className="text-[#F87404]">{t('landing.pricing.dailyCoffee')}</span>
            </h2>
            {entryPrice && (
              <p className="text-gray-500 dark:text-gray-400 text-xl mb-4">
                {t('landing.pricing.sub', { price: entryPrice })}
              </p>
            )}
            {trialDays != null && (
              <p className="text-gray-400 text-base mb-8">
                {t('landing.pricing.trialNote', { days: trialDays })}
              </p>
            )}

            {/* Monthly / Annual toggle.
                All three tiers stay on screen in both views — only the way each
                price is EXPRESSED changes. Nothing here invents a plan: Basic and
                Premium exist only as monthly prices in Stripe, so in the annual
                view they are labelled "billed monthly" with the true 12-month
                total, never presented as annual products. */}
            <div className="flex flex-col items-center gap-2">
              <div role="tablist" aria-label={t('landing.pricing.billingPeriod')}
                className="inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10">
                {(['month', 'year'] as const).map((option) => {
                  const selected = billing === option;
                  return (
                    <button key={option} type="button" role="tab" aria-selected={selected}
                      onClick={() => setBilling(option)}
                      className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                        selected
                          ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}>
                      {option === 'month' ? t('landing.pricing.monthly') : t('landing.pricing.annual')}
                    </button>
                  );
                })}
              </div>
              {/* Height reserved in both states so switching does not shift the cards. */}
              <p className="text-green-500 text-sm font-bold min-h-[1.25rem]" aria-live="polite">
                {billing === 'year' && annualPlan?.savings
                  ? `Save ${formatMoney(annualPlan.savings.saved_cents, annualPlan.currency)} a year with Annual VIP — ${annualPlan.savings.months_free} months free`
                  : ' '}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((plan) => {
              const style = PLAN_STYLES[plan.key];
              const isAnnualPlan = plan.interval === 'year';

              // Derived purely from the API's amount_cents — never hardcoded.
              const shownCents = billing === 'year'
                ? (isAnnualPlan ? plan.amount_cents : plan.amount_cents * 12)
                : (isAnnualPlan ? plan.monthly_equivalent_cents : plan.amount_cents);
              const shownUnit = billing === 'year' ? t('landing.pricing.unitYr') : t('landing.pricing.unitMo');
              const billingNote = billing === 'year'
                ? (isAnnualPlan ? t('landing.pricing.billedAnnually') : t('landing.pricing.billedMonthlyOver12'))
                : (isAnnualPlan ? t('landing.pricing.billedAnnually') : t('landing.pricing.billedMonthly'));

              return (
                <div key={plan.key}
                  className={`relative bg-white dark:bg-[#111] rounded-3xl border-2 ${style.color} p-7 ${style.highlight ? ' md:scale-105 md:-translate-y-2' : ''}`}>

                  {style.badgeKey && (
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-5 py-1.5 rounded-full whitespace-nowrap ${style.highlight ? 'bg-[#F87404]' : 'bg-[#004AAD]'}`}>
                      {t(style.badgeKey)}
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-3">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-5xl font-bold text-gray-900 dark:text-white">
                        {formatMoney(shownCents, plan.currency)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-lg">/{shownUnit}</span>
                    </div>
                    <div className="text-gray-400 text-sm mt-1">{billingNote}</div>
                    {/* Savings only ever shown for the plan that genuinely has a
                        savings figure from the API, and only in the annual view. */}
                    {billing === 'year' && plan.savings && (
                      <div className="text-green-500 text-sm font-bold mt-1">
                        {t('landing.pricing.perMoEquivalent', { amount: formatMoney(plan.monthly_equivalent_cents, plan.currency), percent: plan.savings.percent })}
                      </div>
                    )}
                  </div>

                  {/* Free trial highlight */}
                  {trialDays != null && (
                    <div className="mb-6 p-3 bg-green-50 dark:bg-green-500/8 rounded-xl border border-green-200 dark:border-green-500/20 text-center">
                      <span className="text-green-700 dark:text-green-400 text-sm font-bold">{t('landing.hero.trialIncluded', { days: trialDays })}</span>
                    </div>
                  )}

                  <ul className="space-y-2.5 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircle size={16} className="text-[#F87404] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href="/auth/register"
                    className={`block w-full text-center py-4 rounded-2xl font-bold text-sm transition-all hover:-translate-y-0.5 ${style.btnStyle}`}>
                    {t('landing.hero.startTrial')}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-28 md:py-36 bg-black overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1920&h=800&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/60 to-black" />
        </div>
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(248,116,4,0.05) 1px, transparent 0)',
          backgroundSize: '28px 28px'
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#F87404]/15 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-[#F87404]/20 border border-[#F87404]/40 text-[#F87404] text-sm font-bold px-5 py-2 rounded-full mb-8">
            <Flame size={14} fill="currentColor" />
            {t('landing.cta.daysFreeNoCard')}
          </div>

          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-white mb-6 leading-[0.92]">
            {t('landing.social.transformation')}<br />
            <span style={{
              background: 'linear-gradient(135deg, #F87404 0%, #FF5C04 50%, #FF0404 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {t('landing.hero.startsNow')}
            </span>
          </h2>

          <p className="text-gray-300 text-xl mb-4 max-w-2xl mx-auto leading-relaxed">
            {t('landing.cta.readThisFar')}
          </p>
          <p className="text-gray-500 text-base mb-12">{t('landing.cta.noRisk')}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register"
              className="group inline-flex items-center gap-3 px-12 py-6 bg-[#F87404] hover:bg-[#FF5C04] text-white text-xl font-bold rounded-2xl transition-all hover:-translate-y-1.5 w-full sm:w-auto justify-center"
              style={{ boxShadow: '0 0 60px rgba(248, 116, 4, 0.5), 0 20px 60px rgba(0,0,0,0.4)' }}>
              <Zap size={24} fill="white" />
              {t('landing.hero.startMyTrial')}
              <ArrowRight size={24} className="group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            {[
              { icon: Shield, text: t('landing.hero.noCard') },
              ...(trialDays != null ? [{ icon: Clock, text: t('landing.badge.trial30', { days: trialDays }) }] : []),
              { icon: Heart, text: t('landing.hero.cancelAnytime') },
              { icon: Zap, text: t('landing.hero.instantAccess') },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-gray-400 text-sm">
                <Icon size={14} className="text-[#F87404]" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#030303] text-gray-400 py-16 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#F87404] flex items-center justify-center text-white font-display font-bold">MX</div>
                <span className="font-display text-white font-bold">My EXtreme Trainer</span>
              </div>
              <p className="text-sm leading-relaxed mb-5 text-gray-500">{t('landing.social.mxtSub')}</p>
              <div className="flex gap-2.5">
                {['F', 'IG', 'YT', 'TW'].map(s => (
                  <a key={s} href="#"
                    className="w-9 h-9 bg-white/[0.05] hover:bg-[#F87404]/20 rounded-xl flex items-center justify-center hover:text-[#F87404] transition-all text-xs font-bold border border-white/[0.06] hover:border-[#F87404]/30">
                    {s}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-5 text-sm">{t('landing.footer.platform')}</h4>
              <ul className="space-y-2.5 text-sm">
                {[t('landing.footer.foodJournal'), t('landing.footer.fitnessTracker'), t('landing.footer.aiTrainer'), t('landing.footer.socialFeed'), t('landing.footer.recipes'), t('landing.footer.calendar')].map(l => (
                  <li key={l}><Link href="/auth/register" className="hover:text-[#F87404] transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-5 text-sm">{t('landing.footer.company')}</h4>
              <ul className="space-y-2.5 text-sm">
                {[
                  { label: t('landing.nav.aboutKelvin'), href: '#about' },
                  { label: t('landing.nav.pricing'), href: '#pricing' },
                  { label: t('landing.footer.privacyPolicy'), href: '/privacy' },
                  { label: t('landing.footer.termsOfService'), href: '/terms' },
                ].map(l => (
                  <li key={l.label}><Link href={l.href} className="hover:text-[#F87404] transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-5 text-sm">{t('landing.footer.contact')}</h4>
              <div className="space-y-3 text-sm">
                <p className="text-gray-500">GoTeamEXtreme.com</p>
                <p className="text-gray-500">MyEXtremeTrainer.com</p>
                <a href="mailto:hello@myextremetrainer.com"
                  className="hover:text-[#F87404] transition-colors block">hello@myextremetrainer.com</a>
                <div className="pt-2">
                  <Link href="/auth/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F87404]/15 hover:bg-[#F87404]/25 text-[#F87404] rounded-xl text-xs font-bold transition-colors border border-[#F87404]/20">
                    <Zap size={12} />
                    {t('landing.hero.startTrial')}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            {/* Year is derived, not literal — a hardcoded year silently goes
                stale every January. */}
            <p>{t('landing.footer.rights', { year: new Date().getFullYear() })}</p>
            <div className="flex gap-5">
              <Link href="/privacy" className="hover:text-[#F87404] transition-colors">{t('landing.footer.privacy')}</Link>
              <Link href="/terms" className="hover:text-[#F87404] transition-colors">{t('landing.footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Video modal */}
      {activeVideo !== null && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}>
          <div className="bg-gray-900 rounded-2xl overflow-hidden max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {/* Honest preview: this is a real video in the library, but playback
                is a member benefit. Previously this said "Video Coming Soon"
                under a fabricated title, which misrepresented both the content
                and the state of the product. */}
            <div className="aspect-video bg-black flex items-center justify-center">
              <div className="text-center text-white px-6">
                <Play size={52} className="mx-auto mb-4 text-[#F87404]" fill="#F87404" />
                <p className="font-display text-2xl">{freeVideos[activeVideo]?.title}</p>
                <p className="text-gray-400 text-sm mt-2">
                  {[freeVideos[activeVideo]?.category, freeVideos[activeVideo]?.difficulty, freeVideos[activeVideo]?.duration]
                    .filter(Boolean).join(' · ')}
                </p>
                <p className="text-gray-400 text-sm mt-3">
                  {t('landing.videos.sub')}
                </p>
              </div>
            </div>
            <div className="p-4 flex justify-between items-center border-t border-white/10">
              <Link href="/auth/register" className="px-5 py-2.5 bg-[#F87404] text-white rounded-xl text-sm font-bold hover:bg-[#FF5C04] transition-colors">
                {t('landing.pricing.getFullAccess')}
              </Link>
              <button onClick={() => setActiveVideo(null)}
                className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20 transition-colors">
                {t('landing.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
