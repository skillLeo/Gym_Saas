'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import Link from 'next/link';
import { Download, Loader2, Search, X } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/errors';
import toast from 'react-hot-toast';
import {
  downloadResource,
  fetchCategories,
  fetchResources,
  TYPE_ICONS,
  TYPE_LABELS,
  type Resource,
  type ResourceCategory,
  type ResourceType,
} from '@/lib/resources';

const DEBOUNCE_MS = 300;

/**
 * Member-facing resources library (§5.3).
 *
 * Files are never linked directly — every card points at an authenticated
 * endpoint, and downloads go through the API client so the Authorization
 * header is attached. There is no public path to any of this.
 */
export default function ResourcesPage() {
  const { t } = useI18nStore();
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [category, setCategory] = useState('');
  const [type, setType] = useState<ResourceType | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => { /* filters are optional */ });
  }, []);

  const load = useCallback(async (pageNum: number, append: boolean) => {
    try {
      const res = await fetchResources({ category, type, search, page: pageNum });
      setResources((prev) => (append ? [...prev, ...res.data] : res.data));
      setTotal(res.total);
      setLastPage(res.lastPage);
      setPage(res.currentPage);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [category, type, search]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => { void load(1, false); }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [load]);

  const activeFilters = useMemo(
    () => Boolean(category || type || search.trim()),
    [category, type, search],
  );

  async function handleDownload(resource: Resource) {
    setDownloading(resource.id);
    try {
      await downloadResource(resource);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto">
        <PageHeader title={t('resources.title')} subtitle={t('resources.subtitle')} />

        <div className="space-y-3">
          <div className="relative">
            <Search size={16} strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('resources.search')}
              aria-label="Search resources"
              className="w-full bg-surface-sunken border border-border-strong rounded-md pl-9 pr-9 py-2.5 text-body-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label={t('resources.clearSearch')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-sm flex items-center justify-center text-content-tertiary hover:text-content-primary">
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={!category && !type} onClick={() => { setCategory(''); setType(''); }}>
              {t('resources.all')}
            </FilterChip>
            {(Object.keys(TYPE_LABELS) as ResourceType[]).map((kind) => (
              <FilterChip key={kind} active={type === kind} onClick={() => setType(type === kind ? '' : kind)}>
                {t('resources.' + kind + 's')}
              </FilterChip>
            ))}
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <FilterChip key={c.id} active={category === c.slug}
                  onClick={() => setCategory(category === c.slug ? '' : c.slug)}>
                  <Icon name={c.icon_name} size={13} aria-hidden />
                  {c.name}
                  <span className="text-content-tertiary tabular-nums">{c.resource_count}</span>
                </FilterChip>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label="Loading resources" />
            </div>
          ) : error ? (
            <ErrorState description={error} onRetry={() => { setLoading(true); void load(1, false); }} />
          ) : resources.length === 0 ? (
            <EmptyState
              title={activeFilters ? t('resources.noMatch') : t('resources.empty')}
              description={activeFilters
                ? 'Try a different category or clear the filters.'
                : 'Material added by the team will appear here.'}
            />
          ) : (
            <>
              <p className="text-caption text-content-tertiary mb-3">
                {total === 1 ? t('resources.countOne') : t('resources.count', { count: total })}
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((r) => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    downloading={downloading === r.id}
                    onDownload={() => handleDownload(r)}
                  />
                ))}
              </div>

              {page < lastPage && (
                <div className="flex justify-center mt-5">
                  <Button variant="ghost" onClick={() => void load(page + 1, true)}>{t('resources.loadMore')}</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium border transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-surface-raised text-content-secondary border-border-strong hover:text-content-primary',
      ].join(' ')}>
      {children}
    </button>
  );
}

function ResourceCard({
  resource,
  downloading,
  onDownload,
}: {
  resource: Resource;
  downloading: boolean;
  onDownload: () => void;
}) {
  const { t } = useI18nStore();
  const isLink = resource.type === 'link';

  return (
    <article className="flex flex-col rounded-md border border-border bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-md bg-accent-surface text-accent flex items-center justify-center">
          <Icon name={TYPE_ICONS[resource.type]} size={19} aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-body-sm text-content-primary leading-tight">{resource.title}</h2>
          {resource.category && (
            <p className="text-caption text-content-tertiary mt-0.5">{resource.category.name}</p>
          )}
        </div>
      </div>

      {resource.description && (
        <p className="text-body-sm text-content-secondary mt-3 text-pretty line-clamp-3">
          {resource.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3 text-caption text-content-tertiary">
        {resource.file_size && <span>{resource.file_size}</span>}
        {resource.duration_seconds && (
          <span>{Math.round(resource.duration_seconds / 60)} min</span>
        )}
        {/* Counts come from the API and are real. Rendered only when non-zero,
            so a brand-new resource does not advertise "0 views". */}
        {resource.view_count > 0 && <span>{t('resources.views', { count: resource.view_count })}</span>}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border-subtle">
        {isLink ? (
          <a href={resource.external_url ?? '#'} target="_blank" rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-body-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors">
            {t('resources.openLink')}
          </a>
        ) : (
          <>
            <Link href={`/resources/${resource.id}`}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-sm text-body-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors">
              {resource.type === 'video' ? t('resources.watch') : t('resources.read')}
            </Link>
            <button type="button" onClick={onDownload} disabled={downloading}
              aria-label={`Download ${resource.title}`}
              className="h-9 w-9 shrink-0 rounded-sm flex items-center justify-center border border-border-strong text-content-secondary hover:text-content-primary hover:border-accent/40 transition-colors disabled:opacity-50">
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2} />}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
