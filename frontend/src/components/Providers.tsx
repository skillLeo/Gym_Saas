'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
  }));
  // UserProvider was removed here: it supplied a hardcoded "Kelvin Silas"
  // profile (fake avatar, 342 followers, 128 following, 87 friends, invented
  // weight and age) left over from the mock phase. Its only consumer was a dev
  // RoleSwitcher that was not rendered anywhere, so the fabricated numbers were
  // dead weight shipping in every bundle. Real identity comes from useAuthStore.
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/* Mounted app-wide so any screen can raise a themed confirm/prompt
            instead of a native browser dialog. */}
        <ConfirmDialogProvider>
          {children}
        </ConfirmDialogProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
