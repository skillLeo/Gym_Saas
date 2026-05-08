'use client';
import AppSidebarLayout from '@/components/AppSidebarLayout';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppSidebarLayout>{children}</AppSidebarLayout>;
}
