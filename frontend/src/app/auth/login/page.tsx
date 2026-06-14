'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, Shield, User } from 'lucide-react';
import { useAuthStore, AuthUser } from '@/store/authStore';

const MOCK_USERS: Record<string, { password: string; user: AuthUser; token: string }> = {
  'test@myextremetrainer.com': {
    password: 'password123',
    token: 'mock-admin-token-xyz',
    user: {
      id: 1,
      name: 'Admin User',
      email: 'test@myextremetrainer.com',
      avatar_url: 'https://ui-avatars.com/api/?name=Admin+User&background=0000FF&color=fff',
      bio: 'Platform administrator',
      is_admin: true,
      onboarding_completed: true,
      subscription_status: 'active',
      is_on_trial: false,
      trial_days_remaining: 0,
      member_since: '2024-01-01',
      daily_water_goal_glasses: 8,
      daily_calorie_goal: 2200,
      daily_protein_goal_g: 150,
      daily_carbs_goal_g: 220,
      daily_fat_goal_g: 70,
    },
  },
  'hassam.dev.571@gmail.com': {
    password: 'password123',
    token: 'mock-member-token-xyz',
    user: {
      id: 2,
      name: 'Hassam Dev',
      email: 'hassam.dev.571@gmail.com',
      avatar_url: 'https://ui-avatars.com/api/?name=Hassam+Dev&background=F87404&color=fff',
      bio: 'Fitness enthusiast',
      is_admin: false,
      onboarding_completed: true,
      subscription_status: 'trial',
      is_on_trial: true,
      trial_days_remaining: 22,
      trial_ends_at: '2026-07-04',
      member_since: '2026-06-12',
      daily_water_goal_glasses: 8,
      daily_calorie_goal: 2000,
      daily_protein_goal_g: 130,
      daily_carbs_goal_g: 200,
      daily_fat_goal_g: 65,
    },
  },
};

function mockLogin(email: string, password: string): { user: AuthUser; token: string } | null {
  const entry = MOCK_USERS[email.toLowerCase().trim()];
  if (!entry || entry.password !== password) return null;
  return { user: entry.user, token: entry.token };
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const doLogin = (email: string, password: string, remember = false) => {
    setErrors({});
    setLoading(true);
    setTimeout(() => {
      const result = mockLogin(email, password);
      if (!result) {
        toast.error('Invalid email or password.');
        setLoading(false);
        return;
      }
      const { user, token } = result;
      setAuth(user, token);
      document.cookie = `auth_token=${token}; path=/; max-age=${remember ? 2592000 : 86400}`;
      toast.success(`Welcome${user.is_admin ? '' : ' back'}, ${user.name}!`);
      router.replace(user.is_admin ? '/admin' : (user.onboarding_completed ? '/dashboard' : '/onboarding'));
    }, 400);
  };

  const quickLogin = (email: string, password: string) => doLogin(email, password);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(form.email, form.password, form.remember);
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <span className="flex items-center gap-1.5 bg-[#F87404]/10 text-[#F87404] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#F87404]/20">
            <Sparkles size={11} />
            Returning Athlete
          </span>
        </div>
        <h1 className="font-display text-[2.4rem] font-black text-gray-900 leading-[1.1] mb-2">
          Sign in to<br />your account
        </h1>
        <p className="text-gray-500 text-[15px]">
          New here?{' '}
          <Link href="/auth/register" className="text-[#F87404] font-semibold hover:text-[#e06000] transition-colors underline underline-offset-2">
            Start your free 30-day trial
          </Link>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">Email Address</label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F87404] transition-colors">
              <Mail size={16} />
            </div>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
              autoComplete="email"
              className={`w-full pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border rounded-xl outline-none transition-all
                focus:bg-white focus:shadow-sm
                ${errors.email
                  ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : 'border-gray-200 focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15'
                }`}
            />
          </div>
          {errors.email && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Password</label>
            <Link href="/auth/forgot-password" className="text-xs font-medium text-[#F87404] hover:text-[#e06000] transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F87404] transition-colors">
              <Lock size={16} />
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              autoComplete="current-password"
              className={`w-full pl-11 pr-12 py-3.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border rounded-xl outline-none transition-all
                focus:bg-white focus:shadow-sm
                ${errors.password
                  ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : 'border-gray-200 focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15'
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {errors.password}</p>}
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <div className="relative flex-shrink-0">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={e => setForm(p => ({ ...p, remember: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-[#F87404] peer-checked:border-[#F87404] transition-all flex items-center justify-center">
              {form.remember && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
            Keep me signed in for 30 days
          </span>
        </label>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F87404] hover:bg-[#e06000] active:scale-[0.99] text-white font-bold py-4 rounded-xl text-sm transition-all shadow-lg shadow-[#F87404]/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 group mt-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in…
            </>
          ) : (
            <>
              Sign In to Dashboard
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">Or sign in with</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={() => toast('Google OAuth coming soon!', { icon: '🚀' })}
          className="w-full border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl py-3.5 flex items-center justify-center gap-3 text-sm font-semibold text-gray-700 transition-all active:scale-[0.99]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77a4.79 4.79 0 0 1-4.52-3.3H1.83v2.07A8 8 0 0 0 8.98 17z" />
            <path fill="#FBBC05" d="M4.46 10.52A4.8 4.8 0 0 1 4.2 9c0-.52.09-1.02.26-1.52V5.41H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.51.85 3.59l2.63-2.07z" />
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.15 4.41l2.63 2.07a4.79 4.79 0 0 1 4.52-3.3z" />
          </svg>
          Continue with Google
        </button>
      </form>

      {/* Dev quick-login shortcuts */}
      <div className="border border-dashed border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/50">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Dev Quick Login</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => quickLogin('test@myextremetrainer.com', 'password123')}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-sm shadow-blue-600/20"
          >
            <Shield size={13} /> Admin Login
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => quickLogin('hassam.dev.571@gmail.com', 'password123')}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-700 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-sm"
          >
            <User size={13} /> Member Login
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center">password123 for both accounts</p>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 leading-relaxed">
        By signing in, you agree to our{' '}
        <Link href="/terms" className="text-[#F87404] hover:underline font-medium">Terms of Service</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-[#F87404] hover:underline font-medium">Privacy Policy</Link>
      </p>
    </div>
  );
}
