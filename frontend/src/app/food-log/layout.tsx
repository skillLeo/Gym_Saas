'use client';
import AppSidebarLayout from '@/components/AppSidebarLayout';
import { RoleGuard } from '@/components/auth/RoleGuard';

/** Personal food log — members only. See app/food-journal/layout.tsx. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard requires="member">
      <AppSidebarLayout>{children}</AppSidebarLayout>
    </RoleGuard>
  );
}
