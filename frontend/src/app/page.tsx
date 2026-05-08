'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Utensils, Dumbbell, Users, Bot, BookOpen, Calendar,
  Star, Play, ChevronRight, CheckCircle, Menu, X,
  ArrowRight, Zap, Target, Award, TrendingUp, Camera,
  Mic, BarChart3, ShoppingCart, MessageCircle, Flame,
  Trophy, Heart, Shield, Clock, ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/* ─── DATA ─────────────────────────────────────────── */

const features = [
  { icon: Utensils, title: 'Food Journal & Nutrition', desc: 'Log meals, scan barcodes, snap a photo — AI identifies and logs it instantly. Full 500K+ food database.', color: '#F87404', emoji: '🍽️' },
  { icon: Dumbbell, title: 'Workout Tracker', desc: 'Log every set, track body stats, and watch your strength climb with visual progress charts.', color: '#FF0404', emoji: '🏋️' },
  { icon: Users, title: 'Social Community', desc: 'Connect with real members on the same journey. Share wins, drop reactions, build friendships that last.', color: '#F87404', emoji: '🤝' },
  { icon: Bot, title: 'AI Personal Trainer', desc: 'Your GPT-4 powered coach — personalized meal plans, custom workouts, real-time answers. Always on.', color: '#004AAD', emoji: '🤖' },
  { icon: BookOpen, title: 'Recipe Library', desc: '500+ healthy recipes with full nutrition data. Log directly to your journal. Cook like you mean it.', color: '#FFC000', emoji: '👨‍🍳' },
  { icon: Calendar, title: 'Smart Planner', desc: 'Color-coded meal & workout calendar. Auto-generates your shopping list every single week.', color: '#10B981', emoji: '📅' },
];

const testimonials = [
  {
    name: 'Latisha M.', goal: 'Lost 42 lbs in 5 months', location: 'Atlanta, GA',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612d5ca?w=100&h=100&fit=crop&crop=face',
    quote: "I've tried MyFitnessPal, Noom, everything. Nothing stuck. My EXtreme Trainer is the first app that made me feel like part of a real community. I didn't just lose the weight — I found my people.",
    stars: 5, before: '218 lbs', after: '176 lbs',
  },
  {
    name: 'Jerome K.', goal: 'Built 18 lbs of muscle', location: 'Houston, TX',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    quote: "The AI trainer gave me a program in 60 seconds that would have cost me $200/month with a real personal trainer. I've been consistent for 7 months straight. That's never happened before.",
    stars: 5, before: '162 lbs', after: '180 lbs',
  },
  {
    name: 'Destiny R.', goal: 'Ran first 5K — zero training background', location: 'Miami, FL',
    avatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop&crop=face',
    quote: "I signed up thinking I'd cancel in a week. Eight months later I'm still here. The recipes changed the way I eat. The community kept me going when I wanted to quit. Worth every penny.",
    stars: 5, before: 'Couch to 5K', after: 'Running 15K',
  },
];

const socialProofAvatars = [
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=60&h=60&fit=crop&crop=face',
];

