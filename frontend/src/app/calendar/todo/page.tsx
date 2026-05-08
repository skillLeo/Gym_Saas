'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Plus, Check, Trash2, Flag, Calendar, Circle } from 'lucide-react';
import Link from 'next/link';

type Priority = 'high' | 'medium' | 'low';
type Todo = { id: string; text: string; done: boolean; priority: Priority; dueDate?: string; category: string };

const initialTodos: Todo[] = [
  { id: '1', text: 'Complete 45-min strength workout', done: false, priority: 'high', category: 'Fitness', dueDate: 'Today' },
  { id: '2', text: 'Log breakfast and lunch', done: true, priority: 'medium', category: 'Nutrition', dueDate: 'Today' },
  { id: '3', text: 'Drink 8 glasses of water', done: false, priority: 'medium', category: 'Health', dueDate: 'Today' },
  { id: '4', text: 'Prepare meal prep for the week', done: false, priority: 'high', category: 'Nutrition', dueDate: 'Sunday' },
  { id: '5', text: 'Check in with Marcus about group workout', done: false, priority: 'low', category: 'Social' },
  { id: '6', text: 'Research 5K training plan', done: true, priority: 'low', category: 'Fitness' },
];

const priorityConfig: Record<Priority, { color: string; label: string }> = {
  high: { color: '#FF0404', label: 'High' },
  medium: { color: '#FFC000', label: 'Medium' },
  low: { color: '#10B981', label: 'Low' },
};

const categories = ['All', 'Fitness', 'Nutrition', 'Health', 'Social'];

export default function TodoPage() {
  const [todos, setTodos] = useState(initialTodos);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [category, setCategory] = useState('All');
  const [newText, setNewText] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [showAdd, setShowAdd] = useState(false);

  const toggle = (id: string) => setTodos(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = (id: string) => setTodos(p => p.filter(t => t.id !== id));

  const addTodo = () => {
    if (newText.trim()) {
      setTodos(p => [...p, { id: Date.now().toString(), text: newText, done: false, priority: newPriority, category: 'Fitness' }]);
      setNewText('');
      setShowAdd(false);
    }
  };

  const filtered = todos.filter(t => {
    if (filter === 'active' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    if (category !== 'All' && t.category !== category) return false;
    return true;
  });

  const done = todos.filter(t => t.done).length;

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/calendar">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#004AAD]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">To-Do List</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{done}/{todos.length} tasks complete</p>
          </div>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>Add Task</Button>
        </div>

        {/* Progress */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] p-4 mb-5 shadow-sm">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-gray-900 dark:text-white">Today&apos;s Progress</span>
            <span className="text-[#004AAD] font-bold">{Math.round((done / todos.length) * 100)}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#004AAD] rounded-full transition-all" style={{ width: `${(done / todos.length) * 100}%` }} />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all ${category === cat ? 'bg-[#004AAD] text-white' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-xl mb-4">
          {(['all', 'active', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Done'}
            </button>
          ))}
        </div>

        {/* Todo List */}
        <div className="space-y-2 mb-5">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <Circle size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">No tasks here</p>
            </div>
          )}
          {filtered.map(todo => (
            <div key={todo.id} className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${todo.done ? 'opacity-60 bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/[0.07]'}`}>
              <button onClick={() => toggle(todo.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${todo.done ? 'bg-[#004AAD] border-[#004AAD]' : 'border-gray-300 dark:border-gray-600 hover:border-[#004AAD]'}`}>
                {todo.done && <Check size={12} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${todo.done ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                  {todo.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: priorityConfig[todo.priority].color + '20', color: priorityConfig[todo.priority].color }}>
                    {priorityConfig[todo.priority].label}
                  </span>
                  <span className="text-xs text-gray-400">{todo.category}</span>
                  {todo.dueDate && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={10} /> {todo.dueDate}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(todo.id)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Add Task Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <div className="relative w-full sm:max-w-sm bg-white dark:bg-[#1a1a1a] rounded-t-3xl sm:rounded-3xl p-5 z-10 shadow-2xl border border-gray-100 dark:border-white/[0.07]">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Add Task</h3>
              <div className="space-y-3 mb-4">
                <input value={newText} onChange={e => setNewText(e.target.value)}
                  placeholder="What do you need to do?" autoFocus
                  onKeyDown={e => e.key === 'Enter' && addTodo()}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#004AAD]/50" />
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Priority</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(priorityConfig) as [Priority, typeof priorityConfig[Priority]][]).map(([key, cfg]) => (
                      <button key={key} onClick={() => setNewPriority(key)}
                        className={`py-2 rounded-xl text-xs font-medium capitalize transition-all border-2 ${newPriority === key ? 'text-white border-transparent' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}
                        style={{ backgroundColor: newPriority === key ? cfg.color : undefined }}>
                        <Flag size={12} className="mx-auto mb-0.5" style={{ color: newPriority === key ? 'white' : cfg.color }} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button fullWidth style={{ backgroundColor: '#004AAD' }} onClick={addTodo}>Add Task</Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
