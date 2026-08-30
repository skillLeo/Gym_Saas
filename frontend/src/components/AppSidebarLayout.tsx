'use client';
import AppShell from '@/components/shell/AppShell';

/**
 * Delegates to the single app shell (§2.1).
 *
 * The previous 593-line implementation carried its own sidebar, top bar,
 * mobile nav and profile dropdown, all styled with hardcoded hexes. That is
 * now one shell in `components/shell/`, so mobile and desktop chrome cannot
 * drift apart again.
 *
 * This file is kept as a thin wrapper because 6 layout files import it by
 * default export. The props are unchanged.
 */
interface Props {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function AppSidebarLayout({ children, fullWidth = false }: Props) {
  return <AppShell fullWidth={fullWidth}>{children}</AppShell>;
}
