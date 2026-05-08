'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { isAuthenticated } from '@/lib/auth';

export function useAuth(requireAuth = true) {
  const { user, token, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (requireAuth && !isAuthenticated()) {
      router.replace('/auth/login');
    }
  }, [requireAuth, router]);

  return { user, token, logout, isAuthenticated: isAuthenticated() };
}
