'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDate, weekdayNames, monthNames } from '@/lib/format';
import { useI18nStore } from '@/store/i18nStore';
import type { Locale } from '@/store/i18nStore';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/lib/api';
import {
  ChevronLeft, ChevronRight, Plus, Utensils, ShoppingCart, CheckSquare,
  X, Clock, CalendarDays, List, Grid3X3, Trash2, Check, BookOpen,
  Flame, Apple, Dumbbell, Calendar, Loader2, Pencil,
} from 'lucide-react';


type ViewType = 'month' | 'week' | 'agenda';
type TabKey   = 'calendar' | 'meal-plan' | 'shopping' | 'todos';

const TYPE_STYLE: Record<string, { bg: string; light: string; label: string; icon: React.ReactNode }> = {
  workout:     { bg: '#FF0404', light: '#FF040415', label: 'Workout',     icon: <Dumbbell size={12} /> },
  meal:        { bg: '#F87404', light: '#F8740415', label: 'Meal',        icon: <Utensils size={12} /> },
  appointment: { bg: '#004AAD', light: '#004AAD15', label: 'Appointment', icon: <Calendar size={12} /> },
  personal:    { bg: '#7C3AED', light: '#7C3AED15', label: 'Personal',    icon: <CalendarDays size={12} /> },
  other:       { bg: '#10B981', light: '#10B98115', label: 'Other',       icon: <CalendarDays size={12} /> },
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

function fmtHour(h: number) {
  if (h === 0 || h === 12) return `${h === 0 ? 12 : h}${h === 0 ? ' AM' : ' PM'}`;
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}
function addDays(base: string, n: number) {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function getWeekStart(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return addDays(dateStr, -d.getDay());
}
/** Module scope, so the locale has to be passed in rather than read here. */
function fmtDate(dateStr: string, locale: Locale) {
  const d = new Date(dateStr + 'T00:00:00');
  return formatDate(d, locale, { weekday: 'short', month: 'short', day: 'numeric' });
}
/**
 * Reads a stored time into 24-hour minutes-past-midnight.
 *
 * Values in the column come in two shapes. New ones are plain 24-hour "HH:MM".
 * Older ones carry a meridiem, and some of those are wrong: the create form used
 * to append " AM" to whatever the time picker produced, so an evening event was
 * saved as "22:03 AM". An hour above 12 therefore wins over the suffix — it is
 * the half of the value that was actually chosen by a human.
 */
function parseTime(time: string | null): { h: number; m: number } | null {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const ap = match[3]?.toUpperCase();
  if (h <= 12 && ap === 'PM' && h !== 12) h += 12;
  else if (h === 12 && ap === 'AM') h = 0;
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** "22:03" and the legacy "22:03 AM" both render as "10:03 PM". */
function fmtEventTime(time: string | null): string | null {
  const parsed = parseTime(time);
  if (!parsed) return time;
  const suffix = parsed.h < 12 ? 'AM' : 'PM';
  const hour12 = parsed.h % 12 === 0 ? 12 : parsed.h % 12;
  return `${hour12}:${String(parsed.m).padStart(2, '0')} ${suffix}`;
}

/** The value an <input type="time"> expects: always 24-hour "HH:MM". */
function toTimeInput(time: string | null): string {
  const parsed = parseTime(time);
  if (!parsed) return '';
  return `${String(parsed.h).padStart(2, '0')}:${String(parsed.m).padStart(2, '0')}`;
}

function eventHour(time: string | null) {
  return parseTime(time)?.h ?? 8;
}

type CalEvent = {
  id:       string;
  raw_id:   number | null;
  title:    string;
  type:     string;
  date:     string;
  time:     string | null;
  end_time: string | null;
  notes:    string | null;
  color?:   string;
  source?:  'manual' | 'fitness' | 'food';
  editable?: boolean;
};

const EVENT_COLOR_OPTIONS = ['#FF0404', '#F87404', '#004AAD', '#7C3AED', '#10B981', '#FFC000', '#DB2777', '#0891B2'];
type ShoppingItem = {
  id:       number;
  name:     string;
  quantity: string | null;
  unit:     string | null;
  category: string | null;
  checked:  boolean;
};
type Todo = {
  id:        number;
  text:      string;
  completed: boolean;
  due_date:  string | null;
  priority:  string;
};
type MealPlan = {
  id:          number;
  recipe_name: string | null;
  day_of_week: number;
  meal_slot:   string;
  notes:       string | null;
};

export default function CalendarPage() {
  // Dates and numbers follow the chosen language, not just the labels.
  const { locale, t } = useI18nStore();
  const DAYS_SHORT = weekdayNames(locale, 'short');
  const DAYS_FULL  = weekdayNames(locale, 'long');
  const MONTHS     = monthNames(locale);
  const TODAY = new Date().toISOString().split('T')[0];

  const [view,         setView]         = useState<ViewType>('month');
  const [tab,          setTab]          = useState<TabKey>('calendar');
  const [viewYear,     setViewYear]     = useState(() => new Date().getFullYear());
  const [viewMonth,    setViewMonth]    = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [events,       setEvents]       = useState<CalEvent[]>([]);
  const [shopping,     setShopping]     = useState<ShoppingItem[]>([]);
  const [todos,        setTodos]        = useState<Todo[]>([]);
  const [mealPlans,    setMealPlans]    = useState<MealPlan[]>([]);
  const [loadingEvents,setLoadingEvents]= useState(true);
  const [showAdd,      setShowAdd]      = useState(false);
  // null = creating, a number = editing that event.
  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [newEvent,     setNewEvent]     = useState({ title: '', date: TODAY, time: '07:00', type: 'workout', notes: '', color: '' });
  const [addedItem,    setAddedItem]    = useState('');
  const [newTodo,      setNewTodo]      = useState('');

  const currentMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const weekStart    = getWeekStart(selectedDate);
  const weekDates    = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Derived
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const eventsFor   = (d: string) => events.filter(e => e.date?.startsWith(d));
  const selectedEvents = eventsFor(selectedDate);
  const agendaDates = Array.from({ length: 21 }, (_, i) => addDays(TODAY, i)).filter(d => eventsFor(d).length > 0);
  const shoppingDone = shopping.filter(s => s.checked).length;
  const doneCount    = todos.filter(t => t.completed).length;

  // Group shopping by category
  const categories = Array.from(new Set(shopping.map(i => i.category ?? 'Other'))).sort();

  // Fetch events when month changes
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await api.get('/calendar/events', { params: { month: currentMonth } });
      setEvents(res.data.events.map((e: CalEvent) => ({
        ...e,
        date: e.date?.split('T')[0] ?? e.date,
      })));
    } finally { setLoadingEvents(false); }
  }, [currentMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Fetch shopping list, todos, meal plans once
  useEffect(() => {
    api.get('/calendar/shopping-list').then(r => setShopping(r.data.items)).catch(() => {});
    api.get('/calendar/todos').then(r => setTodos(r.data.todos)).catch(() => {});
  }, []);

  // Fetch meal plans for current week
  useEffect(() => {
    const ws = getWeekStart(TODAY);
    api.get('/calendar/meal-plans', { params: { week_start: ws } }).then(r => setMealPlans(r.data.meal_plans)).catch(() => {});
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  /** Opens the same dialog in edit mode, pre-filled from an existing event. */
  function startEdit(event: CalEvent) {
    if (!event.editable || !event.raw_id) return;
    setEditingId(event.raw_id);
    setNewEvent({
      title: event.title,
      date:  event.date?.split('T')[0] ?? TODAY,
      // The picker needs 24-hour, whatever shape the stored value is in.
      time:  toTimeInput(event.time),
      type:  event.type,
      notes: event.notes ?? '',
      color: event.color ?? '',
    });
    setShowAdd(true);
  }

  function closeEventDialog() {
    setShowAdd(false);
    setEditingId(null);
    setNewEvent({ title: '', date: TODAY, time: '07:00', type: 'workout', notes: '', color: '' });
  }

  async function saveEvent() {
    if (!newEvent.title.trim()) return;
    const payload = {
      title: newEvent.title,
      type:  newEvent.type,
      date:  newEvent.date,
      // Stored as plain 24-hour. This used to append " AM" unconditionally,
      // which is how an event at 22:03 came to be labelled "22:03 AM".
      time:  newEvent.time || null,
      notes: newEvent.notes || null,
      color: newEvent.color || null,
    };
    try {
      const res = editingId
        ? await api.put(`/calendar/events/${editingId}`, payload)
        : await api.post('/calendar/events', payload);
      const saved = res.data.event;
      const mapped: CalEvent = {
        id: `event-${saved.id}`, raw_id: saved.id, title: saved.title, type: saved.type,
        date: saved.date?.split('T')[0] ?? saved.date, time: saved.time, end_time: saved.end_time,
        notes: saved.notes, color: saved.color || TYPE_STYLE[saved.type]?.bg, source: 'manual', editable: true,
      };
      // Match on the composite id, not raw_id. Ids are only unique within a
      // source, so a manual event and a logged workout can both be 16 — and
      // matching on raw_id alone overwrote the workout with a copy of the
      // event, leaving two rows sharing one React key.
      setEvents(prev => editingId
        ? prev.map(e => (e.id === `event-${editingId}` ? mapped : e))
        : [...prev, mapped]);
      toast.success(editingId ? t('calendar.toast.updated') : t('calendar.toast.added'));
      closeEventDialog();
    } catch { toast.error(editingId ? t('calendar.error.update') : t('calendar.error.add')); }
  }

  async function deleteEvent(event: CalEvent) {
    if (!event.editable || !event.raw_id) return;
    setEvents(prev => prev.filter(e => e.id !== event.id));
    try { await api.delete(`/calendar/events/${event.raw_id}`); } catch { fetchEvents(); }
  }

  async function addShoppingItem() {
    if (!addedItem.trim()) return;
    const name = addedItem.trim();
    setAddedItem('');
    try {
      const res = await api.post('/calendar/shopping-list', { name });
      setShopping(prev => [...prev, res.data.item]);
    } catch { toast.error(t('calendar.error.addItem')); setAddedItem(name); }
  }

  async function toggleShoppingItem(id: number) {
    setShopping(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    try { await api.post(`/calendar/shopping-list/${id}/toggle`); } catch {
      setShopping(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    }
  }

  async function deleteShoppingItem(id: number) {
    setShopping(prev => prev.filter(i => i.id !== id));
    try { await api.delete(`/calendar/shopping-list/${id}`); } catch {
      api.get('/calendar/shopping-list').then(r => setShopping(r.data.items));
    }
  }

  async function addTodo() {
    if (!newTodo.trim()) return;
    const text = newTodo.trim();
    setNewTodo('');
    try {
      const res = await api.post('/calendar/todos', { text });
      setTodos(prev => [res.data.todo, ...prev]);
    } catch { toast.error(t('calendar.error.addTask')); setNewTodo(text); }
  }

  async function toggleTodo(id: number) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try { await api.post(`/calendar/todos/${id}/toggle`); } catch {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    }
  }

  async function deleteTodo(id: number) {
    setTodos(prev => prev.filter(t => t.id !== id));
    try { await api.delete(`/calendar/todos/${id}`); } catch {
      api.get('/calendar/todos').then(r => setTodos(r.data.todos));
    }
  }

  // Map meal plans for weekly view
  const weekMealData = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayPlans = mealPlans.filter(mp => mp.day_of_week === i);
    return {
      date,
      day: DAYS_FULL[i],
      breakfast: dayPlans.find(mp => mp.meal_slot === 'breakfast')?.recipe_name ?? null,
      lunch:     dayPlans.find(mp => mp.meal_slot === 'lunch')?.recipe_name ?? null,
      dinner:    dayPlans.find(mp => mp.meal_slot === 'dinner')?.recipe_name ?? null,
    };
  });

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-5 pb-6">

        <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
        actions={
          <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-4 py-2.5 rounded-md text-sm transition-all">
              <Plus size={16} /> {t('calendar.addEvent')}
            </button>
        }
      />

        {/* Quick nav cards */}
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'meal-plan' as TabKey, icon: Utensils,     label: t('calendar.mealPlan'), color: '#F87404', sub: t('calendar.mealPlan.days') },
            { key: 'shopping'  as TabKey, icon: ShoppingCart, label: t('calendar.shopping'),  color: '#10B981', sub: t('calendar.doneCount', { done: shoppingDone, total: shopping.length }) },
            { key: 'todos'     as TabKey, icon: CheckSquare,  label: t('calendar.todo'),     color: '#004AAD', sub: t('calendar.doneCount', { done: doneCount, total: todos.length }) },
          ] as const).map(({ key, icon: Icon, label, color, sub }) => (
            <button key={key} onClick={() => setTab(cur => cur === key ? 'calendar' : key)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-md border transition-all ${tab === key ? 'border-accent/40 bg-accent/5 shadow-sm' : 'border-border-subtle bg-surface-raised/50 shadow-sm hover:'}`}>
              <Icon size={20} style={{ color }} />
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</span>
              <span className="text-[10px] text-content-tertiary">{sub}</span>
            </button>
          ))}
        </div>

        {/* ══ CALENDAR TAB ══ */}
        {tab === 'calendar' && (
          <>
            {/* View switcher */}
            <div className="flex bg-surface-sunken p-1 rounded-md w-fit">
              {([
                { v: 'month'  as ViewType, icon: Grid3X3,      label: t('calendar.view.month')  },
                { v: 'week'   as ViewType, icon: CalendarDays,  label: t('calendar.view.week')   },
                { v: 'agenda' as ViewType, icon: List,          label: t('calendar.view.agenda') },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button key={v} onClick={() => setView(v)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${view === v ? 'bg-white dark:bg-gray-700 text-content-primary shadow-sm' : 'text-content-secondary'}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {loadingEvents ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-accent" /></div>
            ) : (
              <>
                {/* Month view */}
                {view === 'month' && (
                  <div className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                      <button onClick={prevMonth} className="w-8 h-8 rounded-md flex items-center justify-center text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><ChevronLeft size={18} /></button>
                      <h2 className="font-display font-bold text-content-primary">{MONTHS[viewMonth]} {viewYear}</h2>
                      <button onClick={nextMonth} className="w-8 h-8 rounded-md flex items-center justify-center text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><ChevronRight size={18} /></button>
                    </div>
                    <div className="grid grid-cols-7 border-b border-border-subtle">
                      {DAYS_SHORT.map(d => <div key={d} className="text-center text-[11px] font-semibold text-content-tertiary py-2.5">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7">
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`pad-${i}`} className="border-r border-b border-gray-50 h-24" />)}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day     = i + 1;
                        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday    = dateStr === TODAY;
                        const isSelected = dateStr === selectedDate;
                        const dayEvents  = eventsFor(dateStr);
                        return (
                          <button key={day} onClick={() => setSelectedDate(dateStr)}
                            className={`relative border-r border-b border-gray-50 dark:border-white/5 h-24 flex flex-col p-1.5 transition-all hover:bg-gray-50 dark:hover:bg-white/5 text-left ${isSelected ? 'bg-accent/5 ring-2 ring-inset ring-accent/40' : ''}`}>
                            <span className={`text-[13px] font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-accent text-white' : isSelected ? 'text-accent' : 'text-content-secondary'}`}>{day}</span>
                            <div className="space-y-0.5 overflow-hidden">
                              {dayEvents.slice(0, 2).map(e => {
                                const c = e.color || TYPE_STYLE[e.type]?.bg;
                                return (
                                  <div key={e.id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] leading-tight font-medium truncate"
                                    style={{ backgroundColor: c + '15', color: c }}>
                                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                                    <span className="truncate">{e.title}</span>
                                  </div>
                                );
                              })}
                              {dayEvents.length > 2 && <div className="text-[9px] leading-tight text-content-tertiary px-1">+{dayEvents.length - 2} more</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Week view */}
                {view === 'week' && (
                  <div className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
                    <div className="grid grid-cols-8 border-b border-border-subtle">
                      <div className="py-3 text-center text-[11px] text-content-tertiary font-medium">Time</div>
                      {weekDates.map(d => {
                        const date    = new Date(d + 'T00:00:00');
                        const isToday = d === TODAY;
                        return (
                          <div key={d} className="py-3 text-center">
                            <div className="text-[10px] font-semibold text-content-tertiary uppercase">{DAYS_SHORT[date.getDay()]}</div>
                            <div className={`text-lg font-bold mx-auto w-9 h-9 flex items-center justify-center rounded-full mt-0.5 ${isToday ? 'bg-accent text-white' : 'text-gray-800 dark:text-gray-200'}`}>{date.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="overflow-y-auto max-h-[520px]">
                      {HOURS.map(hour => (
                        <div key={hour} className="grid grid-cols-8 border-b border-gray-50 dark:border-white/5 min-h-[56px]">
                          <div className="px-3 pt-2 text-[10px] font-medium text-content-tertiary text-right whitespace-nowrap">{fmtHour(hour)}</div>
                          {weekDates.map(d => {
                            const slotEvents = eventsFor(d).filter(e => eventHour(e.time) === hour);
                            return (
                              <div key={d} className="border-l border-gray-50 dark:border-white/5 p-0.5 relative">
                                {slotEvents.map(e => {
                                  const c = e.color || TYPE_STYLE[e.type]?.bg;
                                  return (
                                    <div key={e.id} className="rounded-lg px-1.5 py-1 mb-0.5 text-[10px] font-semibold leading-tight"
                                      style={{ backgroundColor: c + '15', color: c, borderLeft: `3px solid ${c}` }}>
                                      <div className="truncate">{e.title}</div>
                                      {e.time && <div className="font-normal opacity-70">{fmtEventTime(e.time)}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agenda view */}
                {view === 'agenda' && (
                  <div className="space-y-3">
                    {agendaDates.length === 0 ? (
                      <div className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm p-12 text-center">
                        <CalendarDays size={40} className="mx-auto text-gray-200 dark:text-content-secondary mb-3" />
                        <p className="text-sm text-content-secondary">{t('calendar.noUpcoming')}</p>
                      </div>
                    ) : agendaDates.map(d => {
                      const isToday = d === TODAY;
                      const dayEvents = eventsFor(d);
                      return (
                        <div key={d} className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
                          <div className={`px-5 py-3 flex items-center gap-3 ${isToday ? 'bg-accent/5 border-b border-accent/15' : 'border-b border-gray-50 dark:border-white/5'}`}>
                            <div className={`w-10 h-10 rounded-md flex items-center justify-center font-display font-black text-lg ${isToday ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary dark:text-gray-200'}`}>
                              {new Date(d + 'T00:00:00').getDate()}
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${isToday ? 'text-accent' : 'text-content-primary'}`}>
                                {isToday ? t('calendar.today') : fmtDate(d, locale)}
                              </p>
                              <p className="text-[11px] text-content-tertiary">{dayEvents.length === 1 ? t('calendar.eventCountOne') : t('calendar.eventCount', { count: dayEvents.length })}</p>
                            </div>
                          </div>
                          <div className="divide-y divide-gray-50 dark:divide-white/5">
                            {dayEvents.map(event => {
                              const c = event.color || TYPE_STYLE[event.type]?.bg;
                              return (
                                <div key={event.id} className="flex items-center gap-4 px-5 py-3.5">
                                  <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c + '15' }}>
                                    <span style={{ color: c }}>{TYPE_STYLE[event.type]?.icon}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-content-primary truncate">{event.title}</p>
                                    <p className="text-xs text-content-tertiary flex items-center gap-1 mt-0.5">
                                      <Clock size={11} /> {fmtEventTime(event.time) ?? 'All day'}
                                      <span className="ml-1.5 capitalize px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: c + '15', color: c }}>
                                        {TYPE_STYLE[event.type]?.label}
                                      </span>
                                    </p>
                                  </div>
                                  {event.editable && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button onClick={() => startEdit(event)} aria-label={`Edit ${event.title}`}
                                      className="w-7 h-7 rounded-lg text-content-tertiary hover:text-accent hover:bg-accent-surface flex items-center justify-center transition-colors">
                                      <Pencil size={13} />
                                    </button>
                                    <button onClick={() => deleteEvent(event)}
                                      className="w-7 h-7 rounded-lg text-content-tertiary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">
                                      <Trash2 size={13} />
                                    </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected date detail (month view) */}
                {view === 'month' && (
                  <div className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                      <div>
                        <h3 className="font-semibold text-sm text-content-primary">
                          {selectedDate === TODAY ? t('calendar.today') : fmtDate(selectedDate, locale)}
                        </h3>
                        <p className="text-xs text-content-tertiary mt-0.5">{selectedEvents.length === 1 ? t('calendar.eventCountOne') : t('calendar.eventCount', { count: selectedEvents.length })}</p>
                      </div>
                      <button onClick={() => { setNewEvent(e => ({ ...e, date: selectedDate })); setShowAdd(true); }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:bg-accent-surface px-3 py-1.5 rounded-lg transition-colors">
                        <Plus size={13} /> {t('calendar.add')}
                      </button>
                    </div>
                    {selectedEvents.length > 0 ? (
                      <div className="divide-y divide-gray-50 dark:divide-white/5">
                        {selectedEvents.map(event => {
                          const c = event.color || TYPE_STYLE[event.type]?.bg;
                          return (
                            <div key={event.id} className="flex items-center gap-4 px-5 py-3.5">
                              <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c + '15' }}>
                                <span style={{ color: c }}>{TYPE_STYLE[event.type]?.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-content-primary">{event.title}</p>
                                <p className="text-xs text-content-tertiary flex items-center gap-1 mt-0.5"><Clock size={11} /> {fmtEventTime(event.time) ?? 'All day'}</p>
                                {event.notes && <p className="text-xs text-content-secondary mt-0.5 truncate">{event.notes}</p>}
                              </div>
                              <div className="flex items-center gap-1">
                                {/* A colour pill used to sit here. It repeated
                                    what the tinted icon on the left of the row
                                    already says, and parked next to the edit and
                                    delete icons it read as a control that did
                                    nothing when clicked. */}
                                {event.editable && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => startEdit(event)} aria-label={`Edit ${event.title}`}
                                    className="w-7 h-7 rounded-lg text-content-tertiary hover:text-accent hover:bg-accent-surface flex items-center justify-center transition-colors">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteEvent(event)}
                                    className="w-7 h-7 rounded-lg text-content-tertiary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-10 text-center text-sm text-content-tertiary">
                        {t('calendar.noEventsAdd')} <button onClick={() => setShowAdd(true)} className="text-accent font-semibold">{t('calendar.addOne')}</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ MEAL PLAN TAB ══ */}
        {tab === 'meal-plan' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-content-primary">{t('calendar.mealPlan.weekly')}</h2>
              <div className="flex items-center gap-3">
                <Link href="/calendar/meal-planner" className="text-xs font-semibold text-accent flex items-center gap-1 hover:underline">
                  <Grid3X3 size={13} /> {t('calendar.fullPlanner')}
                </Link>
                <Link href="/recipes" className="text-xs font-semibold text-accent flex items-center gap-1 hover:underline">
                  <BookOpen size={13} /> {t('calendar.browseRecipes')}
                </Link>
              </div>
            </div>
            {weekMealData.map(day => (
              <div key={day.date} className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center font-display font-black text-sm ${day.date === TODAY ? 'bg-accent text-white' : 'bg-surface-sunken text-content-secondary'}`}>
                      {new Date(day.date + 'T00:00:00').getDate()}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${day.date === TODAY ? 'text-accent' : 'text-content-primary'}`}>
                        {day.date === TODAY ? t('calendar.today') : day.day}
                      </p>
                    </div>
                  </div>
                  <Flame size={16} className="text-accent" />
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-50 dark:divide-white/5">
                  {[
                    { label: 'Breakfast', icon: Apple,    meal: day.breakfast, color: '#F87404' },
                    { label: 'Lunch',     icon: Utensils, meal: day.lunch,     color: '#004AAD' },
                    { label: 'Dinner',    icon: Utensils, meal: day.dinner,    color: '#7C3AED' },
                  ].map(({ label, icon: Icon, meal, color }) => (
                    <div key={label} className="p-3">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Icon size={11} style={{ color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
                      </div>
                      {meal ? (
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">{meal}</p>
                      ) : (
                        <Link href="/recipes" className="text-[10px] text-content-tertiary hover:text-accent transition-colors">{t('calendar.addFromRecipes')}</Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ SHOPPING TAB ══ */}
        {tab === 'shopping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-content-primary">{t('calendar.shopping.list')}</h2>
              <div className="flex items-center gap-3">
              {/* /calendar/shopping-list is a complete screen — priorities, due dates,
                  categories — that nothing in the app linked to, so it could only
                  be reached by typing the address. Same class of gap as the
                  unreachable admin screens found in Phase 3. */}
              <Link href="/calendar/shopping-list" className="text-xs font-semibold text-accent flex items-center gap-1 hover:underline">
                <ShoppingCart size={13} /> {t('calendar.fullList')}
              </Link>
                <span className="text-xs text-content-tertiary bg-surface-sunken px-3 py-1 rounded-full font-medium">
                  {shoppingDone}/{shopping.length} checked
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={addedItem} onChange={e => setAddedItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addShoppingItem()}
                placeholder={t('calendar.shopping.add')}
                className="flex-1 border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent bg-surface-raised" />
              <button onClick={addShoppingItem} className="px-4 py-2.5 bg-accent text-white rounded-md text-sm font-semibold hover:bg-accent-hover transition-colors">{t('calendar.add')}</button>
            </div>

            {shopping.length === 0 ? (
              <div className="text-center py-10 text-content-tertiary text-sm">{t('calendar.shopping.empty')}</div>
            ) : (
              categories.map(cat => {
                const items = shopping.filter(i => (i.category ?? 'Other') === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-50 dark:border-white/5 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-content-secondary">{cat}</h3>
                      <span className="text-[10px] text-content-tertiary">{items.filter(i => i.checked).length}/{items.length}</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-white/5">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <button onClick={() => toggleShoppingItem(item.id)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${item.checked ? 'bg-[#10B981] border-[#10B981]' : 'border-gray-300 dark:border-gray-600'}`}>
                            {item.checked && <Check size={11} className="text-white" />}
                          </button>
                          <span className={`flex-1 text-sm ${item.checked ? 'line-through text-content-tertiary' : 'text-gray-800 dark:text-gray-200'}`}>{item.name}</span>
                          {item.quantity && <span className="text-xs text-content-tertiary">{item.quantity} {item.unit}</span>}
                          <button onClick={() => deleteShoppingItem(item.id)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-content-tertiary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══ TODOS TAB ══ */}
        {tab === 'todos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-content-primary">{t('calendar.todo.list')}</h2>
              <div className="flex items-center gap-3">
              {/* /calendar/todo is a complete screen — priorities, due dates,
                  categories — that nothing in the app linked to, so it could only
                  be reached by typing the address. Same class of gap as the
                  unreachable admin screens found in Phase 3. */}
              <Link href="/calendar/todo" className="text-xs font-semibold text-accent flex items-center gap-1 hover:underline">
                <CheckSquare size={13} /> Priority &amp; due dates
              </Link>
                <span className="text-xs text-content-tertiary bg-surface-sunken px-3 py-1 rounded-full font-medium">
                  {doneCount}/{todos.length} complete
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTodo()}
                placeholder={t('calendar.todo.add')}
                className="flex-1 border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent bg-surface-raised" />
              <button onClick={addTodo} className="px-4 py-2.5 bg-[#004AAD] text-white rounded-md text-sm font-semibold hover:bg-[#003899] transition-colors">{t('calendar.add')}</button>
            </div>

            {todos.length === 0 ? (
              <div className="text-center py-10 text-content-tertiary text-sm">{t('calendar.todo.empty')}</div>
            ) : (
              (['high', 'medium', 'low'] as const).map(priority => {
                // Anything without a recognised priority is treated as medium.
                // Grouping on an exact match meant a task whose priority was
                // missing belonged to no group and simply never appeared — a
                // silent disappearance is far worse than being filed under the
                // wrong heading.
                const group = todos.filter(t =>
                  (['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium') === priority
                );
                if (group.length === 0) return null;
                const colors = { high: 'text-red-600 bg-red-50', medium: 'text-accent bg-orange-50', low: 'text-content-secondary bg-gray-100' };
                return (
                  <div key={priority} className="bg-surface-raised/50 rounded-md border border-border-subtle shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-50 dark:border-white/5">
                      <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${colors[priority]}`}>{priority} priority</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-white/5">
                      {group.map(todo => (
                        <div key={todo.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <button onClick={() => toggleTodo(todo.id)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${todo.completed ? 'bg-accent border-accent' : 'border-gray-300 dark:border-gray-600'}`}>
                            {todo.completed && <Check size={11} className="text-white" />}
                          </button>
                          <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-content-tertiary' : 'text-gray-800 dark:text-gray-200'}`}>{todo.text}</span>
                          <button onClick={() => deleteTodo(todo.id)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-content-tertiary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* {t('calendar.addEvent')} Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEventDialog} />
          <div className="relative bg-surface-raised rounded-md w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-content-primary text-lg">{editingId ? t('calendar.editEvent') : t('calendar.addEvent')}</h2>
              <button onClick={closeEventDialog} className="w-8 h-8 rounded-md flex items-center justify-center text-content-tertiary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input value={newEvent.title} onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))}
                placeholder="Event title *" className="w-full border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent bg-white dark:bg-gray-700" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-content-secondary block mb-1">Date</label>
                  <input type="date" value={newEvent.date} onChange={e => setNewEvent(v => ({ ...v, date: e.target.value }))}
                    className="w-full border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary outline-none focus-visible:border-accent bg-white dark:bg-gray-700" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-content-secondary block mb-1">Time</label>
                  <input type="time" value={newEvent.time} onChange={e => setNewEvent(v => ({ ...v, time: e.target.value }))}
                    className="w-full border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary outline-none focus-visible:border-accent bg-white dark:bg-gray-700" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-content-secondary block mb-1">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_STYLE).map(([key, style]) => (
                    <button key={key} onClick={() => setNewEvent(v => ({ ...v, type: key }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all ${newEvent.type === key ? 'border-accent/40' : 'border-border-strong'}`}
                      style={newEvent.type === key ? { backgroundColor: style.light, color: style.bg } : {}}>
                      {style.icon} {style.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-content-secondary block mb-1.5">Color (optional — defaults to type color)</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLOR_OPTIONS.map(c => (
                    <button key={c} type="button" onClick={() => setNewEvent(v => ({ ...v, color: v.color === c ? '' : c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${newEvent.color === c ? 'scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c, borderColor: newEvent.color === c ? c : 'transparent' }} />
                  ))}
                </div>
              </div>
              <textarea value={newEvent.notes} onChange={e => setNewEvent(v => ({ ...v, notes: e.target.value }))}
                placeholder="Notes (optional)" rows={2}
                className="w-full border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent resize-none bg-white dark:bg-gray-700" />
              <button onClick={saveEvent}
                className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-md text-sm transition-all">
                {t('calendar.saveEvent')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
