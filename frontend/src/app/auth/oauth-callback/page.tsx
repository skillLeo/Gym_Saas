'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, TriangleAlert } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const oauthError = searchParams.get('oauth_error');

    if (oauthError || !token) {
      setError(true);
      toast.error('Google sign-in did not complete. Try again, or use email and password.');
      setTimeout(() => router.replace('/auth/login'), 1500);
      return;
    }

    localStorage.setItem('auth_token', token);
    api
      .get('/auth/user')
      .then((res) => {
        const user = res.data.data;
        setAuth(user, token);
        document.cookie = `auth_token=${token}; path=/; max-age=2592000`;
        toast.success(`Welcome, ${user.name}`);
        if (!user.email_verified) {
          router.replace('/auth/verify-email');
        } else if (!user.onboarding_completed) {
          router.replace('/auth/onboarding');
        } else {
          router.replace(user.is_admin ? '/admin' : '/dashboard');
        }
      })
      .catch(() => {
        setError(true);
        toast.error('Could not finish signing you in. Please try again.');
        setTimeout(() => router.replace('/auth/login'), 1500);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      {error ? (
        <>
          <div className="h-12 w-12 rounded-full bg-error-surface text-error flex items-center justify-center">
            <TriangleAlert size={24} strokeWidth={1.75} />
          </div>
          <p className="text-body text-content-secondary">Taking you back to sign in…</p>
        </>
      ) : (
        <>
          <Loader2 size={28} strokeWidth={2} className="text-accent animate-spin" />
          <p className="text-body text-content-secondary">Finishing sign-in with Google…</p>
        </>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallbackContent />
    </Suspense>
  );
}
