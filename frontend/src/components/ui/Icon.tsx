'use client';

import {
  // fitness
  Dumbbell, Activity, HeartPulse, Footprints, Bike, Waves, Mountain, Timer,
  TrendingUp, TrendingDown, Target, Flame, Trophy, Medal, Award, Zap,
  // food
  Utensils, UtensilsCrossed, Apple, Carrot, Beef, Fish, EggFried, Salad,
  Coffee, GlassWater, Droplet, Cookie, Wheat, Milk, Soup,
  // body / health
  Scale, Ruler, Moon, Sun, Bed, Brain, Stethoscope, ClipboardList,
  // social
  Users, UserPlus, UserCheck, UserX, MessageCircle, MessageSquare, Send,
  Heart, ThumbsUp, Share2, AtSign, Hash, Megaphone, Radio,
  // media
  Play, Pause, Video, Film, Image as ImageIcon, Camera, Mic, Headphones,
  // calendar / planning
  Calendar, CalendarDays, CalendarClock, CalendarCheck, Clock, ListTodo,
  ShoppingCart, ShoppingBasket, ClipboardCheck, NotebookPen,
  // documents / resources
  FileText, File, FileDown, Folder, FolderOpen, BookOpen, GraduationCap, Library,
  // commerce
  CreditCard, Receipt, Wallet, Tag, Ticket, BadgePercent, DollarSign, Gift,
  // admin / system
  Settings, SlidersHorizontal, Shield, ShieldCheck, ShieldAlert, Lock, Unlock,
  Key, Database, Server, Gauge, ChartBar, ChartLine, ChartPie, Bell, BellOff,
  Mail, MailOpen, Inbox, Flag, Eye, EyeOff, Search, Filter, RefreshCw,
  // navigation / chrome
  Home, LayoutGrid, Menu, MoreHorizontal, MoreVertical, ChevronRight, ChevronLeft,
  ChevronDown, ChevronUp, ArrowLeft, ArrowRight, ArrowUpRight, X, Plus, Minus,
  Check, ExternalLink, LogOut, LogIn,
  // status
  CircleCheck, CircleAlert, CircleX, Info, TriangleAlert, CircleHelp, Loader,
  Sparkles, Star, Bookmark, Pin, Trash2, Pencil, Copy, Download, Upload,
  type LucideIcon,
} from 'lucide-react';

/**
 * Central icon registry.
 *
 * Icons are referenced by NAME so they can be stored in the database
 * (badges.icon_name, resource_categories.icon_name, fitness_goals.icon_name)
 * and resolved on the client. Emoji are never used as UI (§1.5) — an emoji is
 * only ever content a user typed themselves.
 *
 * To add an icon: import it above and add one line here. Nothing else changes.
 */
