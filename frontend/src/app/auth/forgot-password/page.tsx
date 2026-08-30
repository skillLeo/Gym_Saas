'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the reset link. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-full bg-success-surface text-success flex items-center justify-center">
          <MailCheck size={26} strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-h1 text-content-primary">Check your inbox</h1>
          <p className="text-body text-content-secondary text-pretty">
            If an account exists for{' '}
            <strong className="text-content-primary">{email}</strong>, a reset link is on its way.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-accent hover:text-accent-hover"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display text-content-primary">Reset password</h1>
        <p className="text-body text-content-secondary">
          Enter your email and we&rsquo;ll send you a link to set a new one.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
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
