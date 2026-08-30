import type { IconName } from '@/components/ui/Icon';

export interface NavItem {
  href: string;
  icon: IconName;
  /**
   * English label. Kept as the literal rather than a bare key so this file
   * stays readable and so a missing translation still renders real words.
   */
  label: string;
  /**
   * Translation key (§5.4). When present the shell renders `t(labelKey)`,
   * which falls back to English automatically. Items without one — newer
   * sections not yet translated — simply render `label`.
   */
  labelKey?: string;
  /** Which unread counter, if any, drives this item's badge. */
  badge?: 'messages' | 'notifications' | 'social' | 'combined';
  adminOnly?: boolean;
  /**
   * Personal-tracking features that belong to a member's own body and diet.
   * Hidden from staff: the owner is not a member of his own gym, and a food
   * diary or workout log on his account tracks nobody.
   *
   * Deliberately NOT applied to Community, Friends, Messages, Video Library or
   * Live Classes — a coach genuinely uses those, to post, moderate, answer
   * members and run sessions.
   */
  memberOnly?: boolean;
  /**
   * Where this item points for an administrator, when that differs.
   *
   * "Dashboard" is the case: the member dashboard is nutrition rings and a food
   * log, which an admin does not have. Sending staff to the admin overview means
   * one landing page with real content instead of a card telling them to click
   * somewhere else.
   */
  adminHref?: string;
}

/**
 * Filter a nav list for who is looking at it.
 *
 * Until now the only role rule was `adminOnly`, so staff saw every member
 * feature on top of their own — the owner's sidebar offered him a food journal
 * and a trial to upgrade.
 */
export function navFor(items: NavItem[], isAdmin: boolean): NavItem[] {
  return items
    .filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.memberOnly && isAdmin) return false;
      return true;
    })
    .map((item) => (isAdmin && item.adminHref ? { ...item, href: item.adminHref } : item));
}

/**
 * The five bottom-tab destinations (§2.1). Exactly five — this is the primary
 * navigation on the device almost every member uses.
 *
 * These replace the previous mobile tabs (Home / Social / Calendar / Messages /
 * Profile). Calendar, Messages and Profile move into the More sheet: the app's
 * core daily loop is logging food and workouts, so those get permanent tabs
 * and the rest are one tap away.
 */
export const TAB_ITEMS: NavItem[] = [
  { href: '/dashboard',    icon: 'home',     label: 'Home', labelKey: 'nav.tab.home', adminHref: '/admin' },
  { href: '/food-journal', icon: 'utensils', label: 'Food', labelKey: 'nav.tab.food', memberOnly: true },
  { href: '/fitness',      icon: 'dumbbell', label: 'Fitness', labelKey: 'nav.fitness', memberOnly: true },
  { href: '/social',       icon: 'users',    label: 'Social', labelKey: 'nav.tab.social', badge: 'social' },
];
// The fifth tab is "More", which opens a sheet rather than navigating.