export const ICONS = {
  // fitness
  dumbbell: Dumbbell, activity: Activity, 'heart-pulse': HeartPulse,
  footprints: Footprints, bike: Bike, waves: Waves, mountain: Mountain,
  timer: Timer, 'trending-up': TrendingUp, 'trending-down': TrendingDown,
  target: Target, flame: Flame, trophy: Trophy, medal: Medal, award: Award, zap: Zap,
  // food
  utensils: Utensils, 'utensils-crossed': UtensilsCrossed, apple: Apple,
  carrot: Carrot, beef: Beef, fish: Fish, 'egg-fried': EggFried, salad: Salad,
  coffee: Coffee, 'glass-water': GlassWater, droplet: Droplet, cookie: Cookie,
  wheat: Wheat, milk: Milk, soup: Soup,
  // body / health
  scale: Scale, ruler: Ruler, moon: Moon, sun: Sun, bed: Bed, brain: Brain,
  stethoscope: Stethoscope, 'clipboard-list': ClipboardList,
  // social
  users: Users, 'user-plus': UserPlus, 'user-check': UserCheck, 'user-x': UserX,
  'message-circle': MessageCircle, 'message-square': MessageSquare, send: Send,
  heart: Heart, 'thumbs-up': ThumbsUp, share: Share2, 'at-sign': AtSign,
  hash: Hash, megaphone: Megaphone, radio: Radio,
  // media
  play: Play, pause: Pause, video: Video, film: Film, image: ImageIcon,
  camera: Camera, mic: Mic, headphones: Headphones,
  // calendar / planning
  calendar: Calendar, 'calendar-days': CalendarDays, 'calendar-clock': CalendarClock,
  'calendar-check': CalendarCheck, clock: Clock, 'list-todo': ListTodo,
  'shopping-cart': ShoppingCart, 'shopping-basket': ShoppingBasket,
  'clipboard-check': ClipboardCheck, 'notebook-pen': NotebookPen,
  // documents / resources
  'file-text': FileText, file: File, 'file-down': FileDown, folder: Folder,
  'folder-open': FolderOpen, 'book-open': BookOpen, 'graduation-cap': GraduationCap,
  library: Library,
  // commerce
  'credit-card': CreditCard, receipt: Receipt, wallet: Wallet, tag: Tag,
  ticket: Ticket, 'badge-percent': BadgePercent, 'dollar-sign': DollarSign, gift: Gift,
  // admin / system
  settings: Settings, sliders: SlidersHorizontal, shield: Shield,
  'shield-check': ShieldCheck, 'shield-alert': ShieldAlert, lock: Lock,
  unlock: Unlock, key: Key, database: Database, server: Server, gauge: Gauge,
  'chart-bar': ChartBar, 'chart-line': ChartLine, 'chart-pie': ChartPie,
  bell: Bell, 'bell-off': BellOff, mail: Mail, 'mail-open': MailOpen,
  inbox: Inbox, flag: Flag, eye: Eye, 'eye-off': EyeOff, search: Search,
  filter: Filter, refresh: RefreshCw,
  // navigation / chrome
  home: Home, grid: LayoutGrid, menu: Menu, 'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical, 'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft, 'chevron-down': ChevronDown, 'chevron-up': ChevronUp,
  'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'arrow-up-right': ArrowUpRight,
  x: X, plus: Plus, minus: Minus, check: Check, 'external-link': ExternalLink,
  'log-out': LogOut, 'log-in': LogIn,
  // status
  'circle-check': CircleCheck, 'circle-alert': CircleAlert, 'circle-x': CircleX,
  info: Info, 'triangle-alert': TriangleAlert, 'circle-help': CircleHelp,
  loader: Loader, sparkles: Sparkles, star: Star, bookmark: Bookmark, pin: Pin,
  trash: Trash2, pencil: Pencil, copy: Copy, download: Download, upload: Upload,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Standard sizes (§1.5): 16 inline with body, 20 in buttons/nav, 24 section headers. */
const SIZES = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 } as const;

export interface IconProps {
  name: IconName | (string & {});
  size?: keyof typeof SIZES | number;
  className?: string;
  /** Lucide's default stroke of 2 reads heavy at small sizes; 1.75 is our default. */
  strokeWidth?: number;
  'aria-label'?: string;
}

/**
 * Resolves a stored icon-name string to a Lucide component.
 * Unknown names fall back to a neutral placeholder rather than crashing —
 * a bad DB value must never white-screen a page.
 */
export function Icon({
  name,
  size = 'md',
  className,
  strokeWidth = 1.75,
  'aria-label': ariaLabel,
}: IconProps) {
  const Cmp: LucideIcon = (ICONS as Record<string, LucideIcon>)[name] ?? CircleHelp;
  const px = typeof size === 'number' ? size : SIZES[size];
  return (
    <Cmp
      size={px}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      focusable="false"
    />
  );
}

/** True when a name will resolve — use to validate admin-entered icon names. */
export function isValidIconName(name: string): name is IconName {
  return name in ICONS;
}

/** Every registered name. Powers the admin icon picker. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
