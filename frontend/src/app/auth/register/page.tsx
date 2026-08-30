'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight, Check, Minus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import api from '@/lib/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const betaBlocked = searchParams.get('beta_blocked') === '1';
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!form.name.trim()) return setErrors({ name: 'Enter your name.' });
    if (!EMAIL_PATTERN.test(form.email.trim()))
      return setErrors({ email: 'Enter a valid email address, e.g. name@example.com.' });
    if (form.password.length < 8)
      return setErrors({ password: 'Use at least 8 characters.' });
    if (form.password !== form.password_confirmation)
      return setErrors({ password_confirmation: 'Passwords do not match.' });

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        password_confirmation: form.password_confirmation,
      });
      const { token, user } = res.data.data;
      setAuth(user, token);
      document.cookie = `auth_token=${token}; path=/; max-age=2592000`;
      toast.success('Account created. Your 30-day trial has started.');
      router.replace(user.email_verified ? '/auth/onboarding' : '/auth/verify-email');
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } })
        .response?.data;
      if (data?.errors) {
        const mapped: Record<string, string> = {};
        Object.entries(data.errors).forEach(([k, v]) => {
          mapped[k] = v[0];
        });
        setErrors(mapped);
      } else {
        setErrors({ general: data?.message || 'Could not create your account. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const checks = [
    { key: 'length', label: 'At least 8 characters', ok: form.password.length >= 8 },
    { key: 'upper', label: 'One uppercase letter', ok: /[A-Z]/.test(form.password) },
    { key: 'lower', label: 'One lowercase letter', ok: /[a-z]/.test(form.password) },
    { key: 'number', label: 'One number', ok: /[0-9]/.test(form.password) },
    { key: 'special', label: 'One symbol', ok: /[^A-Za-z0-9]/.test(form.password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const strength = !form.password
    ? null
    : passed <= 2
      ? { label: 'Weak', tone: 'var(--error)', pct: 33 }
      : passed <= 4
        ? { label: 'Fair', tone: 'var(--warning)', pct: 66 }
        : { label: 'Strong', tone: 'var(--success)', pct: 100 };

  const passwordInput = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    show: boolean,
    setShow: (v: boolean) => void,
    autoComplete: string,
    placeholder: string,
    error?: string
  ) => (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`w-full h-11 pl-3 pr-12 rounded-sm bg-surface-raised border text-body text-content-primary placeholder:text-content-tertiary outline-none transition-colors duration-150 ${
          error ? 'border-error focus-visible:border-error' : 'border-border-strong focus-visible:border-accent'
        }`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-sm flex items-center justify-center text-content-tertiary hover:text-content-primary transition-colors"
      >
        {show ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display text-content-primary">Create your account</h1>
        <p className="text-body text-content-secondary">
          Already have one?{' '}
          <Link
            href="/auth/login"
            className="text-accent font-semibold underline underline-offset-2 hover:text-accent-hover"
          >
            Sign in
          </Link>
        </p>
      </header>

      {betaBlocked && (
        <Alert tone="info" title="This is a private beta right now">
          Google sign-up needs an invited email address. Register below with the exact address your invite was
          sent to, or use Google again once your access is confirmed.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
          autoComplete="name"
          error={errors.name}
        />

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
          <label htmlFor="reg-password" className="text-body-sm font-medium text-content-secondary">
            Password
          </label>
          {passwordInput(
            'reg-password',
            form.password,
            (v) => setForm((p) => ({ ...p, password: v })),
            showPass,
            setShowPass,
            'new-password',
            'At least 8 characters',
            errors.password
          )}

          {/* Always rendered, never conditionally mounted.
              This block used to appear only once a password had been typed,
              which made the form 90px taller the instant you pressed a key.
              The form column is vertically centred, so that growth re-centred
              everything and the page lurched upward by 45px mid-keystroke —
              it read as the screen zooming, and moved the field out from under
              the cursor. Keeping it mounted holds the height constant, and
              showing the rules before typing is better anyway: you learn the
              requirements up front instead of being corrected afterwards. */}
          <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-surface-sunken overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-200"
                    style={{ width: strength ? `${strength.pct}%` : '0%', background: strength?.tone ?? 'transparent' }}
                  />
                </div>
                {/* Fixed width so the bar does not jiggle as the word changes
                    length between Weak / Fair / Strong. */}
                {/* Non-breaking space when empty: an empty span contributes no
                    line height, so the row would still grow ~12px on the first
                    keystroke once the word appeared. */}
                <span
                  className="text-caption font-medium w-12 text-right shrink-0"
                  style={{ color: strength?.tone ?? 'var(--content-tertiary)' }}
                >
                  {strength?.label ?? ' '}
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                {checks.map((c) => (
                  <li
                    key={c.key}
                    className={`flex items-center gap-1.5 text-caption ${
                      c.ok ? 'text-success' : 'text-content-tertiary'
                    }`}
                  >
                    {c.ok ? (
                      <Check size={12} strokeWidth={2.5} />
                    ) : (
                      <Minus size={12} strokeWidth={2} />
                    )}
                    {c.label}
                  </li>
                ))}
              </ul>
          </div>
          {/* Reserved line so an error appearing does not shift the form either. */}
          <p className="text-caption text-error min-h-4">{errors.password ?? ''}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-confirm" className="text-body-sm font-medium text-content-secondary">
            Confirm password
          </label>
          {passwordInput(
            'reg-confirm',
            form.password_confirmation,
            (v) => setForm((p) => ({ ...p, password_confirmation: v })),
            showConfirm,
            setShowConfirm,
            'new-password',
            'Re-enter your password',
            errors.password_confirmation
          )}
          <p className="text-caption text-error min-h-4">{errors.password_confirmation ?? ''}</p>
        </div>

        {errors.general && <Alert tone="error">{errors.general}</Alert>}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          iconRight={<ArrowRight size={16} strokeWidth={2} />}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-caption text-content-tertiary">
        30 days free, no card required. By creating an account you agree to our{' '}
        <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link> and{' '}
        <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
