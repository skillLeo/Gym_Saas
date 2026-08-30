'use client';

/**
 * Saved videos.
 *
 * `GET /videos/saved` existed and worked; nothing in the app ever called it, so
 * the bookmark on every video card had nowhere to lead. A save button with no
 * way to see what you saved is half a feature — the same gap found on social
 * posts in Phase 3 and already solved this way for recipes.
 */

import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import api from '@/lib/api';
import { Bookmark, Clock, Eye, Play, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Video = {
  id:            number;
  title:         string;
  thumbnail_url: string | null;
  duration:      string;
  category:      string;
  difficulty:    string | null;
  views:         number;
};

export default function SavedVideosPage() {
  const { t } = useI18nStore();
  const [videos,   setVideos]   = useState<Video[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState<number | null>(null);

  useEffect(() => {
    api.get('/videos/saved')
      .then(res => setVideos(res.data.videos ?? []))
      .catch(() => toast.error(t('savedVideos.error.load')))
      .finally(() => setLoading(false));
  }, []);

  const unsave = async (video: Video) => {
    setBusyId(video.id);
    const previous = videos;
    setVideos(prev => prev.filter(v => v.id !== video.id));
    try {
      await api.post(`/videos/${video.id}/save`);
      toast.success(t('savedVideos.removed'));
    } catch {
      setVideos(previous);          // put it back rather than lie about it
      toast.error(t('savedVideos.error.remove'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader
          title={t('savedVideos.title')}
          subtitle={loading ? '…' : videos.length === 1 ? t('savedVideos.countOne') : t('savedVideos.count', { n: videos.length })}
          back="/videos"
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        ) : videos.length === 0 ? (
          <EmptyState
            title={t('savedVideos.empty')}
            description={t('savedVideos.emptyHint')}
          />
        ) : (
          <div className="space-y-3">
            {videos.map(video => (
              <div key={video.id} className="flex items-center gap-3 bg-surface-raised rounded-md border border-border-subtle p-3 shadow-sm">
                <Link href={`/videos/${video.id}`} className="relative w-28 h-16 rounded-md overflow-hidden bg-surface-sunken shrink-0">
                  {video.thumbnail_url
                    ? <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Play size={18} className="text-content-tertiary" /></div>}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/videos/${video.id}`} className="block">
                    <p className="text-sm font-semibold text-content-primary truncate hover:text-accent transition-colors">{video.title}</p>
                  </Link>
                  <div className="flex items-center gap-3 text-xs text-content-tertiary mt-1">
                    <span className="flex items-center gap-1"><Clock size={11} />{video.duration}</span>
                    <span className="flex items-center gap-1"><Eye size={11} />{video.views?.toLocaleString() ?? 0}</span>
                    {video.difficulty && <span>{video.difficulty}</span>}
                  </div>
                </div>
                <button onClick={() => unsave(video)} disabled={busyId === video.id}
                  aria-label={`Remove ${video.title} from saved`}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-accent hover:bg-accent-surface transition-colors disabled:opacity-40 shrink-0">
                  {busyId === video.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Bookmark size={15} className="fill-current" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
