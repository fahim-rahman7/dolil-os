const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public errors?: Record<string, string>,
  ) {
    super(message);
  }
}

const NETWORK_MESSAGE = 'Could not reach the server. Check your connection and try again.';

export function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('dolil_token');
  } catch {
    return null;
  }
}
export function setSession(token: string, user: unknown) {
  localStorage.setItem('dolil_token', token);
  localStorage.setItem('dolil_user', JSON.stringify(user));
}
export function clearSession() {
  try {
    localStorage.removeItem('dolil_token');
    localStorage.removeItem('dolil_user');
  } catch {
    /* ignore */
  }
}

async function raw(path: string, options: RequestInit = {}) {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0, 'NETWORK');
  }
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    clearSession();
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.assign('/login');
  }
  return res;
}

export interface Page<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; pages: number };
}

/** Returns the `data` field of the API envelope. */
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  return (await apiPage<T>(path, options)).data;
}

/** Returns data plus pagination meta. */
export async function apiPage<T = any>(path: string, options: RequestInit = {}): Promise<Page<T>> {
  const res = await raw(path, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.message || 'Request failed. Please try again.', res.status, body?.code, body?.errors);
  }
  return { data: body?.data as T, meta: body?.meta };
}

export async function fetchBlob(path: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string | null }> {
  const res = await raw(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message || 'Download failed. Please try again.', res.status, body?.code);
  }
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return { blob: await res.blob(), filename: m ? decodeURIComponent(m[1]) : null };
}

export async function download(path: string, fallbackName: string) {
  const { blob, filename } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openInline(path: string) {
  const { blob } = await fetchBlob(path);
  window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

export const qs = (params: Record<string, unknown>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
};

// ---------- formatting (BDT, Asia/Dhaka) ----------
export const TZ = 'Asia/Dhaka';
export const bdt = (v: unknown) =>
  `৳ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))}`;
export const fmtDate = (v?: string | Date | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (v?: string | Date | null) =>
  v ? new Date(v).toLocaleString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const isoDate = (v?: string | Date | null) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
