'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Pencil, Loader2, FileText, Video as VideoIcon, Link as LinkIcon, X,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type ResourceType = 'pdf' | 'video' | 'link';

interface Category {
  id: number; name: string; description: string | null; icon_name: string;
  sort_order: number; is_active: boolean; resources_count: number;
}

interface ResourceItem {
  id: number; title: string; description: string | null; type: ResourceType;
  category: { id: number; name: string } | null;
  is_published: boolean; published_at: string | null;
  file_size: string | null; thumbnail_url: string | null; external_url: string | null;
  view_count: number; download_count: number;
}

const TYPE_ICON: Record<ResourceType, React.ElementType> = { pdf: FileText, video: VideoIcon, link: LinkIcon };
const TYPE_LABEL: Record<ResourceType, string> = { pdf: 'PDF', video: 'Video', link: 'Link' };

const emptyForm = {
  id: null as number | null,
  title: '', description: '', category_id: '', type: 'pdf' as ResourceType,
  external_url: '', is_published: false,
};

export default function AdminResourcesPage() {
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<'resources' | 'categories'>('resources');

  const [categories, setCategories] = useState<Category[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ id: null as number | null, name: '', description: '', icon_name: 'folder', sort_order: 0 });
  const [savingCat, setSavingCat] = useState(false);

  const loadCategories = useCallback(() => {
    api.get('/admin/resource-categories').then(r => setCategories(r.data.data ?? []));
  }, []);

  const loadResources = useCallback((pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const params: Record<string, string | number> = { page: pageNum };
    if (categoryFilter) params.category_id = categoryFilter;
    if (typeFilter) params.type = typeFilter;
    api.get('/admin/resources', { params }).then(r => {
      setResources(prev => append ? [...prev, ...(r.data.data ?? [])] : (r.data.data ?? []));
      setPage(r.data.meta.current_page);
      setHasMore(r.data.meta.current_page < r.data.meta.last_page);
    }).finally(() => { setLoading(false); setLoadingMore(false); });
  }, [categoryFilter, typeFilter]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadResources(1, false); }, [loadResources]);

  const openCreate = () => { setForm(emptyForm); setFile(null); setThumbnail(null); setShowForm(true); };
  const openEdit = (r: ResourceItem) => {
    setForm({
      id: r.id, title: r.title, description: r.description ?? '',
      category_id: r.category ? String(r.category.id) : '', type: r.type,
      external_url: r.external_url ?? '', is_published: r.is_published,
    });
    setFile(null);
    setThumbnail(null);
    setShowForm(true);
  };

  const submitResource = async () => {
    if (!form.title.trim() || !form.category_id) {
      toast.error('Title and category are required.');
      return;
    }
    if (form.type === 'link' && !form.external_url.trim()) {
      toast.error('A link resource needs a URL.');
      return;
    }
    if (!form.id && form.type !== 'link' && !file) {
      toast.error(`Choose a ${form.type} file to upload.`);
      return;
    }

    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('category_id', form.category_id);
    fd.append('is_published', form.is_published ? '1' : '0');
    if (!form.id) fd.append('type', form.type);
    if (form.type === 'link') fd.append('external_url', form.external_url);
    if (file) fd.append('file', file);
    if (thumbnail) fd.append('thumbnail', thumbnail);

    setSaving(true);
    try {
      const url = form.id ? `/admin/resources/${form.id}` : '/admin/resources';
      const res = await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (form.id) {
        setResources(prev => prev.map(r => r.id === form.id ? res.data.data : r));
        toast.success('Resource updated.');
      } else {
        setResources(prev => [res.data.data, ...prev]);
        toast.success('Resource created.');
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save this resource.');
    } finally {
      setSaving(false);
    }
  };

  const removeResource = async (r: ResourceItem) => {
    if (!(await confirm({ title: `Delete "${r.title}"?`, message: 'This removes the file permanently and members will no longer be able to open it.', confirmLabel: 'Delete resource', destructive: true }))) return;
    setActingId(r.id);
    try {
      await api.delete(`/admin/resources/${r.id}`);
      setResources(prev => prev.filter(x => x.id !== r.id));
      toast.success('Resource deleted.');
    } catch {
      toast.error('Failed to delete this resource.');
    } finally {
      setActingId(null);
    }
  };

  const openCreateCat = () => { setCatForm({ id: null, name: '', description: '', icon_name: 'folder', sort_order: 0 }); setShowCatForm(true); };
  const openEditCat = (c: Category) => {
    setCatForm({ id: c.id, name: c.name, description: c.description ?? '', icon_name: c.icon_name, sort_order: c.sort_order });
    setShowCatForm(true);
  };

  const submitCategory = async () => {
    if (!catForm.name.trim()) { toast.error('Category name is required.'); return; }
    setSavingCat(true);
    try {
      const payload = { name: catForm.name, description: catForm.description || undefined, icon_name: catForm.icon_name || undefined, sort_order: catForm.sort_order };
      if (catForm.id) {
        const res = await api.put(`/admin/resource-categories/${catForm.id}`, payload);
        setCategories(prev => prev.map(c => c.id === catForm.id ? { ...c, ...res.data.data } : c));
        toast.success('Category updated.');
      } else {
        const res = await api.post('/admin/resource-categories', payload);
        setCategories(prev => [...prev, { ...res.data.data, resources_count: 0 }]);
        toast.success('Category created.');
      }
      setShowCatForm(false);
    } catch {
      toast.error('Failed to save this category.');
    } finally {
      setSavingCat(false);
    }
  };

  const removeCategory = async (c: Category) => {
    if (!(await confirm({ title: `Remove category "${c.name}"?`, message: 'Resources in this category will need to be re-filed.', confirmLabel: 'Remove category', destructive: true }))) return;
    try {
      const res = await api.delete(`/admin/resource-categories/${c.id}`);
      if (res.data.data) {
        setCategories(prev => prev.map(x => x.id === c.id ? { ...x, is_active: false } : x));
        toast(res.data.message, { icon: 'ℹ️' });
      } else {
        setCategories(prev => prev.filter(x => x.id !== c.id));
        toast.success('Category deleted.');
      }
    } catch {
      toast.error('Failed to remove this category.');
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader
          title="Resources"
          subtitle="PDFs and videos for the member library"
          back="/admin"
          actions={
            tab === 'resources'
              ? <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>Add</Button>
              : <Button size="sm" icon={<Plus size={14} />} onClick={openCreateCat}>Add</Button>
          }
        />

        <div className="flex bg-surface-sunken rounded-md p-1 mb-5">
          {(['resources', 'categories'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-md text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'resources' ? (
          <>
            <div className="flex gap-2 mb-4">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-md border border-border-strong bg-surface-raised text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                <option value="">All categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-2.5 rounded-md border border-border-strong bg-surface-raised text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                <option value="">All types</option>
                <option value="pdf">PDF</option>
                <option value="video">Video</option>
                <option value="link">Link</option>
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
            ) : resources.length === 0 ? (
              <div className="text-center py-16 text-content-tertiary text-sm">No resources yet.</div>
            ) : (
              <div className="space-y-3">
                {resources.map(r => {
                  const TypeIcon = TYPE_ICON[r.type];
                  return (
                    <Card key={r.id}>
                      <div className="p-4 flex gap-3">
                        {r.thumbnail_url ? (
                          <img src={r.thumbnail_url} alt="" className="w-16 h-16 rounded-md object-cover shrink-0 bg-surface-sunken" />
                        ) : (
                          <div className="w-16 h-16 rounded-md bg-surface-sunken flex items-center justify-center shrink-0">
                            <TypeIcon size={22} className="text-content-tertiary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-content-primary truncate">{r.title}</p>
                            <Badge variant={r.is_published ? 'success' : 'neutral'} size="sm">{r.is_published ? 'Published' : 'Draft'}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-tertiary mb-2">
                            <span className="inline-flex items-center gap-1"><TypeIcon size={11} />{TYPE_LABEL[r.type]}</span>
                            {r.category && <span>· {r.category.name}</span>}
                            {r.file_size && <span>· {r.file_size}</span>}
                            <span>· {r.view_count} views</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" icon={<Pencil size={12} />} onClick={() => openEdit(r)}>Edit</Button>
                            <Button size="sm" variant="ghost" icon={actingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              disabled={actingId === r.id} onClick={() => removeResource(r)}>Delete</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
            {hasMore && (
              <Button variant="secondary" fullWidth size="sm" className="mt-3" loading={loadingMore} onClick={() => loadResources(page + 1, true)}>
                Load more
              </Button>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {categories.length === 0 ? (
              <div className="text-center py-16 text-content-tertiary text-sm">No categories yet.</div>
            ) : categories.map(c => (
              <Card key={c.id}>
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-accent-surface flex items-center justify-center shrink-0">
                    <Icon name={c.icon_name || 'folder'} size="sm" className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-content-primary truncate">{c.name}</p>
                      {!c.is_active && <Badge variant="neutral" size="sm">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-content-tertiary">{c.resources_count} resource{c.resources_count === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEditCat(c)} className="w-8 h-8 flex items-center justify-center rounded-md text-content-tertiary hover:text-accent hover:bg-accent-surface transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => removeCategory(c)} className="w-8 h-8 flex items-center justify-center rounded-md text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Resource create/edit sheet */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-surface-raised rounded-t-3xl sm:rounded-md p-6 z-10 border border-border-subtle">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-xl font-bold text-content-primary">{form.id ? 'Edit Resource' : 'New Resource'}</h3>
                <button onClick={() => setShowForm(false)} className="text-content-tertiary hover:text-content-primary"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                {!form.id && (
                  <div>
                    <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['pdf', 'video', 'link'] as ResourceType[]).map(t => (
                        <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                          className={`py-2.5 rounded-md text-xs font-semibold border-2 transition-all ${form.type === t ? 'border-accent bg-accent-surface text-accent' : 'border-border-strong text-content-secondary'}`}>
                          {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Title</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Resource title"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this resource covers"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Category</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                    <option value="">Select a category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {form.type === 'link' ? (
                  <div>
                    <label className="text-sm font-semibold text-content-secondary mb-1.5 block">URL</label>
                    <input value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} placeholder="https://..."
                      className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-semibold text-content-secondary mb-1.5 block">
                      {form.type === 'pdf' ? 'PDF file' : 'Video file'} {form.id && <span className="text-content-tertiary font-normal">(optional — replaces existing)</span>}
                    </label>
                    <input type="file" accept={form.type === 'pdf' ? '.pdf' : '.mp4,.webm,.mov'}
                      onChange={e => setFile(e.target.files?.[0] ?? null)}
                      className="w-full text-sm text-content-secondary file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-accent-surface file:text-accent file:text-xs file:font-semibold" />
                  </div>
                )}
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">
                    Thumbnail <span className="text-content-tertiary font-normal">(optional)</span>
                  </label>
                  <input type="file" accept="image/*" onChange={e => setThumbnail(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-content-secondary file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-accent-surface file:text-accent file:text-xs file:font-semibold" />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span id="resource-published-label" className="text-sm font-medium text-content-primary">Published</span>
                  {/* A bare <button> here announced nothing and reported no
                      state, so its on/off position was invisible to a screen
                      reader — and to anything else asking the page what it is.
                      This switch decides whether members can see the resource at
                      all, which makes it the least safe control to leave
                      unlabelled. */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_published}
                    aria-labelledby="resource-published-label"
                    onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.is_published ? 'bg-accent' : 'bg-surface-sunken border border-border-strong'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" fullWidth onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button fullWidth onClick={submitResource} loading={saving}>{form.id ? 'Save Changes' : 'Create'}</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category create/edit sheet */}
        {showCatForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCatForm(false)} />
            <div className="relative w-full sm:max-w-md bg-surface-raised rounded-t-3xl sm:rounded-md p-6 z-10 border border-border-subtle">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-xl font-bold text-content-primary">{catForm.id ? 'Edit Category' : 'New Category'}</h3>
                <button onClick={() => setShowCatForm(false)} className="text-content-tertiary hover:text-content-primary"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Name</label>
                  <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nutrition Guides"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Description</label>
                  <input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional"
                    className="w-full px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-content-secondary mb-1.5 block">Icon name</label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-md bg-accent-surface flex items-center justify-center shrink-0">
                      <Icon name={catForm.icon_name || 'folder'} size="sm" className="text-accent" />
                    </div>
                    <input value={catForm.icon_name} onChange={e => setCatForm(f => ({ ...f, icon_name: e.target.value }))} placeholder="folder"
                      className="flex-1 px-4 py-3 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
                  </div>
                  <p className="text-xs text-content-tertiary mt-1">A Lucide icon name, e.g. &quot;book-open&quot;, &quot;file-text&quot;, &quot;video&quot;.</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" fullWidth onClick={() => setShowCatForm(false)}>Cancel</Button>
                  <Button fullWidth onClick={submitCategory} loading={savingCat}>{catForm.id ? 'Save Changes' : 'Create'}</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
