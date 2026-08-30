'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Controls';
import { Alert } from '@/components/ui/States';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

/**
 * SECURITY: this page previously rendered a "Dev Quick Login" panel containing
 * the admin email, the member email, and the shared password in plain text —
 * in every build, including production. It is now gated behind
 * NODE_ENV === 'development', so it exists locally for testing and is stripped
 * from production bundles entirely.
 */
const SHOW_DEV_LOGIN = process.env.NODE_ENV === 'development';

function LoginForm() {
  const router = useRouter();
  // Set by the axios 401 handler when a token has run out, so the member is
  // told why they are back here rather than wondering if they did something
  // wrong.
  const expired = useSearchParams()?.get('expired') === '1';
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const doLogin = async (email: string, password: string, remember = false) => {
    setErrors({});
    setLoading(true);
    setForm((v) => ({ ...v, email, password }));
    try {
      const res = await api.post('/auth/login', { email, password, remember });
      const { token, user } = res.data.data;
      setAuth(user, token);
      const maxAge = remember ? 2592000 : 86400;
      document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}`;
      // The Next.js middleware runs at the edge with no access to localStorage,
      // so the role has to travel in a cookie for it to redirect on it. This is
      // a NAVIGATION hint only — a user can edit it, so nothing is trusted to
      // it. The real boundary is the API: 'admin' and 'member' middleware.
      document.cookie = `user_role=${user.is_admin ? 'admin' : 'member'}; path=/; max-age=${maxAge}`;
      toast.success(`Welcome${user.is_admin ? '' : ' back'}, ${user.name}`);
      if (!user.email_verified) {
        router.replace('/auth/verify-email');
      } else {
        router.replace(
          user.is_admin ? '/admin' : user.onboarding_completed ? '/dashboard' : '/auth/onboarding'
        );
      }
    } catch (err) {
      setErrors({ general: getErrorMessage(err, 'Invalid email or password.') });
      setForm((v) => ({ ...v, email, password: '' }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(form.email, form.password, form.remember);
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display text-content-primary">Sign in</h1>
        <p className="text-body text-content-secondary">
          New here?{' '}
          <Link
            href="/auth/register"
            className="text-accent font-semibold underline underline-offset-2 hover:text-accent-hover"
          >
            Start your free 30-day trial
          </Link>
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
          autoComplete="email"
          error={errors.email}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-body-sm font-medium text-content-secondary">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-caption font-medium text-accent hover:text-accent-hover"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              placeholder="Your password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              className={`w-full h-11 pl-3 pr-12 rounded-sm bg-surface-raised border text-body text-content-primary placeholder:text-content-tertiary outline-none transition-colors duration-150 ${
                errors.password ? 'border-error focus-visible:border-error' : 'border-border-strong focus-visible:border-accent'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-sm flex items-center justify-center text-content-tertiary hover:text-content-primary transition-colors"
            >
              {showPass ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        <Switch
          checked={form.remember}
          onChange={(remember) => setForm((p) => ({ ...p, remember }))}
          label="Keep me signed in for 30 days"
        />

        {expired && !errors.general && (
          <Alert tone="info">Your session has ended. Please sign in again.</Alert>
        )}
        {errors.general && <Alert tone="error">{errors.general}</Alert>}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          iconRight={<ArrowRight size={16} strokeWidth={2} />}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="flex items-center gap-3">
          <span className="flex-1 h-px bg-border-subtle" />
          <span className="text-overline font-semibold uppercase text-content-tertiary">or</span>
          <span className="flex-1 h-px bg-border-subtle" />
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.href = `${(process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')}/api/auth/google/redirect`;
          }}
          className="w-full h-11 rounded-sm border border-border-strong bg-surface-raised flex items-center justify-center gap-3 text-body font-semibold text-content-primary hover:bg-surface-sunken transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77a4.79 4.79 0 0 1-4.52-3.3H1.83v2.07A8 8 0 0 0 8.98 17z" />
            <path fill="#FBBC05" d="M4.46 10.52A4.8 4.8 0 0 1 4.2 9c0-.52.09-1.02.26-1.52V5.41H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.51.85 3.59l2.63-2.07z" />
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.15 4.41l2.63 2.07a4.79 4.79 0 0 1 4.52-3.3z" />
          </svg>
          Continue with Google
        </button>
      </form>

      {SHOW_DEV_LOGIN && (
        <div className="rounded-md border border-dashed border-border-strong p-3 flex flex-col gap-2">
          <p className="text-overline font-semibold uppercase text-content-tertiary text-center">
            Dev only — not in production builds
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => doLogin('kelvin@myextremetrainer.com', 'password123')}
            >
              Admin
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => doLogin('member@myextremetrainer.com', 'password123')}
            >
              Member
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-caption text-content-tertiary">
        By signing in you agree to our{' '}
        <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link> and{' '}
        <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}

/**
 * useSearchParams() forces this subtree to bail out of prerendering, and Next
 * fails the production build unless that bail-out happens inside a Suspense
 * boundary. Without this wrapper 'next build' aborts on /auth/login, so the app
 * cannot be deployed at all.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
