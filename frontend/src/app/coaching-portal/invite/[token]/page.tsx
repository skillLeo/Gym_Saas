'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Stethoscope, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/States';
import coachingApi from '@/lib/coachingApi';

interface Preview {
  physician_name: string;
  practice_name: string;
}

export default function CoachingInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    coachingApi.get(`/invite/${params.token}`)
      .then(res => setPreview(res.data))
      .catch(() => setInvalid(true))
      .finally(() => setChecking(false));
  }, [params.token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await coachingApi.post(`/invite/${params.token}/accept`, { email, password });
      localStorage.setItem('physician_token', res.data.token);
      localStorage.setItem('physician_user', JSON.stringify(res.data.physician));
      router.replace('/coaching-portal');
    } catch (err: any) {
      setError(err.response?.data?.message || 'This invite link is invalid or has expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-md bg-accent-surface flex items-center justify-center mb-4">
            <Stethoscope size={26} className="text-accent" />
          </div>
          <h1 className="font-display text-2xl font-bold text-content-primary">Coaching Portal</h1>
        </div>

        {checking ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-accent" /></div>
        ) : invalid ? (
          <Alert tone="error" title="Invite link invalid">
            This invite link is invalid or has expired. Ask the member to have their coach re-approve access.
          </Alert>
        ) : (
          <>
            <p className="text-sm text-content-secondary text-center mb-6">
              Welcome, <strong className="text-content-primary">{preview?.physician_name}</strong>. Create your
              login for <strong className="text-content-primary">{preview?.practice_name}</strong> to access your
              patient&apos;s coaching data.
            </p>

            {error && <Alert tone="error" className="mb-4">{error}</Alert>}

            <form onSubmit={submit} className="space-y-3">
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email" autoComplete="username"
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              />
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Choose a password (min. 8 characters)" autoComplete="new-password"
                className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              />
              <Button type="submit" fullWidth loading={submitting}>Create Account</Button>
            </form>

            <p className="text-xs text-content-tertiary text-center mt-6">This link can only be used once.</p>
          </>
        )}
      </div>
    </div>
  );
}
