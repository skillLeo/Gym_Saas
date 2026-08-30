import api from './api';

export type ResourceType = 'pdf' | 'video' | 'link';

export interface ResourceCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon_name: string;
  resource_count: number;
}

export interface Resource {
  id: number;
  title: string;
  description: string | null;
  type: ResourceType;
  category: { id: number; name: string; slug: string; icon_name: string } | null;
  /** Endpoints, never file paths — the server exposes no location to guess at. */
  stream_url: string | null;
  download_url: string | null;
  external_url: string | null;
  file_size: string | null;
  duration_seconds: number | null;
  view_count: number;
  download_count: number;
  published_at: string | null;
}

export interface ResourcePage {
  data: Resource[];
  total: number;
  currentPage: number;
  lastPage: number;
}

export const TYPE_LABELS: Record<ResourceType, string> = {
  pdf: 'Documents',
  video: 'Videos',
  link: 'Links',
};

export const TYPE_ICONS: Record<ResourceType, string> = {
  pdf: 'file-text',
  video: 'video',
  link: 'link',
};

export async function fetchCategories(): Promise<ResourceCategory[]> {
  const { data } = await api.get('/resources/categories');
  return data.data ?? [];
}

export async function fetchResources(params: {
  category?: string;
  type?: ResourceType | '';
  search?: string;
  page?: number;
}): Promise<ResourcePage> {
  const { data } = await api.get('/resources', {
    params: {
      category: params.category || undefined,
      type: params.type || undefined,
      search: params.search || undefined,
      page: params.page ?? 1,
    },
  });

  return {
    data: data.data ?? [],
    total: data.meta?.total ?? 0,
    currentPage: data.meta?.current_page ?? 1,
    lastPage: data.meta?.last_page ?? 1,
  };
}

export async function fetchResource(id: number): Promise<Resource> {
  const { data } = await api.get(`/resources/${id}`);
  return data.data;
}

/**
 * Absolute URL for a stream/download endpoint.
 *
 * The API returns app-relative paths; these need the API origin, not the
 * frontend's. Auth still applies — these are not public URLs.
 */
export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  return `${base}${path}`;
}

/**
 * Fetch a protected file as a blob URL.
 *
 * The file endpoints require the Authorization header, so a plain <a href> or
 * <iframe src> would get a 401 — the browser does not attach it. Going through
 * the API client and converting to an object URL is what makes an authenticated
 * file viewable inline.
 */
export async function fetchAsBlobUrl(path: string): Promise<string> {
  const res = await api.get(path.replace(/^\/api/, ''), { responseType: 'blob' });
  return URL.createObjectURL(res.data as Blob);
}

export async function downloadResource(resource: Resource): Promise<void> {
  if (!resource.download_url) return;

  const url = await fetchAsBlobUrl(resource.download_url);
  const a = document.createElement('a');
  a.href = url;
  a.download = resource.title;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
