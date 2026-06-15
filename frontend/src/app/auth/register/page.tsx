'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuthStore, AuthUser } from '@/store/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (form.password !== form.password_confirmation) {
      setErrors({ password_confirmation: 'Passwords do not match.' });
      return;
    }
    if (form.password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters.' });
      return;
    }
    if (!form.name.trim()) {
      setErrors({ name: 'Name is required.' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const newUser: AuthUser = {
        id: Math.floor(Math.random() * 9000) + 100,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name.trim())}&background=F87404&color=fff&size=128`,
        bio: '',
        is_admin: false,
        onboarding_completed: false,
        subscription_status: 'trial',
        is_on_trial: true,
        trial_days_remaining: 30,
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        member_since: new Date().toISOString().split('T')[0],
        daily_water_goal_glasses: 8,
        daily_calorie_goal: 2000,
        daily_protein_goal_g: 130,
        daily_carbs_goal_g: 200,
        daily_fat_goal_g: 65,
      };
      const token = `mock-token-${Date.now()}`;
      setAuth(newUser, token);
      document.cookie = `auth_token=${token}; path=/; max-age=2592000`;
      toast.success('Welcome! Your 30-day free trial has started 🎉');
      router.replace('/auth/onboarding');
      setLoading(false);
    }, 800);
  };

  const passwordStrength = (() => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 6) return { level: 1, label: 'Weak', color: '#ef4444' };
    if (p.length < 10) return { level: 2, label: 'Fair', color: '#f59e0b' };
    return { level: 3, label: 'Strong', color: '#10b981' };
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-emerald-200 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          30-Day Free Trial — No Credit Card Required
        </div>
        <h1 className="font-display text-[2.2rem] font-black text-gray-900 leading-[1.1] mb-2">
          Create your<br />free account
        </h1>
        <p className="text-gray-500 text-[15px]">
          Already a member?{' '}
          <Link href="/auth/login" className="text-[#F87404] font-semibold hover:text-[#e06000] transition-colors underline underline-offset-2">
            Sign in here
          </Link>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">Full Name</label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F87404] transition-colors">
              <User size={16} />
            </div>
            <input
              type="text"
              placeholder="Kelvin Silas"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
              autoComplete="name"
              className={`w-full pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border rounded-xl outline-none transition-all focus:bg-white focus:shadow-sm
                ${errors.name ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15'}`}
            />
          </div>
          {errors.name && <p className="text-xs text-red-500">⚠ {errors.name}</p>}
        </div>

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
              className={`w-full pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border rounded-xl outline-none transition-all focus:bg-white focus:shadow-sm
                ${errors.email ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15'}`}
            />
          </div>
          {errors.email && <p className="text-xs text-red-500">⚠ {errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">Password</label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F87404] transition-colors">
              <Lock size={16} />
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              autoComplete="new-password"
              className={`w-full pl-11 pr-12 py-3.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border rounded-xl outline-none transition-all focus:bg-white focus:shadow-sm
                ${errors.password ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15'}`}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {/* Password strength bar */}
          {passwordStrength && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-1.5 flex-1 rounded-full transition-all" style={{
                    backgroundColor: i <= passwordStrength.level ? passwordStrength.color : '#e5e7eb'
                  }} />
                ))}
              </div>
              <span className="text-[11px] font-semibold" style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
            </div>
          )}
          {errors.password && <p className="text-xs text-red-500">⚠ {errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">Confirm Password</label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F87404] transition-colors">
              <Lock size={16} />
            </div>
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={form.password_confirmation}
              onChange={e => setForm(p => ({ ...p, password_confirmation: e.target.value }))}
              required
              autoComplete="new-password"
              className={`w-full pl-11 pr-12 py-3.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border rounded-xl outline-none transition-all focus:bg-white focus:shadow-sm
                ${errors.password_confirmation ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15'}`}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password_confirmation && <p className="text-xs text-red-500">⚠ {errors.password_confirmation}</p>}
        </div>

        {/* Trial perks summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '✓', text: 'Full access' },
            { icon: '✓', text: 'No credit card' },
            { icon: '✓', text: '30 days free' },
          ].map(p => (
            <div key={p.text} className="flex items-center gap-1.5 bg-[#F87404]/5 border border-[#F87404]/15 rounded-lg px-2.5 py-2">
              <span className="text-[#F87404] font-bold text-xs">{p.icon}</span>
              <span className="text-[11px] text-gray-600 font-medium">{p.text}</span>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F87404] hover:bg-[#e06000] active:scale-[0.99] text-white font-bold py-4 rounded-xl text-sm transition-all shadow-lg shadow-[#F87404]/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 group"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating your account…
            </>
          ) : (
            <>
              Start My Free Trial
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 leading-relaxed">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="text-[#F87404] hover:underline font-medium">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-[#F87404] hover:underline font-medium">Privacy Policy</Link>.
        <br />Your trial starts immediately — cancel anytime.
      </p>
    </div>
  );
}
