'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/errors';
import {
  downloadResource,
  fetchAsBlobUrl,
  fetchResource,
  type Resource,
} from '@/lib/resources';

/**
 * Resource viewer (§5.3).
 *
 * The file endpoints require an Authorization header, which the browser will
 * not attach to an <iframe src> or <video src>. So the file is fetched through
 * the API client and turned into an object URL — that is what makes an
 * authenticated file viewable inline without ever exposing a public path.
 *
 * The object URL is revoked on unmount; leaving them alive holds the whole file
 * in memory for the life of the tab.
 */
export default function ResourceViewerPage() {
  const { t } = useI18nStore();
  const params = useParams();
  const id = Number(params?.resourceId);

  const [resource, setResource] = useState<Resource | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError('That resource does not exist.');
      setLoading(false);
      return;
    }

    try {
      const r = await fetchResource(id);
      setResource(r);
      setError(null);

      if (r.stream_url) {
        try {
          setBlobUrl(await fetchAsBlobUrl(r.stream_url));
        } catch (e) {
          // The metadata loaded but the file did not — show the page with an
          // explanation rather than a blank frame.
          setFileError(getErrorMessage(e));
        }
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Free the object URL when leaving the page.
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  async function handleDownload() {
    if (!resource) return;
    setDownloading(true);
    try {
      await downloadResource(resource);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title={resource?.title ?? t('resourceDetail.title')}
          subtitle={resource?.category?.name}
          back="/resources"
          actions={
            resource && resource.type !== 'link' ? (
              <Button size="sm" variant="outline" loading={downloading}
                icon={<Download size={15} strokeWidth={2} />} onClick={handleDownload}>
                {t('resourceDetail.download')}
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-content-tertiary" aria-label={t('resourceDetail.loading')} />
          </div>
        ) : error || !resource ? (
          <ErrorState
            title={t('resourceDetail.unavailable')}
            description={error ?? t('resourceDetail.notFound')}
            onRetry={() => window.location.assign('/resources')}
            retryLabel={t('resourceDetail.back')}
          />
        ) : (
          <>
            {resource.description && (
              <p className="text-body-sm text-content-secondary mb-4 text-pretty">{resource.description}</p>
            )}

            {fileError ? (
              <ErrorState title={t('resourceDetail.cannotOpen')} description={fileError}
                onRetry={() => { setLoading(true); setFileError(null); void load(); }} />
            ) : resource.type === 'video' && blobUrl ? (
              <video
                src={blobUrl}
                controls
                playsInline
                className="w-full rounded-md bg-black aspect-video"
              >
                {t('resourceDetail.noVideo')}
              </video>
            ) : resource.type === 'pdf' && blobUrl ? (
              <object data={blobUrl} type="application/pdf"
                className="w-full rounded-md border border-border bg-surface-raised h-[70vh]">
                {/* Mobile browsers frequently cannot render a PDF inline. Rather
                    than showing an empty frame, offer the download that works. */}
                <div className="p-8 text-center">
                  <p className="text-body-sm text-content-secondary mb-4">
                    {t('resourceDetail.noPdf')}
                  </p>
                  <Button loading={downloading} onClick={handleDownload}
                    icon={<Download size={15} strokeWidth={2} />}>
                    {t('resourceDetail.downloadToRead')}
                  </Button>
                </div>
              </object>
            ) : resource.type === 'link' ? (
              <a href={resource.external_url ?? '#'} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-accent text-white font-semibold text-body-sm hover:bg-accent-hover transition-colors">
                {t('resourceDetail.openLink')}
              </a>
            ) : (
              <div className="flex justify-center py-16">
                <Loader2 size={22} className="animate-spin text-content-tertiary" aria-label={t('resourceDetail.preparing')} />
              </div>
            )}

            <div className="flex flex-wrap gap-4 mt-4 text-caption text-content-tertiary">
              {resource.file_size && <span>{resource.file_size}</span>}
              {resource.view_count > 0 && <span>{resource.view_count} views</span>}
              {resource.download_count > 0 && <span>{resource.download_count} downloads</span>}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
