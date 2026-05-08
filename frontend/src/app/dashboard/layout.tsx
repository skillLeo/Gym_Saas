'use client';
import AppSidebarLayout from '@/components/AppSidebarLayout';
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppSidebarLayout>{children}</AppSidebarLayout>;
}