/** Everything reachable from the More sheet, grouped with overline labels. */
export const MORE_GROUPS: { title: string; titleKey: string; items: NavItem[] }[] = [
  {
    title: 'Plan', titleKey: 'nav.group.plan',
    items: [
      { href: '/calendar', icon: 'calendar-days', label: 'Calendar', labelKey: 'nav.calendar', memberOnly: true },
      { href: '/recipes',  icon: 'book-open',     label: 'Recipes', labelKey: 'nav.recipes', memberOnly: true },
    ],
  },
  {
    title: 'Watch', titleKey: 'nav.group.watch',
    items: [
      { href: '/videos', icon: 'video', label: 'Video Library', labelKey: 'nav.videos' },
      { href: '/live',   icon: 'radio', label: 'Live Classes', labelKey: 'nav.live' },
    ],
  },
  {
    title: 'Community', titleKey: 'nav.group.community',
    items: [
      { href: '/vibe-thread',    icon: 'radio',          label: 'Vibe Thread', labelKey: 'nav.vibeThread' },
      { href: '/resources',      icon: 'folder',         label: 'Resources', labelKey: 'nav.resources', adminHref: '/admin/resources' },
      { href: '/social/friends', icon: 'user-check',     label: 'Friends', labelKey: 'nav.friends' },
      { href: '/messages',       icon: 'message-circle', label: 'Messages', labelKey: 'nav.messages', badge: 'messages' },
      { href: '/notifications',  icon: 'bell',           label: 'Notifications', labelKey: 'nav.notifications', badge: 'notifications' },
    ],
  },
  {
    title: 'Account', titleKey: 'nav.group.account',
    items: [
      { href: '/membership', icon: 'credit-card', label: 'Membership', labelKey: 'nav.membership', memberOnly: true },
      { href: '/profile',    icon: 'users',       label: 'Profile', labelKey: 'nav.profile' },
      { href: '/coaching-access', icon: 'stethoscope', label: 'Physician Coaching', labelKey: 'nav.coaching' },
      { href: '/settings',   icon: 'settings',    label: 'Settings', labelKey: 'nav.settings' },
    ],
  },
  {
    title: 'Admin', titleKey: 'nav.group.admin',
    items: [
      // "Admin Panel" used to sit here pointing at /admin. Since staff now land
      // on /admin as their Dashboard, it was the same destination listed twice.
      { href: '/admin/users',         icon: 'users',        label: 'Manage Users',  adminOnly: true },
      { href: '/admin/new-users',     icon: 'user-plus',    label: 'New User Monitoring', adminOnly: true },
      { href: '/admin/revenue',       icon: 'dollar-sign',  label: 'Revenue',       adminOnly: true },
      // These three screens were built but never linked anywhere — not in this
      // menu and not on the admin dashboard. Group approval lives in Moderation,
      // so pending groups could not be approved at all without typing the URL.
      { href: '/admin/moderation',    icon: 'shield',       label: 'Moderation',    adminOnly: true },
      { href: '/admin/stats',         icon: 'chart-bar',    label: 'Statistics',    adminOnly: true },
      { href: '/admin/recipes',       icon: 'book-open',    label: 'Recipe Manager', adminOnly: true },
      { href: '/admin/videos',        icon: 'video',        label: 'Video Library', adminOnly: true },
      { href: '/admin/live',          icon: 'radio',        label: 'Live Manager',  adminOnly: true },
      { href: '/admin/notifications', icon: 'bell',         label: 'Push Notifications', adminOnly: true },
      { href: '/admin/emails',        icon: 'mail',         label: 'Email Campaigns', adminOnly: true },
      { href: '/admin/undercover',    icon: 'eye-off',      label: 'Undercover Accounts', adminOnly: true },
      { href: '/admin/content-flags', icon: 'flag',         label: 'Content Flags', adminOnly: true },
      { href: '/admin/coupon-offers', icon: 'ticket',       label: 'Conversion Offers', adminOnly: true },
      { href: '/admin/vibe-calls',    icon: 'radio',        label: 'Vibe Calls',    adminOnly: true },
      { href: '/admin/beta',          icon: 'key',          label: 'Beta Launch',   adminOnly: true },
      { href: '/admin/coaching',      icon: 'stethoscope',  label: 'Coaching Portal', adminOnly: true },
      { href: '/admin/resources',     icon: 'folder',       label: 'Resources',     adminOnly: true },
      { href: '/admin/api-keys',      icon: 'key',          label: 'API Keys',      adminOnly: true },
    ],
  },
];

/** Desktop sidebar navigation (lg and up). */
export const SIDEBAR_MAIN: NavItem[] = [
  { href: '/dashboard',      icon: 'home',           label: 'Dashboard', labelKey: 'nav.dashboard', adminHref: '/admin' },
  { href: '/food-journal',   icon: 'utensils',       label: 'Food Journal', labelKey: 'nav.food', memberOnly: true },
  { href: '/fitness',        icon: 'dumbbell',       label: 'Fitness', labelKey: 'nav.fitness', memberOnly: true },
  { href: '/videos',         icon: 'video',          label: 'Video Library', labelKey: 'nav.videos' },
  { href: '/resources',      icon: 'folder',         label: 'Resources', labelKey: 'nav.resources', adminHref: '/admin/resources' },
  { href: '/live',           icon: 'radio',          label: 'Live Classes', labelKey: 'nav.live' },
  { href: '/social',         icon: 'users',          label: 'Community', labelKey: 'nav.social', badge: 'social' },
  // Both of these existed only in the mobile More sheet, so on a desktop the
  // pages were reachable by typing the URL and no other way.
  { href: '/vibe-thread',    icon: 'radio',          label: 'Vibe Thread', labelKey: 'nav.vibeThread' },
  { href: '/social/friends', icon: 'user-check',     label: 'Friends', labelKey: 'nav.friends' },
  { href: '/messages',       icon: 'message-circle', label: 'Messages', labelKey: 'nav.messages', badge: 'messages' },
  { href: '/recipes',        icon: 'book-open',      label: 'Recipes', labelKey: 'nav.recipes', memberOnly: true },
  { href: '/calendar',       icon: 'calendar-days',  label: 'Calendar', labelKey: 'nav.calendar', memberOnly: true },
  { href: '/ai-trainer',     icon: 'sparkles',       label: 'AI Trainer', labelKey: 'nav.ai', memberOnly: true },
];

