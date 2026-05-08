'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { mockCalendarEvents } from '@/lib/mockData';
import {
  ChevronLeft, ChevronRight, Plus, Utensils, ShoppingCart,
  CheckSquare, X, Clock,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const eventTypeColor: Record<string, string> = {
  workout: '#FF0404', meal: '#F87404', appointment: '#004AAD', other: '#10B981',
};

type TabKey = 'calendar' | 'meal-plan' | 'shopping' | 'todos';

const shoppingList = [
  { id: 1, item: 'Chicken breast (3 lbs)', checked: true, category: 'Protein' },
  { id: 2, item: 'Brown rice (2 lbs)', checked: true, category: 'Carbs' },
  { id: 3, item: 'Broccoli', checked: false, category: 'Veggies' },
  { id: 4, item: 'Greek yogurt (6-pack)', checked: false, category: 'Protein' },
  { id: 5, item: 'Almonds (1 lb)', checked: false, category: 'Fats' },
  { id: 6, item: 'Eggs (2 dozen)', checked: true, category: 'Protein' },
  { id: 7, item: 'Sweet potatoes', checked: false, category: 'Carbs' },
  { id: 8, item: 'Spinach (bag)', checked: false, category: 'Veggies' },
];

const todos = [
  { id: 1, text: 'Complete 4 workouts this week', done: true, priority: 'high' },
  { id: 2, text: 'Log all meals in food journal', done: false, priority: 'high' },
  { id: 3, text: 'Drink 8 glasses of water daily', done: false, priority: 'medium' },
  { id: 4, text: 'Take progress photos on Sunday', done: false, priority: 'medium' },
  { id: 5, text: 'Schedule check-in with coach', done: true, priority: 'low' },
  { id: 6, text: 'Prep meals for the week', done: false, priority: 'high' },
];

const mealPlan = [
  { day: 'Monday', meals: { Breakfast: 'Scrambled eggs + oats', Lunch: 'Chicken rice bowl', Dinner: 'Salmon + veggies', Snack: 'Greek yogurt' } },
  { day: 'Tuesday', meals: { Breakfast: 'Protein shake + banana', Lunch: 'Turkey wrap', Dinner: 'Beef stir fry', Snack: 'Almonds' } },
  { day: 'Wednesday', meals: { Breakfast: 'Overnight oats', Lunch: 'Tuna salad', Dinner: 'Chicken + sweet potato', Snack: 'Apple + PB' } },
  { day: 'Thursday', meals: { Breakfast: 'Eggs + toast', Lunch: 'Grilled chicken wrap', Dinner: 'Ground turkey + rice', Snack: 'Protein bar' } },
  { day: 'Friday', meals: { Breakfast: 'Smoothie bowl', Lunch: 'Salmon salad', Dinner: 'Steak + broccoli', Snack: 'Cottage cheese' } },
];

export default function CalendarPage() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split('T')[0]);
  const [tab, setTab] = useState<TabKey>('calendar');
  const [shopping, setShopping] = useState(shoppingList);
  const [todoList, setTodoList] = useState(todos);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const getEventsForDate = (dateStr: string) => mockCalendarEvents.filter(e => e.date === dateStr);
  const selectedEvents = getEventsForDate(selectedDate);

  const formatSelectedDate = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    if (selectedDate === today.toISOString().split('T')[0]) {
      return `Today, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    }
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-black text-gray-900">Calendar</h1>
            <p className="text-gray-500 text-sm mt-0.5">Plan your fitness &amp; meals</p>
          </div>
          <button onClick={() => setShowAddEvent(true)} className="flex items-center gap-2 bg-[#F87404] hover:bg-[#e06000] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-[#F87404]/25">
            <Plus size={16} /> Add Event
          </button>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'meal-plan' as TabKey, icon: Utensils, label: 'Meal Planner', color: '#F87404' },
            { key: 'shopping' as TabKey, icon: ShoppingCart, label: 'Shopping List', color: '#10B981' },
            { key: 'todos' as TabKey, icon: CheckSquare, label: 'To-Do List', color: '#004AAD' },
          ].map(({ key, icon: Icon, label, color }) => (
            <button key={key} onClick={() => setTab(tab === key ? 'calendar' : key)}
              className={`flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border transition-all hover:shadow-md ${tab === key ? 'border-[#F87404]/40 bg-[#F87404]/5' : 'border-gray-100 shadow-sm'}`}>
              <Icon size={22} style={{ color }} />
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>

        {tab === 'calendar' && (
          <>
            <Card>
              {/* Month nav */}
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <h2 className="font-display font-bold text-gray-900">{MONTHS[month]} {year}</h2>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-2">
                {DAYS_OF_WEEK.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === today.toISOString().split('T')[0];
                  const isSelected = dateStr === selectedDate;
                  const events = getEventsForDate(dateStr);
                  return (
                    <button key={day} onClick={() => setSelectedDate(dateStr)}
                      className={`relative flex flex-col items-center py-2 rounded-xl transition-all ${isSelected ? 'bg-[#F87404] text-white shadow-md shadow-[#F87404]/30' : isToday ? 'bg-[#F87404]/10 text-[#F87404] font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}>
                      <span className="text-sm font-semibold">{day}</span>
                      {events.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {events.slice(0, 3).map(e => (
                            <div key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? 'white' : eventTypeColor[e.type] }} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Events for selected date */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{formatSelectedDate()}</h3>
                <span className="text-xs text-gray-400">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</span>
              </div>
              {selectedEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedEvents.map(event => (
                    <div key={event.id} className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: eventTypeColor[event.type] + '15' }}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventTypeColor[event.type] }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">{event.title}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> {event.time}
                          <span className="ml-1 capitalize px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: eventTypeColor[event.type] + '15', color: eventTypeColor[event.type] }}>{event.type}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
                  <p className="text-sm text-gray-500">No events for this day</p>
                  <button onClick={() => setShowAddEvent(true)} className="mt-2 text-xs font-semibold text-[#F87404] hover:underline">+ Add an event</button>
                </div>
              )}
            </div>

            {/* Upcoming */}
            <Card>
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Upcoming This Week</h3>
              <div className="space-y-2">
                {mockCalendarEvents.map(event => (
                  <div key={event.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: eventTypeColor[event.type] }} />
                    <span className="text-sm text-gray-700 flex-1">{event.title}</span>
                    <span className="text-xs text-gray-400">{event.time}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === 'meal-plan' && (
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Weekly Meal Plan</h2>
            <div className="space-y-3">
              {mealPlan.map(day => (
                <div key={day.day} className="border border-gray-100 rounded-xl p-4">
                  <h3 className="font-semibold text-sm text-[#F87404] mb-2">{day.day}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(day.meals).map(([mealType, food]) => (
                      <div key={mealType}>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{mealType}</p>
                        <p className="text-xs text-gray-700 mt-0.5">{food}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'shopping' && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Shopping List</h2>
              <span className="text-xs text-gray-400">{shopping.filter(i => i.checked).length}/{shopping.length} done</span>
            </div>
            <div className="space-y-1">
              {shopping.map(item => (
                <label key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={item.checked}
                    onChange={() => setShopping(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i))}
                    className="w-4 h-4 rounded accent-[#F87404]" />
                  <span className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.item}</span>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{item.category}</span>
                </label>
              ))}
            </div>
          </Card>
        )}

        {tab === 'todos' && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">To-Do List</h2>
              <span className="text-xs text-gray-400">{todoList.filter(t => t.done).length}/{todoList.length} complete</span>
            </div>
            <div className="space-y-1">
              {todoList.map(todo => (
                <label key={todo.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={todo.done}
                    onChange={() => setTodoList(prev => prev.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))}
                    className="w-4 h-4 rounded accent-[#F87404]" />
                  <span className={`text-sm flex-1 ${todo.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{todo.text}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${todo.priority === 'high' ? 'bg-red-100 text-red-600' : todo.priority === 'medium' ? 'bg-orange-100 text-[#F87404]' : 'bg-gray-100 text-gray-500'}`}>
                    {todo.priority}
                  </span>
                </label>
              ))}
            </div>
          </Card>
        )}

      </div>

      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddEvent(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Add Event</h2>
              <button onClick={() => setShowAddEvent(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Event title" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#F87404]" />
              <input type="date" defaultValue={selectedDate} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#F87404]" />
              <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#F87404]" />
              <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#F87404]">
                <option>Workout</option><option>Meal</option><option>Appointment</option><option>Other</option>
              </select>
              <button onClick={() => setShowAddEvent(false)} className="w-full bg-[#F87404] hover:bg-[#e06000] text-white font-semibold py-3 rounded-xl text-sm transition-all">Save Event</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
