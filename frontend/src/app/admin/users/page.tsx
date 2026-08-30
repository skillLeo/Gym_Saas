'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Search, Eye, Ban, Trash2, UserPlus, Loader2, RotateCcw,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type AccountState = 'trial' | 'subscriber' | 'grace' | 'deactivated';

type User = {
  id:            number;
  name:          string;
  email:         string;
  avatar:        string | null;
  created_at:    string;
  account_state: AccountState;
  is_admin:      boolean;
};

const STATE_BADGE: Record<AccountState, 'orange' | 'green' | 'red' | 'gray'> = {
  trial: 'orange', subscriber: 'green', grace: 'red', deactivated: 'gray',
};
const STATE_LABEL: Record<AccountState, string> = {
  trial: 'Trial', subscriber: 'Subscriber', grace: 'Expired', deactivated: 'Deactivated',
};

export default function AdminUsersPage() {
  const { confirm } = useConfirm();
  const [query,        setQuery]        = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [users,        setUsers]        = useState<User[]>([]);
  const [totalCount,   setTotalCount]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [actingId,     setActingId]     = useState<number | null>(null);
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1 };
      if (query) params.search = query;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/admin/users', { params });
      setUsers(res.data.data ?? []);
      setTotalCount(res.data.total ?? 0);
      setPage(1);
      setHasMore((res.data.current_page ?? 1) < (res.data.last_page ?? 1));
    } catch {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  const loadMoreUsers = async () => {
    setLoadingMore(true);
    try {
      const params: Record<string, string | number> = { page: page + 1 };
      if (query) params.search = query;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/admin/users', { params });
      setUsers(prev => [...prev, ...(res.data.data ?? [])]);
      setPage(page + 1);
      setHasMore((res.data.current_page ?? 1) < (res.data.last_page ?? 1));
    } catch {
      toast.error('Failed to load more users.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const setAccountState = async (user: User, state: AccountState) => {
    setActingId(user.id);
    try {
      await api.put(`/admin/users/${user.id}`, { account_state: state });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, account_state: state } : u));
      toast.success(`${user.name} is now ${STATE_LABEL[state].toLowerCase()}.`);
    } catch {
      toast.error('Failed to update this account.');
    } finally {
      setActingId(null);
    }
  };

  const deleteUser = async (user: User) => {
    if (!(await confirm({ title: `Delete ${user.name}'s account?`, message: 'This is reversible for a retention window, then it becomes permanent. The deletion is recorded in the audit log.', confirmLabel: 'Delete account', destructive: true }))) return;
    setActingId(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setTotalCount(c => c - 1);
      toast.success(`${user.name}'s account was deleted.`);
    } catch {
      toast.error('Failed to delete this account.');
    } finally {
      setActingId(null);
    }
  };

  function Avatar({ user }: { user: User }) {
    return user.avatar ? (
      <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
    ) : (
      <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-accent font-bold text-sm">
        {user.name[0]?.toUpperCase()}
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">

        <PageHeader
          title="User Management"
          subtitle={`${totalCount} users`}
          back="/admin"
          actions={
            <Link href="/admin/new-users" className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover">
              <UserPlus size={15} /> New members
            </Link>
          }
        />

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search name, email, username..."
              className="w-full pl-10 pr-4 py-3 rounded-md border border-border-strong bg-surface-raised text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 text-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-md border border-border-strong bg-surface-raised text-content-primary text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
            <option value="all">All Status</option>
            <option value="trial">Trial</option>
            <option value="subscriber">Subscriber</option>
            <option value="expired">Expired (grace)</option>
            <option value="deactivated">Deactivated</option>
            <option value="new">New (7 days)</option>
          </select>
        </div>

        <div className="bg-surface-raised rounded-md border border-border-subtle overflow-hidden shadow-sm">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-border-subtle bg-gray-50 dark:bg-white/[0.03]">
            <div className="col-span-5 text-xs font-semibold text-content-secondary uppercase tracking-wide">User</div>
            <div className="col-span-3 text-xs font-semibold text-content-secondary uppercase tracking-wide">Joined</div>
            <div className="col-span-2 text-xs font-semibold text-content-secondary uppercase tracking-wide">Status</div>
            <div className="col-span-2 text-xs font-semibold text-content-secondary uppercase tracking-wide">Actions</div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-content-tertiary">No users found</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {users.map(user => (
                <div key={user.id} className="sm:grid grid-cols-12 gap-4 px-5 py-4 flex items-center hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                  <div className="col-span-5 flex items-center gap-3 mb-2 sm:mb-0">
                    <Avatar user={user} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-content-primary truncate flex items-center gap-1.5">
                        {user.name}
                        {user.is_admin && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-surface text-accent">ADMIN</span>}
                      </div>
                      <div className="text-xs text-content-tertiary truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="col-span-3 text-sm text-content-secondary hidden sm:block">
                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="col-span-2 hidden sm:block">
                    <Badge variant={STATE_BADGE[user.account_state]} size="sm">{STATE_LABEL[user.account_state]}</Badge>
                  </div>
                  <div className="col-span-2 flex gap-1.5">
                    <Link href={`/admin/users/${user.id}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-content-tertiary hover:text-brand-blue-deep transition-colors">
                      <Eye size={13} />
                    </Link>
                    {user.account_state === 'deactivated' ? (
                      <button onClick={() => setAccountState(user, 'trial')} disabled={actingId === user.id}
                        title="Reactivate"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 text-content-tertiary hover:text-green-500 transition-colors disabled:opacity-40">
                        {actingId === user.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      </button>
                    ) : (
                      <button onClick={() => setAccountState(user, 'deactivated')} disabled={actingId === user.id || user.is_admin}
                        title="Deactivate"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-content-tertiary hover:text-red-500 transition-colors disabled:opacity-40">
                        {actingId === user.id ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                      </button>
                    )}
                    <button onClick={() => deleteUser(user)} disabled={actingId === user.id || user.is_admin}
                      title="Delete"
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-content-tertiary hover:text-red-500 transition-colors disabled:opacity-40">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {hasMore && (
            <div className="p-3">
              <Button variant="secondary" fullWidth size="sm" loading={loadingMore} onClick={loadMoreUsers}>
                Load more
              </Button>
            </div>
          )}
        </div>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
