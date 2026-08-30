'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import Link from 'next/link';
import { Loader2, Search, X } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState } from '@/components/ui/States';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface Result {
  id: number;
  conversation_id: number;
  content: string;
  snippet: string;
  created_at: string;
  sender: { id: number | null; name: string | null; avatar: string | null; is_me: boolean };
  with: { id: number; name: string } | null;
}

type Range = 'all' | '30' | '90' | '365' | 'custom';

const RANGE_LABEL_KEYS: Record<Range, string> = {
  all: 'msgSearch.rangeAny',
  '30': 'msgSearch.range30',
  '90': 'msgSearch.range90',
  '365': 'msgSearch.rangeYear',
  custom: 'msgSearch.rangeCustom',
};

/** Debounce, per the brief. Long enough to stop per-keystroke queries. */
const DEBOUNCE_MS = 300;

export default function MessageSearchPage() {
  const { t } = useI18nStore();
  const [term, setTerm] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Guards against a slow earlier request overwriting a newer one's results.
  const requestRef = useRef(0);

  const run = useCallback(async (pageNum: number, append: boolean) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]); setTotal(0); setSearched(false);
      return;
    }

    const ticket = ++requestRef.current;
    setSearching(true);

    try {
      const { data } = await api.get('/messages/search', {
        params: {
          q: trimmed,
          range,
          from: range === 'custom' && from ? from : undefined,
          to: range === 'custom' && to ? to : undefined,
          page: pageNum,
        },
      });

      if (ticket !== requestRef.current) return; // A newer search superseded this one.

      setResults((prev) => (append ? [...prev, ...data.data] : data.data));
      setTotal(data.meta?.total ?? 0);
      setLastPage(data.meta?.last_page ?? 1);
      setPage(pageNum);
      setError(null);
      setSearched(true);
    } catch (e) {
      if (ticket !== requestRef.current) return;
      setError(getErrorMessage(e));
    } finally {
      if (ticket === requestRef.current) setSearching(false);
    }
  }, [term, range, from, to]);

  useEffect(() => {
    const id = setTimeout(() => { void run(1, false); }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [run]);

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto">
        <PageHeader title={t('msgSearch.title')} subtitle={t('msgSearch.subtitle')} back="/messages" />

        <div className="space-y-3">
          <div className="relative">
            <Search size={16} strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" aria-hidden />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('msgSearch.placeholder')}
              aria-label={t('msgSearch.placeholder')}
              className="w-full bg-surface-sunken border border-border-strong rounded-md pl-9 pr-9 py-2.5 text-body-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
            />
            {term && (
              <button type="button" onClick={() => setTerm('')} aria-label={t('msgSearch.clear')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-sm flex items-center justify-center text-content-tertiary hover:text-content-primary">
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(RANGE_LABEL_KEYS) as Range[]).map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={[
                  'px-3 py-1.5 rounded-full text-caption font-medium border transition-colors',
                  range === r
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface-raised text-content-secondary border-border-strong hover:text-content-primary',
                ].join(' ')}>
                {t(RANGE_LABEL_KEYS[r])}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-caption text-content-secondary mb-1">{t('msgSearch.from')}</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-surface-sunken border border-border-strong rounded-md px-3 py-2 text-body-sm text-content-primary outline-none focus-visible:border-accent" />
              </label>
              <label className="block">
                <span className="block text-caption text-content-secondary mb-1">To</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="w-full bg-surface-sunken border border-border-strong rounded-md px-3 py-2 text-body-sm text-content-primary outline-none focus-visible:border-accent" />
              </label>
            </div>
          )}
        </div>

        <div className="mt-5">
          {searching && results.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-content-tertiary" aria-label={t('msgSearch.searching')} />
            </div>
          ) : error ? (
            <ErrorState description={error} onRetry={() => void run(1, false)} />
          ) : term.trim().length < 2 ? (
            <p className="text-body-sm text-content-tertiary text-center py-10">
              {t('msgSearch.minChars')}
            </p>
          ) : searched && results.length === 0 ? (
            <EmptyState title={t('msgSearch.noMatches')}
              description={t('msgSearch.noMatchesHint')} />
          ) : (
            <>
              <p className="text-caption text-content-tertiary mb-3">
                {total} {total === 1 ? 'message' : 'messages'}
              </p>

              <div className="space-y-2.5">
                {results.map((r) => (
                  <Link key={r.id} href={`/messages/${r.conversation_id}`}
                    className="block rounded-md border border-border bg-surface-raised p-3.5 hover:border-border-strong transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={r.sender.avatar ?? undefined} name={r.sender.name ?? '?'} size="xs" />
                      <span className="text-caption font-semibold text-content-primary">
                        {r.sender.is_me ? 'You' : r.sender.name}
                      </span>
                      {r.with && (
                        <span className="text-caption text-content-tertiary truncate">
                          · with {r.with.name}
                        </span>
                      )}
                      <span className="text-caption text-content-tertiary ml-auto shrink-0">
                        {new Date(r.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-body-sm text-content-secondary mt-1.5 break-words">{r.snippet}</p>
                  </Link>
                ))}
              </div>

              {page < lastPage && (
                <div className="flex justify-center mt-4">
                  <Button variant="ghost" loading={searching} onClick={() => void run(page + 1, true)}>
                    {t('common.loadMore')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