const galleryImages = [
  { src: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=700&fit=crop', span: 'row-span-2', caption: '💪 Morning HIIT — Team Extreme' },
  { src: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', span: '', caption: '🥗 Eating Clean & Loving It' },
  { src: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=300&fit=crop', span: '', caption: '💧 Hydration Goals Hit' },
  { src: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=300&fit=crop', span: '', caption: '📦 Meal Prep Sunday' },
  { src: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=600&fit=crop', span: 'row-span-2', caption: '🍽️ Healthy & Delicious' },
  { src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop', span: '', caption: '🤝 Community Wins Together' },
];

const pricingTiers = [
  {
    name: 'Basic', monthly: 7.99, annual: 79.99,
    color: 'border-gray-200 dark:border-white/10',
    btnStyle: 'border-2 border-[#F87404] text-[#F87404] hover:bg-[#F87404] hover:text-white',
    highlight: false,
    features: [
      'Food Journal & Calorie Tracking',
      'Fitness Workout Logger',
      'Recipe Library (Browse Only)',
      'Basic Progress Charts',
      'Social Feed (Read Only)',
      '✅ 30-Day Free Trial',
    ],
  },
  {
    name: 'Premium', monthly: 9.99, annual: 89.99,
    color: 'border-[#F87404]',
    btnStyle: 'bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white shadow-xl shadow-[#F87404]/30 hover:shadow-[#F87404]/50',
    highlight: true,
    badge: '⭐ Most Popular',
    features: [
      'Everything in Basic, plus:',
      'Unlimited Social Posts & Community',
      'AI Personal Trainer (GPT-4)',
      'AI Meal & Body Visualizer',
      'Barcode Scanner & Voice Logging',
      'Meal Planner & Smart Calendar',
      'Auto Shopping List Generator',
      'Achievement Poster Generator',
      'Priority Support',
      '✅ 30-Day Free Trial',
    ],
  },
  {
    name: 'Annual VIP', monthly: null, annual: 99.99,
    color: 'border-[#004AAD]',
    btnStyle: 'bg-gradient-to-r from-[#004AAD] to-[#0000FF] text-white shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40',
    highlight: false,
    badge: '💎 Best Value',
    features: [
      'Everything in Premium, plus:',
      'Best Value — Save $40/year',
      'Early Access to New Features',
      'Exclusive Annual Member Badge',
      'Extended 60-Day Free Trial',
      'VIP Community Status',
    ],
  },
];

/* ─── COMPONENT ─────────────────────────────────────── */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<number | null>(null);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [memberCount] = useState(10247);

  useEffect(() => {
    setHeroLoaded(true);
    const onScroll = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] overflow-x-hidden">

      {/* ── TOP BANNER ── */}
      <div className="bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white text-center py-2.5 px-4 text-sm font-semibold relative z-50">
        🔥 Limited Offer — Start FREE for 30 Days. No Credit Card Required.
        <Link href="/auth/register" className="ml-3 underline underline-offset-2 hover:no-underline font-bold">
          Claim Your Spot →
        </Link>
      </div>

      {/* ── NAVBAR ── */}
      <header className={`sticky top-0 w-full z-40 transition-all duration-300 ${navScrolled ? 'bg-black/95 backdrop-blur-xl shadow-xl shadow-black/30' : 'bg-black/80 backdrop-blur-sm'} border-b border-white/[0.08]`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center text-white font-display font-bold text-sm shadow-lg shadow-[#F87404]/30">
              MX
            </div>
            <div>
              <span className="font-display text-white text-[15px] font-bold hidden sm:block leading-tight">My EXtreme Trainer</span>
              <span className="font-display text-white text-[15px] font-bold sm:hidden leading-tight">MXT</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {[['About', '#about'], ['Features', '#features'], ['Results', '#results'], ['Pricing', '#pricing']].map(([label, href]) => (
              <a key={label} href={href}
                className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all font-medium">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/auth/login" className="hidden sm:block px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/auth/register"
              className="px-5 py-2.5 bg-gradient-to-r from-[#F87404] to-[#FF5C04] hover:from-[#FF5C04] hover:to-[#FF0404] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-[#F87404]/20 hover:shadow-[#F87404]/40 hover:-translate-y-px">
              Start Free Trial
            </Link>
            <button onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-black/98 border-t border-white/[0.08] px-4 py-4 space-y-1">
            {[['About', '#about'], ['Features', '#features'], ['Results', '#results'], ['Pricing', '#pricing']].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-white/80 text-sm rounded-xl hover:bg-white/10 transition-all font-medium">
                {label}
              </a>
            ))}
            <div className="pt-2 space-y-2">
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-white/80 text-sm rounded-xl hover:bg-white/10 text-center border border-white/10">
                Sign In
              </Link>
              <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3.5 bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white text-sm font-bold rounded-xl text-center">
                🚀 Start Your Free Trial
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
                filter: 'blur(40px)',
              }} />
          ))}
        </div>

        <div className={`relative z-10 max-w-6xl mx-auto px-4 pt-8 pb-20 text-center transition-all duration-1000 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 bg-[#F87404]/20 border border-[#F87404]/50 text-[#F87404] text-sm font-bold px-5 py-2 rounded-full mb-8 backdrop-blur-sm">
            <Flame size={14} fill="currentColor" />
            30-Day Free Trial — No Credit Card Required
            <Flame size={14} fill="currentColor" />
          </div>

          {/* Main headline */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[88px] text-white leading-[0.88] mb-6 max-w-5xl mx-auto">
            Transform Your Body.
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #F87404 0%, #FF5C04 40%, #FF0404 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Join a Community.
            </span>
            <br />
            <span className="text-white/90">Own Your Journey.</span>
          </h1>

          {/* Sub headline */}
          <p className="text-white/75 text-lg sm:text-xl max-w-2xl mx-auto mb-4 leading-relaxed font-medium">
            The all-in-one fitness platform that gives you a food journal, workout tracker, AI personal trainer,
            recipe library, smart calendar, and a community that actually shows up for you.
          </p>
          <p className="text-[#F87404] font-bold text-lg mb-10">
            Everything. One app. Under $10/month.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/auth/register"
              className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[#F87404] to-[#FF5C04] hover:from-[#FF5C04] hover:to-[#FF0404] text-white text-xl font-bold rounded-2xl transition-all shadow-2xl shadow-[#F87404]/40 hover:shadow-[#F87404]/60 hover:-translate-y-1 w-full sm:w-auto justify-center"
              style={{ boxShadow: '0 0 40px rgba(248, 116, 4, 0.4), 0 20px 60px rgba(0,0,0,0.3)' }}>
              <Zap size={22} fill="white" />
              Start Your Free Trial
              <ArrowRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 px-8 py-5 bg-white/10 hover:bg-white/20 border border-white/30 text-white text-lg font-semibold rounded-2xl transition-all backdrop-blur-sm w-full sm:w-auto justify-center">
              <Play size={20} fill="white" />
              See How It Works
            </a>
          </div>

          {/* Social proof */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2.5">
                {socialProofAvatars.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-9 h-9 rounded-full border-2 border-[#F87404]/50 object-cover" />
                ))}
                <div className="w-9 h-9 rounded-full border-2 border-[#F87404]/50 bg-[#F87404] flex items-center justify-center text-white text-[10px] font-bold">
                  +9K
                </div>
              </div>
              <div className="text-left ml-1">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => <Star key={i} size={13} className="text-[#FFC000] fill-[#FFC000]" />)}
                  <span className="text-white font-bold text-sm ml-0.5">4.9</span>
                </div>
                <div className="text-white/60 text-xs">
                  Loved by <span className="text-white font-bold">{memberCount.toLocaleString()}+</span> members
                </div>
              </div>
            </div>
            <p className="text-white/40 text-xs">No credit card · Cancel anytime · Results or your money back</p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30">
          <span className="text-[11px] uppercase tracking-widest">Scroll</span>
          <ChevronDown size={18} className="animate-bounce" />
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="bg-gradient-to-r from-[#F87404] via-[#FF5C04] to-[#F87404] py-7">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white text-center">
            {[
              { num: '10,247+', label: 'Active Members', icon: '👥' },
              { num: '2.4M+', label: 'Meals Logged', icon: '🥗' },
              { num: '890K+', label: 'Workouts Crushed', icon: '🏋️' },
              { num: '98%', label: 'Member Satisfaction', icon: '⭐' },
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
            Hey — this is for YOU
            <div className="w-12 h-px bg-[#F87404]" />
          </div>

          {/* The phrase — broken for maximum impact */}
          <h2 className="font-display leading-[1.05] mb-8">
            <span className="block text-3xl sm:text-4xl md:text-5xl text-white/90 mb-3">
              Who else wants to get in shape
            </span>
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl"
              style={{
                background: 'linear-gradient(135deg, #F87404 0%, #FF5C04 50%, #FF0404 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
              FASTER &amp; EASIER
            </span>
            <span className="block text-3xl sm:text-4xl md:text-5xl text-white/90 mt-3">
              — plus look &amp; <span className="text-white font-bold">FEEL</span> amazing?
            </span>
          </h2>

          {/* Supporting copy */}
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            That&apos;s exactly what My EXtreme Trainer was built to do.
            Thousands of members are already living proof.
            <span className="text-white font-semibold"> Now it&apos;s your turn.</span>
          </p>

          {/* CTA */}
          <Link href="/auth/register"
            className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[#F87404] to-[#FF5C04] hover:from-[#FF5C04] hover:to-[#FF0404] text-white text-lg font-bold rounded-2xl transition-all hover:-translate-y-1"
            style={{ boxShadow: '0 0 50px rgba(248, 116, 4, 0.45), 0 20px 60px rgba(0,0,0,0.4)' }}>
            <Zap size={20} fill="white" />
            Yes — I Want That
            <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
          </Link>

          <p className="text-gray-600 text-sm mt-4">30 days free · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-24 md:py-32 bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-6 bg-gradient-to-br from-[#F87404]/20 to-transparent rounded-3xl blur-2xl" />
              <img
                src="https://images.unsplash.com/photo-1546483875-ad9014c88eba?w=700&h=800&fit=crop"
                alt="Kelvin Silas — Founder, Team Extreme"
                className="w-full rounded-3xl object-cover shadow-2xl relative z-10"
                style={{ maxHeight: 580 }}
              />
              {/* Floating card */}
              <div className="absolute -bottom-6 -right-4 z-20 bg-white dark:bg-[#1a1a1a] rounded-2xl px-5 py-4 shadow-2xl border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#F87404] flex items-center justify-center text-white font-display font-bold text-lg shadow-lg">
                    10+
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Years Coaching</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Helping people transform</div>
                  </div>
                </div>
              </div>
              {/* Second floating card */}
              <div className="absolute -top-4 -left-4 z-20 bg-[#F87404] rounded-2xl px-4 py-3 shadow-xl">
                <div className="flex items-center gap-2 text-white">
                  <Trophy size={16} fill="white" />
                  <span className="font-bold text-sm">Team Extreme Founder</span>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
                <div className="w-8 h-0.5 bg-[#F87404]" />
                About Your Coach
              </div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-[52px] text-gray-900 dark:text-white mb-6 leading-[1.05]">
                Built by a Coach
                <br />
                <span className="text-[#F87404]">Who Gets It.</span>
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-8">
                <p>
                  I&apos;m <strong className="text-gray-900 dark:text-white">Kelvin Silas</strong>, founder of Team Extreme. I&apos;ve spent over a decade watching incredible people struggle — not because they lacked motivation, but because they lacked the <em>right tools and the right community</em>.
                </p>
                <p>
                  Every app they tried was either too expensive, too complicated, or completely isolated. No community. No accountability. No real coaching.
                </p>
                <p className="text-gray-900 dark:text-white font-semibold">
                  So I built exactly what I wish existed. One platform. Every tool. Real people. Real results.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { icon: Target, label: 'Goal-Driven Approach', color: '#F87404' },
                  { icon: Users, label: 'True Community Support', color: '#10B981' },
                  { icon: Bot, label: 'AI Coaching 24/7', color: '#004AAD' },
                  { icon: TrendingUp, label: 'Measurable Progress', color: '#7C3AED' },
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
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white font-bold rounded-2xl shadow-xl shadow-[#F87404]/20 hover:shadow-[#F87404]/40 hover:-translate-y-0.5 transition-all group">
                Join Team Extreme Today
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
              😊 Healthy, Happy & Having Fun
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-gray-900 dark:text-white mb-4 leading-tight">
              Fitness is a <span className="text-[#F87404]">Lifestyle</span>,<br className="hidden sm:block" /> Not a Punishment
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xl max-w-xl mx-auto">
              We make healthy eating delicious, workouts addictive, and your community the reason you keep showing up.
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
                  🥗 Nutrition & Meal Planning
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">Eat Food You Actually Love</h3>
                <p className="text-white/75 text-sm leading-relaxed">
                  500+ healthy recipes. Log a full meal in seconds. Your AI coach builds you a meal plan that fits your goals AND your taste buds.
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
                    📦 Meal Prep Made Easy
                  </div>
                  <h4 className="font-display text-xl font-bold text-white">Plan Your Week in Minutes</h4>
                  <p className="text-white/70 text-xs mt-1">Auto-generates your shopping list. Every. Single. Week.</p>
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
                    🌈 500+ Tracked Recipes
                  </div>
                  <h4 className="font-display text-xl font-bold text-white">Nutrition That Tastes Amazing</h4>
                  <p className="text-white/70 text-xs mt-1">Full macros. One-tap log. No more guessing.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row — hydration + community + workout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
            {[
              {
                img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
                badge: '💪 Workout Tracker',
                title: 'Every Rep Counts',
                sub: 'Log workouts, track PRs, and watch your strength climb week by week.',
                color: '#FF0404',
              },
              {
                img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&h=400&fit=crop',
                badge: '💧 Hydration Logging',
                title: 'Stay Hydrated, Stay Sharp',
                sub: 'Track water intake, set daily goals, and get reminders to keep you going.',
                color: '#004AAD',
              },
              {
                img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=400&fit=crop',
                badge: '🤝 Community',
                title: 'Your People Are Here',
                sub: 'Post progress, react to members, make real friends who push you forward.',
                color: '#10B981',
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
          <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 dark:from-[#F87404]/8 dark:via-[#FF5C04]/5 dark:to-[#F87404]/8 rounded-3xl p-8 md:p-10 border border-orange-100 dark:border-[#F87404]/15 text-center relative overflow-hidden">
            <div className="absolute left-6 top-4 text-[80px] font-serif text-[#F87404]/15 leading-none select-none">&ldquo;</div>
            <p className="relative text-2xl md:text-3xl font-display text-gray-800 dark:text-white font-bold mb-3 max-w-3xl mx-auto">
              This isn&apos;t about being perfect. It&apos;s about being{' '}
              <span className="text-[#F87404]">consistent</span> — and having a{' '}
              <span className="text-[#F87404]">community</span> that won&apos;t let you quit.
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
              A Day in Your Life with <span className="text-[#F87404]">My EXtreme Trainer</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">From morning to night — your whole wellness journey, one app.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { time: '6:00 AM', emoji: '☀️', label: 'Morning Check-In', desc: 'Review today\'s plan & AI tip', color: '#F87404', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop' },
              { time: '7:30 AM', emoji: '🥗', label: 'Log Breakfast', desc: 'Scan or snap — done in 10s', color: '#10B981', img: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=300&h=200&fit=crop' },
              { time: '12:00 PM', emoji: '💧', label: 'Hydration Log', desc: 'Hit your daily water goal', color: '#004AAD', img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=200&fit=crop' },
              { time: '4:00 PM', emoji: '🏋️', label: 'Crush Workout', desc: 'AI-coached session logged', color: '#FF0404', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=200&fit=crop' },
              { time: '6:30 PM', emoji: '🍽️', label: 'Post-Workout Meal', desc: 'Recipes picked for your macros', color: '#FFC000', img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&h=200&fit=crop' },
              { time: '9:00 PM', emoji: '🤝', label: 'Community Time', desc: 'Cheer members, share a win', color: '#7C3AED', img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=300&h=200&fit=crop' },
            ].map(({ time, emoji, label, desc, color, img }) => (
              <div key={time} className="group bg-white dark:bg-[#111] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/30 hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg hover:shadow-[#F87404]/10 cursor-pointer">
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
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#F87404]/8 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
              <div className="w-8 h-0.5 bg-[#F87404]" />
              Everything You Need
              <div className="w-8 h-0.5 bg-[#F87404]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-[56px] text-white mb-5 leading-tight">
              What Does My EXtreme<br />Trainer Include?
            </h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">
              Six powerful tools. One connected platform. Everything talks to everything — so you never have to switch apps again.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {features.map(({ icon: Icon, title, desc, color, emoji }) => (
              <div key={title}
                className="group bg-[#111] hover:bg-[#161616] rounded-3xl p-6 border border-white/[0.06] hover:border-[#F87404]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#F87404]/10 cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110"
                    style={{ background: `${color}18` }}>
                    {emoji}
                  </div>
                  <Icon size={20} style={{ color }} className="opacity-60" />
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-2 leading-tight">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                <div className="mt-4 flex items-center gap-1 text-[#F87404] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1 duration-300">
                  Explore feature <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>

          {/* Bonus features strip */}
          <div className="bg-gradient-to-r from-[#F87404] via-[#FF5C04] to-[#F87404] rounded-3xl p-8">
            <h3 className="font-display text-2xl font-bold text-white mb-6 text-center">
              Plus These Premium Power Features
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Camera, label: 'AI Photo Meal Logging' },
                { icon: BarChart3, label: 'Barcode Scanner' },
                { icon: Mic, label: 'Voice Logging' },
                { icon: ShoppingCart, label: 'Auto Shopping Lists' },
                { icon: MessageCircle, label: 'Direct Messaging' },
                { icon: Award, label: 'Achievement Posters' },
                { icon: Target, label: 'AI Body Visualizer' },
                { icon: Zap, label: 'Grocery App Sync' },
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

      {/* ── COMMUNITY FACES STRIP ── */}
      <section className="py-16 bg-white dark:bg-[#0a0a0a] border-y border-gray-100 dark:border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="shrink-0 text-center md:text-left">
              <div className="font-display text-4xl font-bold text-gray-900 dark:text-white">10,247+</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">members already inside</div>
              <div className="flex items-center gap-1 mt-2 justify-center md:justify-start">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-[#FFC000] fill-[#FFC000]" />)}
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">4.9 avg rating</span>
              </div>
            </div>
            <div className="flex-1 flex flex-wrap gap-2 justify-center md:justify-start">
              {[
                'https://images.unsplash.com/photo-1494790108755-2616b612d5ca?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1546961342-ea5f60a193d5?w=80&h=80&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face',
              ].map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt=""
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-[#0a0a0a] hover:ring-[#F87404]/50 transition-all hover:scale-110 cursor-pointer" />
                  {i < 3 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-white dark:ring-[#0a0a0a]" />
                  )}
                </div>
              ))}
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white dark:ring-[#0a0a0a]">
                +9K
              </div>
            </div>
            <div className="shrink-0">
              <Link href="/auth/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white font-bold rounded-2xl shadow-lg shadow-[#F87404]/20 hover:shadow-[#F87404]/40 hover:-translate-y-0.5 transition-all text-sm whitespace-nowrap">
                Join the Community
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── RESULTS / TESTIMONIALS ── */}
      <section id="results" className="py-24 md:py-32 bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
              <div className="w-8 h-0.5 bg-[#F87404]" />
              Real Results
              <div className="w-8 h-0.5 bg-[#F87404]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-[56px] text-gray-900 dark:text-white mb-4 leading-tight">
              Real People.<br />
              <span className="text-[#F87404]">Real Transformations.</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xl">No photoshop. No paid actors. Just Team Extreme members doing the work.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {testimonials.map((t) => (
              <div key={t.name}
                className="group bg-gray-50 dark:bg-[#111] rounded-3xl p-7 border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#F87404]/10">

                {/* Stars */}
                <div className="flex items-center gap-1 mb-5">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} size={16} className="text-[#FFC000] fill-[#FFC000]" />
                  ))}
                  <span className="ml-1 text-xs font-bold text-[#FFC000]">5.0</span>
                </div>

                {/* Quote */}
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Result badge */}
                <div className="flex items-center gap-2 mb-5 p-3 bg-[#F87404]/8 dark:bg-[#F87404]/10 rounded-xl border border-[#F87404]/20">
                  <Trophy size={15} className="text-[#F87404] shrink-0" />
                  <span className="text-sm font-bold text-[#F87404]">{t.goal}</span>
                </div>

                {/* Profile */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-white/[0.07]">
                  <img src={t.avatar} alt={t.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#F87404]/30" />
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm">{t.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <CheckCircle size={11} className="text-green-500" />
                      Verified Member · {t.location}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Results banner */}
          <div className="bg-gradient-to-r from-gray-900 to-black rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(248,116,4,0.06) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#F87404]/15 rounded-full blur-3xl" />
            <div className="relative">
              <h3 className="font-display text-3xl md:text-4xl text-white mb-4">
                Your transformation starts with one decision.
              </h3>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                Every one of our top members started exactly where you are right now. The only difference?
                They clicked the button below.
              </p>
              <Link href="/auth/register"
                className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white text-lg font-bold rounded-2xl shadow-2xl shadow-[#F87404]/30 hover:shadow-[#F87404]/50 hover:-translate-y-1 transition-all group">
                <Zap size={20} fill="white" />
                I&apos;m Ready to Transform
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className="text-gray-500 text-sm mt-4">Join {memberCount.toLocaleString()}+ members · 30 days free · No credit card</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHOTO GALLERY ── */}
      <section className="py-20 bg-[#0d0d0d]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#F87404]/15 text-[#F87404] text-sm font-bold px-4 py-2 rounded-full mb-4 border border-[#F87404]/20">
              📸 Life on Team Extreme
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-white mb-3">Eat. Train. Hydrate. <span className="text-[#F87404]">Thrive.</span></h2>
            <p className="text-gray-400 text-lg">Real members. Real food. Real training. Real community.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3" style={{ gridAutoRows: '180px' }}>
            {galleryImages.map((img, i) => (
              <div key={i} className={`${img.span} overflow-hidden rounded-2xl group cursor-pointer relative`}>
                <img src={img.src} alt={img.caption}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-sm font-semibold">{img.caption}</span>
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
                Works Like a Native App
              </div>
              <h2 className="font-display text-4xl md:text-5xl text-gray-900 dark:text-white mb-6 leading-tight">
                Add to Your<br />
                <span className="text-[#F87404]">Home Screen.</span><br />
                <span className="text-gray-400 dark:text-gray-500 text-3xl">No download needed.</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-8 leading-relaxed">
                Visit on your phone and save it to your home screen. It opens full screen — no browser bar —
                exactly like Instagram. Works on iPhone and Android.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: Shield, text: 'Works on iPhone & Android — no app store needed' },
                  { icon: Zap, text: 'Full-screen experience, just like a native app' },
                  { icon: Clock, text: 'Camera, voice, push notifications — all included' },
                  { icon: Heart, text: 'Instant updates — always the latest version' },
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
              <div className="relative w-72 animate-float">
                <div className="bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl ring-2 ring-[#F87404]/20"
                  style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 40px rgba(248,116,4,0.2)' }}>
                  <div className="bg-[#0d0d0d] rounded-[2rem] overflow-hidden">
                    <div className="h-8 bg-gray-900 flex items-center justify-center">
                      <div className="w-24 h-3.5 bg-gray-700 rounded-full" />
                    </div>
                    <div className="bg-[#0d0d0d] px-4 pt-4 pb-6 space-y-3">
                      <div className="text-white text-sm font-display text-center mb-2 font-bold">Good Morning, Kelvin! 💪</div>
                      <div className="text-[#F87404] text-[9px] font-bold tracking-widest text-center opacity-70 mb-3">MY EXTREME TRAINER</div>

                      {/* Dashboard tiles */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Exercise', color: '#FF0404', emoji: '🏋️', sub: '3 sessions this week' },
                          { label: 'Nutrition', color: '#F87404', emoji: '🍽️', sub: '1,340 / 2,000 cal' },
                          { label: 'Recipes', color: '#FFC000', emoji: '👨‍🍳', sub: '12 saved recipes' },
                          { label: 'Community', color: '#004AAD', emoji: '🤝', sub: '48 new posts' },
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
                          <span className="text-orange-400 text-[9px] font-bold tracking-wider">TODAY&apos;S CALORIES</span>
                          <span className="text-gray-400 text-[9px]">67%</span>
                        </div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-white text-sm font-bold">1,340</span>
                          <span className="text-gray-500 text-[9px]">of 2,000 kcal</span>
                        </div>
                        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#F87404] to-[#FF5C04]" style={{ width: '67%' }} />
                        </div>
                      </div>

                      {/* Streak */}
                      <div className="flex items-center justify-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                        <span className="text-lg">🔥</span>
                        <span className="text-white text-xs font-bold">16 Day Streak — Keep going!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 bg-gray-50 dark:bg-[#060606]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-[#F87404] text-sm font-bold uppercase tracking-widest mb-5">
              <div className="w-8 h-0.5 bg-[#F87404]" />
              Simple Pricing
              <div className="w-8 h-0.5 bg-[#F87404]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-[56px] text-gray-900 dark:text-white mb-4 leading-tight">
              Less Than Your<br />
              <span className="text-[#F87404]">Daily Coffee.</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xl mb-4">
              A personal AI trainer, social community, nutrition tracking, recipes, and more — for under $10/month.
            </p>
            <p className="text-gray-400 text-base mb-10">30-day free trial on all plans. Cancel anytime. No credit card required to start.</p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-2 bg-gray-200 dark:bg-white/10 rounded-2xl p-1.5">
              <button onClick={() => setBillingAnnual(false)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${!billingAnnual ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-md' : 'text-gray-400'}`}>
                Monthly
              </button>
              <button onClick={() => setBillingAnnual(true)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${billingAnnual ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-md' : 'text-gray-400'}`}>
                Annual
                <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {pricingTiers.map((tier) => (
              <div key={tier.name}
                className={`relative bg-white dark:bg-[#111] rounded-3xl border-2 ${tier.color} p-7 ${tier.highlight ? 'shadow-2xl shadow-[#F87404]/20 md:scale-105 md:-translate-y-2' : 'shadow-lg'}`}>

                {tier.badge && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-lg whitespace-nowrap ${tier.highlight ? 'bg-gradient-to-r from-[#F87404] to-[#FF5C04]' : 'bg-[#004AAD]'}`}>
                    {tier.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-3">{tier.name}</h3>
                  {tier.monthly ? (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-5xl font-bold text-gray-900 dark:text-white">
                          ${billingAnnual ? (tier.annual / 12).toFixed(2) : tier.monthly}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-lg">/mo</span>
                      </div>
                      {billingAnnual && (
                        <div className="text-green-500 text-sm font-bold mt-1">Billed ${tier.annual}/year — Save ${(tier.monthly * 12 - tier.annual).toFixed(2)}</div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-5xl font-bold text-gray-900 dark:text-white">${tier.annual}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-lg">/year</span>
                      </div>
                      <div className="text-green-500 text-sm font-bold mt-1">That&apos;s just $8.33/month 🎉</div>
                    </div>
                  )}
                </div>

                {/* Free trial highlight */}
                <div className="mb-6 p-3 bg-green-50 dark:bg-green-500/8 rounded-xl border border-green-200 dark:border-green-500/20 text-center">
                  <span className="text-green-700 dark:text-green-400 text-sm font-bold">
                    {tier.name === 'Annual VIP' ? '✓ 60-Day Free Trial Included' : '✓ 30-Day Free Trial Included'}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-8">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle size={16} className="text-[#F87404] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/auth/register"
                  className={`block w-full text-center py-4 rounded-2xl font-bold text-sm transition-all hover:-translate-y-0.5 ${tier.btnStyle}`}>
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>

          {/* Guarantee */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/[0.07] shadow-sm">
              <Shield size={22} className="text-green-500 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-bold text-gray-900 dark:text-white">30-Day Money-Back Guarantee</div>
                <div className="text-xs text-gray-400">Not happy in 30 days? We&apos;ll refund every penny. No questions asked.</div>
              </div>
            </div>
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
          backgroundSize: '28px 28px',
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#F87404]/15 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-[#F87404]/20 border border-[#F87404]/40 text-[#F87404] text-sm font-bold px-5 py-2 rounded-full mb-8">
            <Flame size={14} fill="currentColor" />
            Join {memberCount.toLocaleString()}+ members already crushing it
          </div>

          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-white mb-6 leading-[0.92]">
            Your Transformation<br />
            <span style={{
              background: 'linear-gradient(135deg, #F87404 0%, #FF5C04 50%, #FF0404 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Starts Right Now.
            </span>
          </h2>

          <p className="text-gray-300 text-xl mb-4 max-w-2xl mx-auto leading-relaxed">
            You&apos;ve read this far. You know this is the right move. The only thing standing between you and the body you want is a single click.
          </p>
          <p className="text-gray-500 text-base mb-12">No credit card. No risk. 30 days completely free. Cancel anytime.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register"
              className="group inline-flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-[#F87404] to-[#FF5C04] hover:from-[#FF5C04] hover:to-[#FF0404] text-white text-xl font-bold rounded-2xl transition-all hover:-translate-y-1.5 w-full sm:w-auto justify-center"
              style={{ boxShadow: '0 0 60px rgba(248, 116, 4, 0.5), 0 20px 60px rgba(0,0,0,0.4)' }}>
              <Zap size={24} fill="white" />
              Start My Free Trial
              <ArrowRight size={24} className="group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            {[
              { icon: Shield, text: 'No credit card required' },
              { icon: Clock, text: '30-day free trial' },
              { icon: Heart, text: 'Cancel anytime' },
              { icon: Zap, text: 'Instant access' },
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center text-white font-display font-bold shadow-lg shadow-[#F87404]/20">MX</div>
                <span className="font-display text-white font-bold">My EXtreme Trainer</span>
              </div>
              <p className="text-sm leading-relaxed mb-5 text-gray-500">The all-in-one fitness platform that transforms your body and connects your community.</p>
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
              <h4 className="text-white font-bold mb-5 text-sm">Platform</h4>
              <ul className="space-y-2.5 text-sm">
                {['Food Journal', 'Fitness Tracker', 'AI Trainer', 'Social Feed', 'Recipes', 'Calendar'].map(l => (
                  <li key={l}><Link href="/auth/register" className="hover:text-[#F87404] transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-5 text-sm">Company</h4>
              <ul className="space-y-2.5 text-sm">
                {['About Kelvin', 'Pricing', 'Blog', 'Contact', 'Privacy Policy', 'Terms of Service'].map(l => (
                  <li key={l}><a href="#" className="hover:text-[#F87404] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-5 text-sm">Contact</h4>
              <div className="space-y-3 text-sm">
                <p className="text-gray-500">GoTeamEXtreme.com</p>
                <p className="text-gray-500">MyEXtremeTrainer.com</p>
                <a href="mailto:hello@myextremetrainer.com"
                  className="hover:text-[#F87404] transition-colors block">hello@myextremetrainer.com</a>
                <div className="pt-2">
                  <Link href="/auth/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F87404]/15 hover:bg-[#F87404]/25 text-[#F87404] rounded-xl text-xs font-bold transition-colors border border-[#F87404]/20">
                    <Zap size={12} />
                    Start Free Trial
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            <p>© 2025 My EXtreme Trainer — Team Extreme. All rights reserved.</p>
            <div className="flex gap-5">
              {['Privacy', 'Terms', 'Cookies'].map(l => (
                <a key={l} href="#" className="hover:text-[#F87404] transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Video modal */}
      {activeVideo !== null && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}>
          <div className="bg-gray-900 rounded-2xl overflow-hidden max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="aspect-video bg-black flex items-center justify-center">
              <div className="text-center text-white">
                <Play size={52} className="mx-auto mb-4 text-[#F87404]" fill="#F87404" />
                <p className="font-display text-2xl">Video Coming Soon</p>
                <p className="text-gray-400 text-sm mt-2">Full workout library available inside the app</p>
              </div>
            </div>
            <div className="p-4 flex justify-between items-center border-t border-white/10">
              <Link href="/auth/register" className="px-5 py-2.5 bg-[#F87404] text-white rounded-xl text-sm font-bold hover:bg-[#FF5C04] transition-colors">
                Get Full Access
              </Link>
              <button onClick={() => setActiveVideo(null)}
                className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
