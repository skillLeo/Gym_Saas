'use client';
import { useState, useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/lib/api';
import {
  Play, Clock, Eye, Heart, BookmarkPlus, Bookmark, Share2, ChevronLeft,
  Dumbbell, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const diffStyle: Record<string, string> = {
  Beginner:     'text-green-600 bg-green-50 border-green-200',
  Intermediate: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Advanced:     'text-red-600 bg-red-50 border-red-200',
};

type Video = {
  id:             number;
  title:          string;
  description:    string | null;
  video_url:      string | null;
  thumbnail_url:  string | null;
  duration:       string;
  category:       string;
  tags:           string[];
  muscle_groups:  string[];
  equipment:      string[];
  difficulty:     string;
  instructor:     string | null;
  views:          number;
  likes:          number;
  is_featured:    boolean;
  is_saved:       boolean;
};

export default function VideoDetailClient() {
  const { t } = useI18nStore();
  const router  = useRouter();
  const params  = useParams();
  const videoId = params?.videoId as string;

  const [video,     setVideo]     = useState<Video | null>(null);
  const [related,   setRelated]   = useState<Video[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [playing,   setPlaying]   = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [liked,     setLiked]     = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!videoId) return;
    api.get(`/videos/${videoId}`).then(res => {
      const v = res.data.video;
      setVideo(v);
      setSaved(v.is_saved);
      setLikeCount(v.likes);
      // fetch related (same category)
      return api.get('/videos', { params: { category: v.category } });
    }).then(res => {
      setRelated((res.data.videos as Video[]).filter(v => v.id !== Number(videoId)).slice(0, 4));
    }).catch(() => {
      toast.error(t('videoDetail.notFound'));
    }).finally(() => setLoading(false));
  }, [videoId]);

  const handleSave = async () => {
    setSaved(s => !s);
    try { await api.post(`/videos/${videoId}/save`); } catch { setSaved(s => !s); }
  };

  const handleLike = () => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex-1 flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      </DashboardShell>
    );
  }

  if (!video) {
    return (
      <DashboardShell>
        <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8 text-center">
          <div className="w-16 h-16 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <Dumbbell size={28} className="text-content-tertiary" />
          </div>
          <p className="font-bold text-content-primary">{t('videoDetail.notFound')}</p>
          <Link href="/videos" className="text-accent text-sm font-semibold hover:underline">← Back to library</Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div>
        <div className="max-w-6xl mx-auto w-full">

          <PageHeader title={video.title} subtitle={video.category} back="/videos" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {/* Video player */}
              <div className="relative rounded-md overflow-hidden bg-black aspect-video mb-5">
                {video.video_url && playing ? (
                  <iframe
                    src={`${video.video_url}?autoplay=1`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay"
                  />
                ) : (
                  <>
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                        <Dumbbell size={48} className="text-content-secondary" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <button onClick={() => setPlaying(true)}
                        className="w-20 h-20 rounded-full bg-accent flex items-center justify-center hover:bg-accent-hover transition-all hover:scale-105 active:scale-95">
                        <Play size={32} className="text-white fill-white ml-2" />
                      </button>
                    </div>
                    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                      <Clock size={10} /> {video.duration}
                    </div>
                  </>
                )}
              </div>

              {/* Title + actions */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold text-brand-red uppercase tracking-wider">{video.category}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffStyle[video.difficulty] ?? ''}`}>{video.difficulty}</span>
                </div>
                <h1 className="font-display text-2xl md:text-3xl font-black text-content-primary leading-tight mb-4">
                  {video.title}
                </h1>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 text-sm text-content-secondary">
                    <span className="flex items-center gap-1.5"><Eye size={14} /> {video.views.toLocaleString()} views</span>
                    <span className="flex items-center gap-1.5"><Heart size={14} /> {t('videoDetail.likes', { n: likeCount.toLocaleString() })}</span>
                    {video.instructor && <span className="text-accent font-medium">{video.instructor}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleLike}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold border transition-all ${liked ? 'bg-[#FF0404] text-white border-[#FF0404]' : 'bg-white dark:bg-white/5 text-content-secondary border-border-strong hover:border-[#FF0404] hover:text-brand-red'}`}>
                      <Heart size={14} className={liked ? 'fill-white' : ''} /> {liked ? t('social.liked') : t('common.like')}
                    </button>
                    <button onClick={handleSave}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold border transition-all ${saved ? 'bg-accent text-white border-accent' : 'bg-white dark:bg-white/5 text-content-secondary border-border-strong hover:border-accent hover:text-accent'}`}>
                      {saved ? <Bookmark size={14} className="fill-white" /> : <BookmarkPlus size={14} />}
                      {saved ? t('common.saved') : t('common.save')}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success(t('videoDetail.linkCopied')); }}
                      className="w-9 h-9 flex items-center justify-center rounded-md bg-white dark:bg-white/5 border border-border-strong hover:border-accent text-content-secondary hover:text-accent transition-all">
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              {video.description && (
                <div className="bg-surface-raised rounded-md border border-border-subtle p-5 mb-5">
                  <h3 className="font-semibold text-content-primary mb-2">{t('videoDetail.about')}</h3>
                  <p className="text-sm text-content-secondary leading-relaxed">{video.description}</p>
                </div>
              )}

              {/* Tags */}
              {video.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {video.tags.map(tag => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-full bg-surface-sunken text-content-secondary">#{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Details */}
              <div className="bg-surface-raised rounded-md border border-border-subtle p-5">
                <h3 className="font-semibold text-content-primary mb-4">{t('videoDetail.details')}</h3>
                <div className="space-y-3">
                  {[
                    { label: t('videoDetail.duration'),   val: video.duration },
                    { label: t('videoDetail.difficulty'), val: video.difficulty },
                    { label: t('videoDetail.category'),   val: video.category },
                    ...(video.instructor ? [{ label: t('videoDetail.instructor'), val: video.instructor }] : []),
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-content-secondary">{label}</span>
                      <span className="font-medium text-content-primary">{val}</span>
                    </div>
                  ))}
                </div>
                {video.muscle_groups.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <p className="text-xs font-medium text-content-secondary mb-2">{t('videoDetail.muscles')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {video.muscle_groups.map(m => (
                        <span key={m} className="text-xs bg-accent-surface text-accent px-2.5 py-0.5 rounded-full font-medium">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {video.equipment.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <p className="text-xs font-medium text-content-secondary mb-2">{t('videoDetail.equipment')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {video.equipment.map(e => (
                        <span key={e} className="text-xs bg-surface-sunken text-content-secondary px-2.5 py-0.5 rounded-full">{e}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Related */}
              {related.length > 0 && (
                <div className="bg-surface-raised rounded-md border border-border-subtle overflow-hidden">
                  <div className="px-5 py-4 border-b border-border-subtle">
                    <h3 className="font-semibold text-content-primary">{t('videoDetail.related')}</h3>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {related.map(v => (
                      <Link key={v.id} href={`/videos/${v.id}`}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors group">
                        <div className="w-20 h-14 rounded-md overflow-hidden bg-gray-100 dark:bg-white/5 flex-shrink-0">
                          {v.thumbnail_url ? (
                            <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Dumbbell size={16} className="text-content-tertiary" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-content-primary line-clamp-2 group-hover:text-accent transition-colors">{v.title}</p>
                          <p className="text-[10px] text-content-tertiary mt-0.5">{v.duration} · {v.difficulty}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
