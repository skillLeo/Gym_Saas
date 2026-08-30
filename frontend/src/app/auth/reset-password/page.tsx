'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [form, setForm] = useState({ password: '', password_confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Field-level errors, not a toast — the message belongs next to the input.
    if (form.password.length < 8) return setErrors({ password: 'Use at least 8 characters.' });
    if (form.password !== form.password_confirmation)
      return setErrors({ password_confirmation: 'Passwords do not match.' });

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        email,
        password: form.password,
        password_confirmation: form.password_confirmation,
      });
      toast.success('Password updated. You can sign in now.');
      router.replace('/auth/login');
    } catch (err) {
      setErrors({
        general: getErrorMessage(err, 'Could not reset your password. The link may have expired.'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display text-content-primary">Set a new password</h1>
        <p className="text-body text-content-secondary">Choose a password you don&rsquo;t use elsewhere.</p>
      </header>

      {!token && (
        <Alert tone="error" title="This reset link is not valid">
          It may have expired or already been used.{' '}
          <Link href="/auth/forgot-password" className="underline font-medium">
            Request a new one
          </Link>
          .
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          required
          autoComplete="new-password"
          error={errors.password}
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="Re-enter your password"
          value={form.password_confirmation}
          onChange={(e) => setForm((p) => ({ ...p, password_confirmation: e.target.value }))}
          required
          autoComplete="new-password"
          error={errors.password_confirmation}
        />
        {errors.general && <Alert tone="error">{errors.general}</Alert>}
        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!token}>
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      <Link
        href="/auth/login"
        className="inline-flex items-center justify-center gap-1.5 text-body-sm text-content-secondary hover:text-content-primary"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to sign in
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
