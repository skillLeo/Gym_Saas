'use client';
import AppSidebarLayout from '@/components/AppSidebarLayout';

interface DashboardShellProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function DashboardShell({ children, fullWidth = false }: DashboardShellProps) {
  return <AppSidebarLayout fullWidth={fullWidth}>{children}</AppSidebarLayout>;
}
