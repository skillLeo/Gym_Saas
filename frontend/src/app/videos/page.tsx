'use client';
import { useState, useEffect, useCallback } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/lib/api';
import { Play, Clock, Eye, Heart, Search, X, BookmarkPlus, Bookmark, Dumbbell, ChevronRight, Loader2, Star} from 'lucide-react';
import toast from 'react-hot-toast';
import { ImageWithFallback } from '@/components/ui/RecipeImage';

const DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const diffStyle: Record<string, string> = {
  Beginner:     'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400',
  Intermediate: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-400',
  Advanced:     'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400',
};

type Video = {
  id:             number;
  title:          string;
  description:    string | null;
  video_url:      string | null;
  thumbnail_url:  string | null;
  duration:       string;
  duration_seconds: number;
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

export default function VideosPage() {
  const { t } = useI18nStore();
  const [videos,     setVideos]     = useState<Video[]>([]);
  const [featured,   setFeatured]   = useState<Video | null>(null);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [muscleGroups, setMuscleGroups] = useState<string[]>(['All']);
  const [loading,    setLoading]    = useState(true);
  const [category,   setCategory]   = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [muscleGroup, setMuscleGroup] = useState('All');
  const [search,     setSearch]     = useState('');

  const fetchVideos = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search)                       params.search       = search;
      if (category    !== 'All')        params.category     = category;
      if (difficulty  !== 'All')        params.difficulty   = difficulty;
      if (muscleGroup !== 'All')        params.muscle_group = muscleGroup;

      const res = await api.get('/videos', { params });
      setVideos(res.data.videos);
      setFeatured(res.data.featured);
      setCategories(['All', ...(res.data.categories ?? [])]);
      setMuscleGroups(['All', ...(res.data.muscle_groups ?? [])]);
    } catch {
      toast.error(t('videos.error.load'));
    } finally {
      setLoading(false);
    }
  }, [search, category, difficulty, muscleGroup]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const toggleSave = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    setVideos(prev => prev.map(v => v.id === id ? { ...v, is_saved: !v.is_saved } : v));
    if (featured?.id === id) setFeatured(f => f ? { ...f, is_saved: !f.is_saved } : f);
    try {
      await api.post(`/videos/${id}/save`);
    } catch {
      setVideos(prev => prev.map(v => v.id === id ? { ...v, is_saved: !v.is_saved } : v));
      if (featured?.id === id) setFeatured(f => f ? { ...f, is_saved: !f.is_saved } : f);
    }
  };

  const totalViews = videos.reduce((a, v) => a + v.views, 0);
  const totalLikes = videos.reduce((a, v) => a + v.likes, 0);

  return (
    <DashboardShell>
      <div>

        {/* ── Hero ── */}
        {/* Decorative hero stripped per §1.1: a 3-stop gradient, a hotlinked
            Unsplash background, two blurred glow orbs and a dot-grid overlay.
            Replaced with the standard PageHeader plus a plain stats row. */}
        <PageHeader title={t('videos.title')} subtitle={t('videos.subtitle')}
          actions={
            /* Until now the bookmark on every card led nowhere — /videos/saved
               existed on the server but nothing in the app linked to it. */
            <Link href="/videos/saved" aria-label={t('videos.saved')}
              className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-accent hover:bg-surface-sunken transition-colors">
              <Bookmark size={20} strokeWidth={1.75} />
            </Link>
          }
        />

        <div className="relative overflow-hidden">
          <div className="relative z-10 pt-2 pb-6 max-w-5xl">
            <p className="text-body text-content-secondary max-w-md mb-6">
              {t('videos.intro')}
            </p>
            <div className="flex flex-wrap items-center gap-5 text-sm">
              <div className="flex items-center gap-2 text-content-tertiary">
                <div className="w-8 h-8 rounded-md bg-[#FF0404]/20 flex items-center justify-center">
                  <Dumbbell size={15} className="text-brand-red" />
                </div>
                <div>
                  <p className="font-bold text-content-primary text-base">{videos.length}</p>
                  <p className="text-[10px] text-content-tertiary uppercase tracking-wider">{t('videos.count')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-content-tertiary">
                <div className="w-8 h-8 rounded-md bg-accent/20 flex items-center justify-center">
                  <Eye size={15} className="text-accent" />
                </div>
                <div>
                  <p className="font-bold text-content-primary text-base">{totalViews >= 1000 ? `${(totalViews/1000).toFixed(0)}K+` : totalViews}</p>
                  <p className="text-[10px] text-content-tertiary uppercase tracking-wider">{t('videos.views')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-content-tertiary">
                <div className="w-8 h-8 rounded-md bg-surface-sunken flex items-center justify-center">
                  <Heart size={15} className="text-content-secondary" />
                </div>
                <div>
                  <p className="font-bold text-content-primary text-base">{totalLikes.toLocaleString()}</p>
                  <p className="text-[10px] text-content-tertiary uppercase tracking-wider">{t('videos.likes')}</p>
                </div>
              </div>
              <Link href="/live"
                className="ml-auto flex items-center gap-2 bg-[#FF0404] hover:bg-[#cc0000] text-white text-sm font-bold px-4 py-2 rounded-md transition-colors">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {t('videos.watchLive')}
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">

          {/* ── Filters ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('videos.search')}
                className="w-full pl-10 pr-9 py-2.5 bg-surface-raised border border-border-strong rounded-md text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary">
                  <X size={13} />
                </button>
              )}
            </div>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
              className="px-4 py-2.5 bg-surface-raised border border-border-strong rounded-md text-sm text-content-secondary dark:text-white outline-none focus-visible:border-accent transition-colors cursor-pointer">
              {DIFFICULTIES.map(d => (
                <option key={d} value={d}>
                  {d === 'All' ? t('videos.all')
                    : d === 'Beginner' ? t('videos.level.beginner')
                    : d === 'Intermediate' ? t('videos.level.intermediate')
                    : t('videos.level.advanced')}
                </option>
              ))}
            </select>
            <select value={muscleGroup} onChange={e => setMuscleGroup(e.target.value)}
              className="px-4 py-2.5 bg-surface-raised border border-border-strong rounded-md text-sm text-content-secondary dark:text-white outline-none focus-visible:border-accent transition-colors cursor-pointer">
              {muscleGroups.map(m => <option key={m} value={m}>{m === 'All' ? t('videos.allMuscles') : m}</option>)}
            </select>
          </div>

          {/* ── Category chips ── */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all whitespace-nowrap
                  ${category === cat
                    ? 'bg-[#FF0404] text-white border-[#FF0404]'
                    : 'bg-surface-raised text-content-secondary border-border-strong hover:border-[#FF0404] hover:text-brand-red'}`}
              >
                {cat === 'All' ? t('videos.category.all') : cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={36} className="animate-spin text-brand-red" />
            </div>
          ) : (
            <>
              {/* ── Featured ── */}
              {category === 'All' && !search && featured && (
                <section className="mb-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-accent flex items-center justify-center shadow-sm">
                        <Star size={9} className="text-white fill-white" />
                      </div>
                      <h2 className="text-lg font-bold text-content-primary">{t('videos.featured')}</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {videos.filter(v => v.is_featured).map(v => (
                      <VideoCard key={v.id} video={v} onSave={toggleSave} featured />
                    ))}
                  </div>
                </section>
              )}

              {/* ── All / filtered ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-content-primary">
                    {category === 'All' && !search ? t('videos.allVideos') : (
                      <>{videos.length === 1 ? t('videos.resultCountOne') : t('videos.resultCount', { count: videos.length })}
                        {category !== 'All' && <span className="text-accent"> — {category}</span>}
                      </>
                    )}
                  </h2>
                  {(difficulty !== 'All' || search) && (
                    <button onClick={() => { setDifficulty('All'); setSearch(''); }}
                      className="text-xs text-content-tertiary hover:text-brand-red flex items-center gap-1 transition-colors">
                      <X size={11} /> {t('videos.clearFilters')}
                    </button>
                  )}
                </div>

                {videos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                      <Dumbbell size={28} className="text-content-tertiary dark:text-content-secondary" />
                    </div>
                    <p className="font-semibold text-content-secondary">{t('videos.empty')}</p>
                    <p className="text-sm text-content-tertiary mt-1">{t('videos.emptyHint')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {videos.map(v => (
                      <VideoCard key={v.id} video={v} onSave={toggleSave} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function VideoCard({ video, onSave, featured = false }: {
  video: Video;
  onSave: (id: number, e: React.MouseEvent) => void;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/videos/${video.id}`}
      className={`group block bg-surface-raised rounded-md overflow-hidden border border-border-subtle hover:border-accent/40 hover: hover: transition-all duration-300 ${featured ? 'ring-1 ring-accent/10' : ''}`}
    >
      <div className="relative overflow-hidden" style={{ height: featured ? 200 : 176 }}>
        {video.thumbnail_url ? (
          <ImageWithFallback src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <Dumbbell size={32} className="text-content-tertiary" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={22} className="text-white fill-white ml-1" />
          </div>
        </div>

        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
          <Clock size={9} />
          {video.duration}
        </div>

        <div className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${diffStyle[video.difficulty] ?? ''}`}>
          {video.difficulty}
        </div>

        <button onClick={(e) => onSave(video.id, e)}
          className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all ${video.is_saved ? 'bg-accent text-white' : 'bg-black/40 text-white hover:bg-accent'}`}>
          {video.is_saved ? <Bookmark size={14} className="fill-white" /> : <BookmarkPlus size={14} />}
        </button>
      </div>

      <div className="p-4">
        <div className="text-[10px] font-bold text-brand-red uppercase tracking-wider mb-1.5">{video.category}</div>
        <h3 className="font-bold text-sm text-content-primary leading-tight mb-2 line-clamp-2 group-hover:text-accent transition-colors">
          {video.title}
        </h3>
        <div className="flex flex-wrap gap-1 mb-3">
          {(video.muscle_groups ?? []).slice(0, 3).map(m => (
            <span key={m} className="text-[10px] bg-surface-sunken text-content-secondary px-2 py-0.5 rounded-full">{m}</span>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-content-tertiary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Eye size={10} /> {video.views >= 1000 ? `${(video.views/1000).toFixed(1)}K` : video.views}</span>
            <span className="flex items-center gap-1"><Heart size={10} /> {video.likes}</span>
          </div>
          {video.instructor && <span className="text-content-secondary truncate max-w-[100px]">{video.instructor}</span>}
        </div>
      </div>
    </Link>
  );
}
