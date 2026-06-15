'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { mockCalendarEvents, mockMealPlanWeek, mockShoppingListItems, mockTodoItems } from '@/lib/mockData';
import {
  ChevronLeft, ChevronRight, Plus, Utensils, ShoppingCart, CheckSquare,
  X, Clock, CalendarDays, List, Grid3X3, Trash2, Check, BookOpen,
  Flame, Apple, Dumbbell, Calendar,
} from 'lucide-react';

// ── Fixed reference – avoids hydration mismatch ──
const TODAY = '2026-06-14';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

type ViewType = 'month' | 'week' | 'agenda';
type TabKey   = 'calendar' | 'meal-plan' | 'shopping' | 'todos';

const TYPE_STYLE: Record<string, { bg: string; light: string; label: string; icon: React.ReactNode }> = {
  workout:     { bg: '#FF0404', light: '#FF040415', label: 'Workout',     icon: <Dumbbell size={12} /> },
  meal:        { bg: '#F87404', light: '#F8740415', label: 'Meal',        icon: <Utensils size={12} /> },
  appointment: { bg: '#004AAD', light: '#004AAD15', label: 'Appointment', icon: <Calendar size={12} /> },
  personal:    { bg: '#7C3AED', light: '#7C3AED15', label: 'Personal',    icon: <CalendarDays size={12} /> },
  other:       { bg: '#10B981', light: '#10B98115', label: 'Other',       icon: <CalendarDays size={12} /> },
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM – 9 PM

function fmtHour(h: number) {
  if (h === 0 || h === 12) return `${h === 0 ? 12 : h}${h === 0 ? ' AM' : ' PM'}`;
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function eventHour(time: string) {
  const [t, ap] = time.split(' ');
  const [h] = t.split(':').map(Number);
  return ap === 'PM' && h !== 12 ? h + 12 : h === 12 && ap === 'AM' ? 0 : h;
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

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CalendarPage() {
  const [view,         setView]         = useState<ViewType>('month');
  const [tab,          setTab]          = useState<TabKey>('calendar');
  const [viewYear,     setViewYear]     = useState(2026);
  const [viewMonth,    setViewMonth]    = useState(5); // 0-indexed, 5 = June
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [shopping,     setShopping]     = useState(mockShoppingListItems);
  const [todos,        setTodos]        = useState(mockTodoItems);
  const [showAdd,      setShowAdd]      = useState(false);
  const [events,       setEvents]       = useState(mockCalendarEvents);
  const [newEvent,     setNewEvent]     = useState({ title: '', date: TODAY, time: '07:00', type: 'workout', notes: '' });
  const [addedItem,    setAddedItem]    = useState('');
  const [newTodo,      setNewTodo]      = useState('');

  // ── Derived ──
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const weekStart   = getWeekStart(selectedDate);
  const weekDates   = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsFor = (d: string) => events.filter(e => e.date === d);
  const selectedEvents = eventsFor(selectedDate);

  const agendaDates = Array.from({ length: 21 }, (_, i) => addDays(TODAY, i))
    .filter(d => eventsFor(d).length > 0);

  const totalMealCal = (day: typeof mockMealPlanWeek[0]) =>
    (day.breakfast?.cal ?? 0) + (day.lunch?.cal ?? 0) + (day.dinner?.cal ?? 0);

  const shoppingByCategory = (['Produce', 'Meat', 'Dairy', 'Pantry'] as const).map(cat => ({
    cat,
    items: shopping.filter(i => i.category === cat),
  }));

  const doneCount  = todos.filter(t => t.done).length;
  const shoppingDone = shopping.filter(s => s.checked).length;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function addEvent() {
    if (!newEvent.title.trim()) return;
    setEvents(prev => [...prev, { id: `e-${Date.now()}`, ...newEvent, time: newEvent.time + ' AM' }]);
    setNewEvent({ title: '', date: TODAY, time: '07:00', type: 'workout', notes: '' });
    setShowAdd(false);
  }

  function addShoppingItem() {
    if (!addedItem.trim()) return;
    setShopping(prev => [...prev, { id: `s-${Date.now()}`, name: addedItem.trim(), amount: '', category: 'Pantry', checked: false }]);
    setAddedItem('');
  }

  function addTodo() {
    if (!newTodo.trim()) return;
    setTodos(prev => [...prev, { id: `t-${Date.now()}`, text: newTodo.trim(), done: false, priority: 'medium', dueDate: TODAY }]);
    setNewTodo('');
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-5 pb-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white">Calendar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Plan workouts, meals &amp; life</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#F87404] hover:bg-[#e06000] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-[#F87404]/25">
            <Plus size={16} /> Add Event
          </button>
        </div>

        {/* ── Quick nav cards ── */}
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'meal-plan' as TabKey, icon: Utensils,     label: 'Meal Plan',  color: '#F87404', sub: '7-day plan' },
            { key: 'shopping'  as TabKey, icon: ShoppingCart, label: 'Shopping',   color: '#10B981', sub: `${shoppingDone}/${shopping.length} done` },
            { key: 'todos'     as TabKey, icon: CheckSquare,  label: 'To-Do',      color: '#004AAD', sub: `${doneCount}/${todos.length} done` },
          ] as const).map(({ key, icon: Icon, label, color, sub }) => (
            <button key={key} onClick={() => setTab(t => t === key ? 'calendar' : key)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all ${tab === key ? 'border-[#F87404]/40 bg-[#F87404]/5 shadow-sm' : 'border-gray-100 dark:border-white/10 bg-white dark:bg-gray-800/50 shadow-sm hover:shadow-md'}`}>
              <Icon size={20} style={{ color }} />
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════════ CALENDAR TAB ══════════════════════ */}
        {tab === 'calendar' && (
          <>
            {/* View switcher */}
            <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl w-fit">
              {([
                { v: 'month'  as ViewType, icon: Grid3X3,     label: 'Month'  },
                { v: 'week'   as ViewType, icon: CalendarDays, label: 'Week'   },
                { v: 'agenda' as ViewType, icon: List,         label: 'Agenda' },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button key={v} onClick={() => setView(v)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${view === v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* ── MONTH VIEW ── */}
            {view === 'month' && (
              <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                {/* Month nav */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
                  <button onClick={prevMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <ChevronLeft size={18} />
                  </button>
                  <h2 className="font-display font-bold text-gray-900 dark:text-white">{MONTHS[viewMonth]} {viewYear}</h2>
                  <button onClick={nextMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-gray-100 dark:border-white/10">
                  {DAYS_SHORT.map(d => (
                    <div key={d} className="text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500 py-2.5">{d}</div>
                  ))}
                </div>
                {/* Days grid */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`pad-${i}`} className="border-r border-b border-gray-50 h-20" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday    = dateStr === TODAY;
                    const isSelected = dateStr === selectedDate;
                    const dayEvents  = eventsFor(dateStr);
                    return (
                      <button key={day} onClick={() => setSelectedDate(dateStr)}
                        className={`relative border-r border-b border-gray-50 dark:border-white/5 h-20 flex flex-col p-1.5 transition-all hover:bg-gray-50 dark:hover:bg-white/5 text-left ${isSelected ? 'bg-[#F87404]/5 ring-2 ring-inset ring-[#F87404]/40' : ''}`}>
                        <span className={`text-[13px] font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-[#F87404] text-white' : isSelected ? 'text-[#F87404]' : 'text-gray-700 dark:text-gray-300'}`}>
                          {day}
                        </span>
                        <div className="space-y-0.5 overflow-hidden">
                          {dayEvents.slice(0, 2).map(e => (
                            <div key={e.id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate"
                              style={{ backgroundColor: TYPE_STYLE[e.type]?.light, color: TYPE_STYLE[e.type]?.bg }}>
                              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_STYLE[e.type]?.bg }} />
                              <span className="truncate">{e.title}</span>
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[9px] text-gray-400 px-1">+{dayEvents.length - 2} more</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── WEEK VIEW ── */}
            {view === 'week' && (
              <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                {/* Week header */}
                <div className="grid grid-cols-8 border-b border-gray-100 dark:border-white/10">
                  <div className="py-3 text-center text-[11px] text-gray-300 font-medium">Time</div>
                  {weekDates.map(d => {
                    const date = new Date(d + 'T00:00:00');
                    const isToday = d === TODAY;
                    return (
                      <div key={d} className="py-3 text-center">
                        <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">{DAYS_SHORT[date.getDay()]}</div>
                        <div className={`text-lg font-bold mx-auto w-9 h-9 flex items-center justify-center rounded-full mt-0.5 ${isToday ? 'bg-[#F87404] text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                          {date.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Time slots */}
                <div className="overflow-y-auto max-h-[520px]">
                  {HOURS.map(hour => (
                    <div key={hour} className="grid grid-cols-8 border-b border-gray-50 dark:border-white/5 min-h-[56px]">
                      <div className="px-3 pt-2 text-[10px] font-medium text-gray-400 dark:text-gray-500 text-right whitespace-nowrap">{fmtHour(hour)}</div>
                      {weekDates.map(d => {
                        const slotEvents = eventsFor(d).filter(e => eventHour(e.time) === hour);
                        return (
                          <div key={d} className="border-l border-gray-50 dark:border-white/5 p-0.5 relative">
                            {slotEvents.map(e => (
                              <div key={e.id} className="rounded-lg px-1.5 py-1 mb-0.5 text-[10px] font-semibold leading-tight"
                                style={{ backgroundColor: TYPE_STYLE[e.type]?.light, color: TYPE_STYLE[e.type]?.bg, borderLeft: `3px solid ${TYPE_STYLE[e.type]?.bg}` }}>
                                {e.title}
                                <div className="font-normal opacity-70">{e.time}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── AGENDA VIEW ── */}
            {view === 'agenda' && (
              <div className="space-y-3">
                {agendaDates.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-12 text-center">
                    <CalendarDays size={40} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming events in the next 3 weeks</p>
                  </div>
                ) : agendaDates.map(d => {
                  const isToday = d === TODAY;
                  const dayEvents = eventsFor(d);
                  return (
                    <div key={d} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                      <div className={`px-5 py-3 flex items-center gap-3 ${isToday ? 'bg-[#F87404]/5 border-b border-[#F87404]/15' : 'border-b border-gray-50 dark:border-white/5'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-lg ${isToday ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'}`}>
                          {new Date(d + 'T00:00:00').getDate()}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isToday ? 'text-[#F87404]' : 'text-gray-900 dark:text-white'}`}>
                            {isToday ? 'Today' : fmtDate(d)}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-50 dark:divide-white/5">
                        {dayEvents.map(event => (
                          <div key={event.id} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: TYPE_STYLE[event.type]?.light }}>
                              <span style={{ color: TYPE_STYLE[event.type]?.bg }}>{TYPE_STYLE[event.type]?.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{event.title}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                                <Clock size={11} /> {event.time}
                                <span className="ml-1.5 capitalize px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: TYPE_STYLE[event.type]?.light, color: TYPE_STYLE[event.type]?.bg }}>
                                  {TYPE_STYLE[event.type]?.label}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Selected date detail (month view only) ── */}
            {view === 'month' && (
              <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                      {selectedDate === TODAY ? 'Today' : fmtDate(selectedDate)}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => { setNewEvent(e => ({ ...e, date: selectedDate })); setShowAdd(true); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#F87404] hover:bg-[#F87404]/10 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={13} /> Add
                  </button>
                </div>
                {selectedEvents.length > 0 ? (
                  <div className="divide-y divide-gray-50 dark:divide-white/5">
                    {selectedEvents.map(event => (
                      <div key={event.id} className="flex items-center gap-4 px-5 py-3.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: TYPE_STYLE[event.type]?.light }}>
                          <span style={{ color: TYPE_STYLE[event.type]?.bg }}>{TYPE_STYLE[event.type]?.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.title}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                            <Clock size={11} /> {event.time}
                          </p>
                          {event.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{event.notes}</p>}
                        </div>
                        <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_STYLE[event.type]?.bg }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    No events — <button onClick={() => setShowAdd(true)} className="text-[#F87404] font-semibold">add one</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════ MEAL PLAN TAB ══════════════════════ */}
        {tab === 'meal-plan' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Weekly Meal Plan</h2>
              <Link href="/recipes" className="text-xs font-semibold text-[#F87404] flex items-center gap-1 hover:underline">
                <BookOpen size={13} /> Browse Recipes
              </Link>
            </div>
            {mockMealPlanWeek.map(day => (
              <div key={day.day} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm ${day.date === TODAY ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300'}`}>
                      {new Date(day.date + 'T00:00:00').getDate()}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${day.date === TODAY ? 'text-[#F87404]' : 'text-gray-900 dark:text-white'}`}>
                        {day.date === TODAY ? 'Today' : day.day}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{totalMealCal(day)} cal total</p>
                    </div>
                  </div>
                  <Flame size={16} className="text-[#F87404]" />
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-50 dark:divide-white/5">
                  {[
                    { label: 'Breakfast', icon: Apple,   meal: day.breakfast, color: '#F87404' },
                    { label: 'Lunch',     icon: Utensils, meal: day.lunch,     color: '#004AAD' },
                    { label: 'Dinner',    icon: Utensils, meal: day.dinner,    color: '#7C3AED' },
                  ].map(({ label, icon: Icon, meal, color }) => (
                    <div key={label} className="p-3">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Icon size={11} style={{ color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
                      </div>
                      {meal ? (
                        <>
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">{meal.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{meal.cal} cal</p>
                          <Link href={`/recipes/${meal.recipeId}`} className="text-[10px] text-[#F87404] font-medium hover:underline">View recipe →</Link>
                        </>
                      ) : (
                        <button className="text-[10px] text-gray-400 hover:text-[#F87404] transition-colors">+ Add meal</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════ SHOPPING TAB ══════════════════════ */}
        {tab === 'shopping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Shopping List</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const mealPlanItems = [
                      { id: `mp-${Date.now()}-1`, name: 'Oatmeal', amount: '500g', category: 'Pantry' as const, checked: false },
                      { id: `mp-${Date.now()}-2`, name: 'Chicken breast', amount: '1kg', category: 'Meat' as const, checked: false },
                      { id: `mp-${Date.now()}-3`, name: 'Brown rice', amount: '1kg', category: 'Pantry' as const, checked: false },
                      { id: `mp-${Date.now()}-4`, name: 'Broccoli', amount: '3 heads', category: 'Produce' as const, checked: false },
                      { id: `mp-${Date.now()}-5`, name: 'Greek yogurt', amount: '4 cups', category: 'Dairy' as const, checked: false },
                      { id: `mp-${Date.now()}-6`, name: 'Eggs', amount: '12', category: 'Dairy' as const, checked: false },
                    ];
                    setShopping(prev => {
                      const existingNames = new Set(prev.map(i => i.name.toLowerCase()));
                      const newItems = mealPlanItems.filter(i => !existingNames.has(i.name.toLowerCase()));
                      return [...prev, ...newItems];
                    });
                    toast.success(`Generated ${mealPlanItems.length} items from meal plan!`);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5 hover:bg-[#10B981]/10 px-3 py-1.5 rounded-xl transition-colors">
                  <BookOpen size={12} /> Generate from Meal Plan
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-full font-medium">
                  {shoppingDone}/{shopping.length} checked
                </span>
              </div>
            </div>

            {/* Add item */}
            <div className="flex gap-2">
              <input value={addedItem} onChange={e => setAddedItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addShoppingItem()}
                placeholder="Add item manually..."
                className="flex-1 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-[#F87404] bg-white dark:bg-gray-800" />
              <button onClick={addShoppingItem} className="px-4 py-2.5 bg-[#F87404] text-white rounded-xl text-sm font-semibold hover:bg-[#e06000] transition-colors flex-shrink-0">
                Add
              </button>
            </div>

            {shoppingByCategory.map(({ cat, items }) => items.length === 0 ? null : (
              <div key={cat} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-50 dark:border-white/5 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{cat}</h3>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{items.filter(i => i.checked).length}/{items.length}</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-white/5">
                  {items.map(item => (
                    <label key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                      <div onClick={() => setShopping(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i))}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${item.checked ? 'bg-[#10B981] border-[#10B981]' : 'border-gray-300 dark:border-gray-600'}`}>
                        {item.checked && <Check size={11} className="text-white" />}
                      </div>
                      <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{item.name}</span>
                      {item.amount && <span className="text-xs text-gray-400 dark:text-gray-500">{item.amount}</span>}
                      <button onClick={() => setShopping(prev => prev.filter(i => i.id !== item.id))}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════ TODOS TAB ══════════════════════ */}
        {tab === 'todos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">To-Do List</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-full font-medium">
                {doneCount}/{todos.length} complete
              </span>
            </div>

            {/* Add todo */}
            <div className="flex gap-2">
              <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTodo()}
                placeholder="Add a task..."
                className="flex-1 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-[#F87404] bg-white dark:bg-gray-800" />
              <button onClick={addTodo} className="px-4 py-2.5 bg-[#004AAD] text-white rounded-xl text-sm font-semibold hover:bg-[#003899] transition-colors flex-shrink-0">
                Add
              </button>
            </div>

            {/* Priority groups */}
            {(['high', 'medium', 'low'] as const).map(priority => {
              const group = todos.filter(t => t.priority === priority);
              if (group.length === 0) return null;
              const colors = { high: 'text-red-600 bg-red-50', medium: 'text-[#F87404] bg-orange-50', low: 'text-gray-500 bg-gray-100' };
              return (
                <div key={priority} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 dark:border-white/5">
                    <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${colors[priority]}`}>
                      {priority} priority
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-white/5">
                    {group.map(todo => (
                      <div key={todo.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <button onClick={() => setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${todo.done ? 'bg-[#F87404] border-[#F87404]' : 'border-gray-300 dark:border-gray-600'}`}>
                          {todo.done && <Check size={11} className="text-white" />}
                        </button>
                        <span className={`flex-1 text-sm ${todo.done ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{todo.text}</span>
                        <button onClick={() => setTodos(prev => prev.filter(t => t.id !== todo.id))}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ══ Add Event Modal ══ */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Add Event</h2>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <input value={newEvent.title} onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))}
                placeholder="Event title *" className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-[#F87404] bg-white dark:bg-gray-700" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Date</label>
                  <input type="date" value={newEvent.date} onChange={e => setNewEvent(v => ({ ...v, date: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-[#F87404] bg-white dark:bg-gray-700" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Time</label>
                  <input type="time" value={newEvent.time} onChange={e => setNewEvent(v => ({ ...v, time: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-[#F87404] bg-white dark:bg-gray-700" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_STYLE).map(([key, style]) => (
                    <button key={key} onClick={() => setNewEvent(v => ({ ...v, type: key }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${newEvent.type === key ? 'border-[#F87404]/40' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}`}
                      style={newEvent.type === key ? { backgroundColor: style.light, color: style.bg } : {}}>
                      {style.icon} {style.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={newEvent.notes} onChange={e => setNewEvent(v => ({ ...v, notes: e.target.value }))}
                placeholder="Notes (optional)" rows={2}
                className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-[#F87404] resize-none bg-white dark:bg-gray-700" />
              <button onClick={addEvent}
                className="w-full bg-[#F87404] hover:bg-[#e06000] text-white font-semibold py-3 rounded-xl text-sm transition-all">
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
