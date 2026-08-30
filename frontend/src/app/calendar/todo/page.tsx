'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/format';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Plus, Check, Trash2, Flag, Calendar, Circle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type Priority = 'high' | 'medium' | 'low';
type Todo = { id: number; text: string; completed: boolean; priority: Priority; due_date: string | null };

const priorityConfig: Record<Priority, { color: string; labelKey: string }> = {
  high: { color: '#FF0404', labelKey: 'todo.high' },
  medium: { color: '#FFC000', labelKey: 'todo.medium' },
  low: { color: '#10B981', labelKey: 'todo.low' },
};

export default function TodoPage() {
  const { t, locale } = useI18nStore();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [newText, setNewText] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/calendar/todos').then(r => setTodos(r.data.todos ?? [])).catch(() => toast.error(t('todo.error.load'))).finally(() => setLoading(false));
  }, []);

  const toggle = async (id: number) => {
    setTodos(p => p.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try { await api.post(`/calendar/todos/${id}/toggle`); } catch {
      setTodos(p => p.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
      toast.error(t('todo.error.update'));
    }
  };

  const remove = async (id: number) => {
    setTodos(p => p.filter(t => t.id !== id));
    try { await api.delete(`/calendar/todos/${id}`); } catch { toast.error(t('todo.error.delete')); }
  };

  const addTodo = async () => {
    if (!newText.trim() || saving) return;
    setSaving(true);
    try {
      const res = await api.post('/calendar/todos', {
        text: newText.trim(),
        priority: newPriority,
        due_date: newDueDate || null,
      });
      setTodos(p => [res.data.todo, ...p]);
      setNewText('');
      setNewPriority('medium');
      setNewDueDate('');
      setShowAdd(false);
    } catch {
      toast.error(t('todo.error.add'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = todos.filter(t => {
    if (filter === 'active' && t.completed) return false;
    if (filter === 'done' && !t.completed) return false;
    return true;
  });

  const done = todos.filter(t => t.completed).length;

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6">

        <PageHeader
        title={t('todo.title')}
        subtitle={t('todo.tasksComplete', { done, total: todos.length })}
        back="/calendar"
        actions={<Button size="sm" icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>{t('todo.addTask')}</Button>}
      />

        {/* Progress */}
        <div className="bg-surface-raised rounded-md border border-border-subtle p-4 mb-5 shadow-sm">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-content-primary">{t('common.todayProgress')}</span>
            <span className="text-brand-blue-deep font-bold">{todos.length ? Math.round((done / todos.length) * 100) : 0}%</span>
          </div>
          <div className="h-2.5 bg-surface-sunken rounded-full overflow-hidden">
            <div className="h-full bg-[#004AAD] rounded-full transition-all" style={{ width: `${todos.length ? (done / todos.length) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-md mb-4">
          {(['all', 'active', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary'}`}>
              {f === 'all' ? t('common.all') : f === 'active' ? t('todo.active') : t('common.done')}
            </button>
          ))}
        </div>

        {/* Todo List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-brand-blue-deep" />
          </div>
        ) : (
          <div className="space-y-2 mb-5">
            {filtered.length === 0 && (
              <div className="text-center py-10">
                <Circle size={28} className="mx-auto text-content-tertiary dark:text-content-secondary mb-2" />
                <p className="text-sm text-content-tertiary">{t('todo.empty')}</p>
              </div>
            )}
            {filtered.map(todo => (
              <div key={todo.id} className={`flex items-start gap-3 p-4 rounded-md border transition-all ${todo.completed ? 'opacity-60 bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05]' : 'bg-surface-raised border-border-subtle'}`}>
                <button onClick={() => toggle(todo.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${todo.completed ? 'bg-[#004AAD] border-[#004AAD]' : 'border-gray-300 dark:border-gray-600 hover:border-[#004AAD]'}`}>
                  {todo.completed && <Check size={12} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${todo.completed ? 'line-through text-content-tertiary' : 'text-content-primary'}`}>
                    {todo.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: priorityConfig[todo.priority]?.color + '20', color: priorityConfig[todo.priority]?.color }}>
                      {t(priorityConfig[todo.priority]?.labelKey ?? 'todo.medium')}
                    </span>
                    {todo.due_date && (
                      <span className="text-xs text-content-tertiary flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(new Date(todo.due_date), locale, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(todo.id)} className="w-7 h-7 flex items-center justify-center text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Task Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <div className="relative w-full sm:max-w-sm bg-surface-raised rounded-t-3xl sm:rounded-md p-5 z-10 border border-border-subtle">
              <h3 className="font-semibold text-content-primary mb-4">{t('todo.addTask')}</h3>
              <div className="space-y-3 mb-4">
                <input value={newText} onChange={e => setNewText(e.target.value)}
                  placeholder={t('todo.what')} autoFocus
                  onKeyDown={e => e.key === 'Enter' && addTodo()}
                  className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004AAD]/50" />
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-1.5 block">{t('todo.dueDate')}</label>
                  <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004AAD]/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-2 block">{t('todo.priority')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(priorityConfig) as [Priority, typeof priorityConfig[Priority]][]).map(([key, cfg]) => (
                      <button key={key} onClick={() => setNewPriority(key)}
                        className={`py-2 rounded-md text-xs font-medium capitalize transition-all border-2 ${newPriority === key ? 'text-white border-transparent' : 'border-border-strong text-content-secondary'}`}
                        style={{ backgroundColor: newPriority === key ? cfg.color : undefined }}>
                        <Flag size={12} className="mx-auto mb-0.5" style={{ color: newPriority === key ? 'white' : cfg.color }} />
                        {t(cfg.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
                <Button fullWidth style={{ backgroundColor: '#004AAD' }} onClick={addTodo} loading={saving}>{t('todo.addTask')}</Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
