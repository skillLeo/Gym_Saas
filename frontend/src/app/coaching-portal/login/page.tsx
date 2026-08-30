'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/States';
import coachingApi from '@/lib/coachingApi';

export default function CoachingPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await coachingApi.post('/login', { email, password });
      localStorage.setItem('physician_token', res.data.token);
      localStorage.setItem('physician_user', JSON.stringify(res.data.physician));
      router.replace('/coaching-portal');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
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
          <p className="text-sm text-content-tertiary text-center mt-1">Physician sign-in — separate from the member app</p>
        </div>

        {error && <Alert tone="error" className="mb-4">{error}</Alert>}

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" autoComplete="username"
            className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" autoComplete="current-password"
            className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <Button type="submit" fullWidth loading={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : undefined}>
            Sign In
          </Button>
        </form>

        <p className="text-xs text-content-tertiary text-center mt-6">
          Access is by invitation only, sent by the practice&apos;s member after their coach approves a request.
        </p>
      </div>
    </div>
  );
}