export const SIDEBAR_ACCOUNT: NavItem[] = [
  { href: '/membership', icon: 'credit-card', label: 'Membership', labelKey: 'nav.membership', memberOnly: true },
  { href: '/profile',    icon: 'users',       label: 'Profile', labelKey: 'nav.profile' },
  { href: '/settings',   icon: 'settings',    label: 'Settings', labelKey: 'nav.settings' },
];

export const SIDEBAR_ADMIN: NavItem[] = MORE_GROUPS.find((g) => g.title === 'Admin')!.items;

/**
 * Which section accent applies to a route. Sets [data-section] on the shell so
 * the accent token cascades to every component inside, with no per-page work.
 */
/**
 * Every nav destination in the app, across all three sidebar groups and the
 * mobile tab bar / More sheet.
 */
const ALL_NAV_HREFS: string[] = Array.from(new Set([
  ...SIDEBAR_MAIN.map((i) => i.href),
  ...SIDEBAR_ACCOUNT.map((i) => i.href),
  ...MORE_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
  ...TAB_ITEMS.map((i) => i.href),
]));

/**
 * Which single nav destination should be highlighted for this path?
 *
 * A plain `pathname.startsWith(href)` lights up EVERY ancestor: standing on
 * `/social/friends` matched both `/social` (Community) and `/social/friends`
 * (Friends), so two sidebar items appeared selected at once. It also matched
 * unrelated siblings — `/admin/users` would light up for `/admin/users-export`.
 *
 * This picks the single best destination: an exact match, otherwise the LONGEST
 * href that is a true path-segment prefix. Returns null when nothing matches.
 */
export function activeNavHref(pathname: string): string | null {
  if (!pathname) return null;

  let best: string | null = null;
  for (const href of ALL_NAV_HREFS) {
    // Exact wins immediately.
    if (pathname === href) return href;
    // Otherwise require a segment boundary so `/admin/user` never matches
    // `/admin/users`.
    if (pathname.startsWith(href.endsWith('/') ? href : href + '/')) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

export function sectionForPath(pathname: string): string {
  if (pathname.startsWith('/fitness')) return 'fitness';
  if (pathname.startsWith('/food-journal') || pathname.startsWith('/food-log')) return 'food';
  if (pathname.startsWith('/social') || pathname.startsWith('/messages')) return 'social';
  if (pathname.startsWith('/recipes')) return 'recipes';
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/membership')) return 'membership';
  if (pathname.startsWith('/resources')) return 'resources';
  if (pathname.startsWith('/coaching-access')) return 'coaching';
  // No [data-section="app"] rule exists, so these routes inherit the :root
  // accent (brand orange) rather than borrowing another section's identity.
  return 'app';
}

/**
 * Contextual primary action per section (§2.1). A section with a single
 * relevant action fires it directly; `sheet: true` opens a quick-action sheet.
 */
export interface FabConfig {
  label: string;
  /** Translation key for `label` (§5.4); the literal is the fallback. */
  labelKey: string;
  icon: IconName;
  href?: string;
  sheet?: boolean;
}

export function fabForPath(pathname: string): FabConfig | null {
  if (pathname === '/dashboard') {
    return { label: 'Quick log', labelKey: 'fab.quickLog', icon: 'plus', sheet: true };
  }
  if (pathname.startsWith('/food-journal') || pathname.startsWith('/food-log')) {
    return { label: 'Log food', labelKey: 'fab.logFood', icon: 'plus', href: '/food-journal?add=1' };
  }
  if (pathname === '/fitness' || pathname.startsWith('/fitness/history')) {
    return { label: 'Log workout', labelKey: 'fab.logWorkout', icon: 'plus', href: '/fitness/log-workout' };
  }
  if (pathname === '/social' || pathname === '/social/explore') {
    return { label: 'Create post', labelKey: 'fab.createPost', icon: 'plus', href: '/social?compose=1' };
  }
  if (pathname.startsWith('/calendar')) {
    return { label: 'Add event', labelKey: 'fab.addEvent', icon: 'plus', href: '/calendar?add=1' };
  }
  if (pathname === '/messages') {
    return { label: 'New message', labelKey: 'fab.newMessage', icon: 'plus', href: '/messages?new=1' };
  }
  return null; // hidden everywhere else
}

/** Quick actions shown in the dashboard FAB sheet. */
export const QUICK_ACTIONS: { label: string; labelKey: string; icon: IconName; href: string }[] = [
  { label: 'Log food',    labelKey: 'fab.logFood',    icon: 'utensils',    href: '/food-journal?add=1' },
  { label: 'Log workout', labelKey: 'fab.logWorkout', icon: 'dumbbell',    href: '/fitness/log-workout' },
  { label: 'Log water',   labelKey: 'fab.logWater',   icon: 'glass-water', href: '/food-journal?water=1' },
  { label: 'Log weight',  labelKey: 'fab.logWeight',  icon: 'scale',       href: '/fitness/body-stats?log=1' },
];
