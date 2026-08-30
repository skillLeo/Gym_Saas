'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { MailCheck, RefreshCw, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const { user, setUser, logout } = useAuthStore();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (status === 'verified') {
      // refreshStatus below shows the right one-and-only message for
      // whichever case applies — signed in (redirect onward, no toast needed)
      // or not signed in here (redirect to login with a clear explanation).
      refreshStatus(true);
    } else if (status === 'invalid') {
      toast.error('That link is invalid or expired. Request a new one below.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const refreshStatus = async (redirectIfVerified = false) => {
    setChecking(true);
    try {
      const res = await api.get('/auth/user');
      const fresh = res.data.data;
      setUser(fresh);
      if (fresh.email_verified) {
        if (!redirectIfVerified) toast.success('Your email is verified.');
        router.replace(fresh.onboarding_completed ? '/dashboard' : '/auth/onboarding');
      } else {
        toast('Not verified yet. Check your inbox and click the link.');
      }
    } catch (err) {
      // The verification link itself (verifyEmail on the backend) needs no
      // session at all — it's a signed URL, checked and applied before this
      // page even loads. This follow-up call to /auth/user is a *separate*
      // concern: is there still a logged-in session in *this* browser tab.
      // A 401 here just means "not signed in here" (e.g. the link was opened
      // in a different browser than the one you registered in, or the
      // session simply expired) — that's not a failed verification, and
      // "try again in a moment" is actively misleading since retrying can
      // never succeed without a session. Send them to sign in instead.
      if ((err as { response?: { status?: number } })?.response?.status === 401) {
        toast.success('Email verified — please sign in to continue.');
        router.replace('/auth/login');
      } else {
        toast.error('Could not check your verification status. Try again in a moment.');
      }
    } finally {
      setChecking(false);
    }
  };

  /**
   * The resend endpoint sends through a real SMTP server synchronously, so a
   * successful call can legitimately take 8–25 seconds. The button stays in a
   * loading state for the whole round trip rather than pretending it is fast.
   */
  const resend = async () => {
    setResending(true);
    try {
      const res = await api.post('/auth/email/resend');
      toast.success(res.data?.message || 'Verification email sent. Check your inbox.');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not resend right now. Please try again in a moment.');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* best-effort */
    }
    logout();
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.replace('/auth/login');
  };

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="h-14 w-14 rounded-full bg-accent-surface text-accent flex items-center justify-center">
        <MailCheck size={26} strokeWidth={1.75} />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 text-content-primary">Verify your email</h1>
        <p className="text-body text-content-secondary text-pretty">
          We sent a link to{' '}
          <strong className="text-content-primary">{user?.email ?? 'your email address'}</strong>.
          Click it to activate your account.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        <Button
          size="lg"
          fullWidth
          onClick={() => refreshStatus(true)}
          loading={checking}
          icon={!checking ? <RefreshCw size={16} strokeWidth={2} /> : undefined}
        >
          {checking ? 'Checking…' : "I've verified — continue"}
        </Button>
        <Button variant="outline" size="lg" fullWidth onClick={resend} loading={resending}>
          {resending ? 'Sending…' : 'Resend verification email'}
        </Button>
      </div>

      <button
        onClick={handleSignOut}
        className="inline-flex items-center gap-1.5 text-body-sm text-content-secondary hover:text-content-primary transition-colors"
      >
        <LogOut size={14} strokeWidth={1.75} />
        Sign out and use a different account
      </button>

      <p className="text-caption text-content-tertiary">
        Wrong email?{' '}
        <Link href="/auth/register" className="text-accent hover:underline">
          Create a new account
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
