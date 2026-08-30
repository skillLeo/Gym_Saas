'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Search, Trash2, Eye, Heart, Upload, X,
  PlayCircle, Check, Clock, Dumbbell, Image, Loader2
} from 'lucide-react';
import { ImageWithFallback } from '@/components/ui/RecipeImage';

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

const diffStyle: Record<string, string> = {
  Beginner:     'text-green-600 bg-green-50 border-green-200',
  Intermediate: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Advanced:     'text-red-600 bg-red-50 border-red-200'
};

type Video = {
  id:            number;
  title:         string;
  category:      string;
  muscle_groups: string[];
  difficulty:    string;
  duration:      string;
  views:         number;
  likes:         number;
  thumbnail_url: string | null;
};

export default function AdminVideosPage() {
  const [videos,        setVideos]        = useState<Video[]>([]);
  const [categories,    setCategories]    = useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [catFilter,     setCatFilter]     = useState('All');
  const [showUpload,    setShowUpload]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [thumbPreview,  setThumbPreview]  = useState('');
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '', category: 'Chest', difficulty: 'Beginner',
    duration: '', equipment: '', description: '',
    video_url: '', thumbnail_url: ''
  });

  const fetchVideos = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (catFilter !== 'All') params.category = catFilter;
      const res = await api.get('/videos', { params });
      setVideos(res.data.videos ?? []);
      if (res.data.categories) setCategories(['All', ...(res.data.categories as string[])]);
    } catch { toast.error('Failed to load videos'); }
  }, [search, catFilter]);

  /**
   * One effect, not two — same fix as admin/recipes. The old second effect was
   * guarded by `if (!loading)` with `loading` absent from its deps, so it read a
   * stale value and whether a filter change refetched depended on render timing.
   * `fetchVideos` is a useCallback keyed on [search, catFilter], so depending on
   * it covers the initial load and every filter change.
   */
  useEffect(() => {
    let cancelled = false;
    fetchVideos().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchVideos]);

  const handleThumbSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'videos');
      const res = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setThumbPreview(res.data.image_url);
      setForm(f => ({ ...f, thumbnail_url: res.data.image_url }));
    } catch {
      toast.error('Failed to upload thumbnail');
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      const res = await api.post('/videos', {
        title:          form.title,
        category:       form.category,
        difficulty:     form.difficulty,
        duration_seconds: (Number.isFinite(parseInt(form.duration)) && parseInt(form.duration) > 0) ? parseInt(form.duration) * 60 : 600,
        equipment:      form.equipment ? form.equipment.split(',').map(s => s.trim()) : [],
        description:    form.description || null,
        video_url:      form.video_url || null,
        thumbnail_url:  form.thumbnail_url || null,
        instructor:     'Kelvin Silas',
        muscle_groups:  [form.category],
        tags:           [form.category.toLowerCase()],
        is_featured:    false
      });
      setVideos(prev => [res.data.video, ...prev]);
      setForm({ title: '', category: 'Chest', difficulty: 'Beginner', duration: '', equipment: '', description: '', video_url: '', thumbnail_url: '' });
      setThumbPreview('');
      if (thumbInputRef.current) thumbInputRef.current.value = '';
      setShowUpload(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch { toast.error('Failed to upload video'); }
  };

  const handleDelete = async (id: number) => {
    setVideos(prev => prev.filter(v => v.id !== id));
    setDeleteConfirm(null);
    try { await api.delete(`/videos/${id}`); } catch { fetchVideos(); }
  };

  const totalViews = videos.reduce((a, v) => a + (v.views ?? 0), 0);
  const totalLikes = videos.reduce((a, v) => a + (v.likes ?? 0), 0);

  return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto w-full">

        <PageHeader
          title="Video Library"
          subtitle={`${videos.length} video${videos.length !== 1 ? 's' : ''}`}
          back="/admin"
          actions={
            <Button
              size="sm"
              onClick={() => setShowUpload(true)}
              icon={<Upload size={15} strokeWidth={2} />}
            >
              Upload
            </Button>
          }
        />

        {uploadSuccess && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-md px-4 py-3 mb-5 text-sm font-medium">
            <Check size={16} className="text-green-500" /> Video uploaded successfully!
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Videos', value: videos.length,               icon: PlayCircle, color: 'text-accent bg-accent-surface' },
            { label: 'Total Views',  value: totalViews.toLocaleString(), icon: Eye,        color: 'text-blue-500 bg-blue-50' },
            { label: 'Total Likes',  value: totalLikes.toLocaleString(), icon: Heart,      color: 'text-brand-red bg-red-50' },
            { label: 'Categories',   value: Math.max(0, categories.length - 1), icon: Dumbbell, color: 'text-purple-500 bg-purple-50' },
          ].map(s => (
            <div key={s.label} className="bg-surface-raised rounded-md border border-border-subtle p-4 shadow-sm">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon size={18} />
              </div>
              <p className="text-2xl font-black text-content-primary">{s.value}</p>
              <p className="text-xs text-content-tertiary mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search videos..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-border-strong rounded-md text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent transition-colors" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface-raised border border-border-strong rounded-md text-sm text-content-secondary dark:text-white outline-none focus-visible:border-accent cursor-pointer">
            {(categories.length > 0 ? categories : ['All']).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="bg-surface-raised rounded-md border border-border-subtle shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left px-5 py-3.5 text-xs font-bold text-content-tertiary uppercase tracking-wider">Video</th>
                      <th className="text-left px-4 py-3.5 text-xs font-bold text-content-tertiary uppercase tracking-wider">Category</th>
                      <th className="text-left px-4 py-3.5 text-xs font-bold text-content-tertiary uppercase tracking-wider">Difficulty</th>
                      <th className="text-left px-4 py-3.5 text-xs font-bold text-content-tertiary uppercase tracking-wider">Duration</th>
                      <th className="text-right px-4 py-3.5 text-xs font-bold text-content-tertiary uppercase tracking-wider">Views</th>
                      <th className="text-right px-5 py-3.5 text-xs font-bold text-content-tertiary uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {videos.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50/60 dark:hover:bg-white/3 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900">
                              {v.thumbnail_url ? (
                                <ImageWithFallback src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><PlayCircle size={14} className="text-content-secondary" /></div>
                              )}
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <PlayCircle size={12} className="text-white" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-content-primary truncate max-w-[200px]">{v.title}</p>
                              <p className="text-[11px] text-content-tertiary mt-0.5">{(v.muscle_groups ?? []).slice(0, 2).join(', ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-content-secondary bg-surface-sunken px-2.5 py-1 rounded-full">{v.category}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${diffStyle[v.difficulty] ?? ''}`}>{v.difficulty}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1 text-sm text-content-secondary"><Clock size={12} /> {v.duration}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-content-secondary">{(v.views ?? 0).toLocaleString()}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => setDeleteConfirm(v.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-red-50 hover:text-brand-red transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {videos.length === 0 && <div className="py-16 text-center text-content-tertiary">No videos match your filters.</div>}
              </div>

              <div className="md:hidden divide-y divide-gray-50 dark:divide-white/5">
                {videos.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="relative w-16 h-11 rounded-md overflow-hidden flex-shrink-0 bg-gray-900">
                      {v.thumbnail_url ? <ImageWithFallback src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-content-primary truncate">{v.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${diffStyle[v.difficulty] ?? ''}`}>{v.difficulty}</span>
                        <span className="text-[10px] text-content-tertiary">{v.category}</span>
                        <span className="text-[10px] text-content-tertiary flex items-center gap-0.5"><Eye size={9} />{v.views}</span>
                      </div>
                    </div>
                    <button onClick={() => setDeleteConfirm(v.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-content-tertiary hover:text-brand-red transition-colors"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Upload modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
            <div className="bg-surface-raised rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                <div>
                  <h2 className="font-bold text-content-primary text-lg">Add New Video</h2>
                  <p className="text-xs text-content-tertiary mt-0.5">Add a new exercise tutorial to the library</p>
                </div>
                <button onClick={() => setShowUpload(false)} className="w-8 h-8 rounded-md bg-surface-sunken flex items-center justify-center text-content-secondary hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Video Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Barbell Squat — Complete Guide"
                    className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 placeholder:text-content-tertiary outline-none focus-visible:border-accent transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Category</label>
                    <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Chest"
                      className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 outline-none focus-visible:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Difficulty</label>
                    <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 outline-none focus-visible:border-accent cursor-pointer">
                      {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Duration (min)</label>
                    <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 12"
                      className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 placeholder:text-content-tertiary outline-none focus-visible:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Equipment</label>
                    <input value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} placeholder="Barbell, Bench"
                      className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 placeholder:text-content-tertiary outline-none focus-visible:border-accent" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Video URL (YouTube embed or direct)</label>
                  <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://www.youtube.com/embed/..."
                    className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 placeholder:text-content-tertiary outline-none focus-visible:border-accent" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Thumbnail Image</label>
                  {thumbPreview ? (
                    <div className="relative rounded-md overflow-hidden border border-border-strong">
                      <img src={thumbPreview} alt="Thumbnail" className="w-full h-36 object-cover" />
                      <button type="button" onClick={() => { setThumbPreview(''); setForm(f => ({ ...f, thumbnail_url: '' })); if (thumbInputRef.current) thumbInputRef.current.value = ''; }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-[#FF0404] transition-colors"><X size={13} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => thumbInputRef.current?.click()} disabled={uploadingThumb}
                      className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 border-2 border-dashed border-border-strong rounded-md hover:border-accent/50 transition-all group cursor-pointer disabled:opacity-60">
                      <div className="w-10 h-10 rounded-md bg-surface-sunken flex items-center justify-center group-hover:bg-accent-surface transition-colors">
                        {uploadingThumb ? <Loader2 size={18} className="text-accent animate-spin" /> : <Image size={18} className="text-content-tertiary group-hover:text-accent" />}
                      </div>
                      <p className="text-sm font-semibold text-content-secondary group-hover:text-accent transition-colors">
                        {uploadingThumb ? 'Uploading...' : 'Click to select thumbnail'}
                      </p>
                    </button>
                  )}
                  <input ref={thumbInputRef} type="file" accept="image/*" onChange={handleThumbSelect} className="hidden" disabled={uploadingThumb} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase tracking-wide">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the exercise..."
                    className="w-full px-4 py-2.5 border border-border-strong rounded-md text-sm text-content-primary bg-white dark:bg-white/5 placeholder:text-content-tertiary outline-none focus-visible:border-accent resize-none" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowUpload(false)}
                    className="flex-1 py-2.5 rounded-md border border-border-strong text-sm font-semibold text-content-secondary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
                  <button type="submit"
                    className="flex-1 py-2.5 rounded-md bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors flex items-center justify-center gap-2">
                    <Upload size={14} /> Save Video
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-raised rounded-md w-full max-w-sm p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-brand-red" /></div>
              <h3 className="font-bold text-content-primary text-lg mb-2">Delete Video?</h3>
              <p className="text-sm text-content-secondary mb-6">This will remove the video from the library.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-md border border-border-strong text-sm font-semibold text-content-secondary hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-md bg-[#FF0404] text-white text-sm font-bold hover:bg-red-600 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
