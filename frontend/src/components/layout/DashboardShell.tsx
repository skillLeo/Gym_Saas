'use client';
import AppShell from '@/components/shell/AppShell';

/**
 * Used by 49 pages. Kept as-is by name and props; the implementation is now
 * the single app shell (§2.1).
 *
 * The subscription gate lives in AppShell, not here — three different wrappers
 * funnel into it, so gating at this level would leave the others open.
 */
interface DashboardShellProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function DashboardShell({ children, fullWidth = false }: DashboardShellProps) {
  return <AppShell fullWidth={fullWidth}>{children}</AppShell>;
}
