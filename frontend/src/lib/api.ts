export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'ApiError'; }
}
const API_URL = (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';
let csrfToken: string | undefined;
let csrfRequest: Promise<string> | undefined;

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfRequest ??= fetch(`${API_URL}/auth/csrf`, { credentials: 'include' }).then(async r => {
    if (!r.ok) throw new ApiError(r.status, 'CSRF_UNAVAILABLE', 'নিরাপদ সংযোগ তৈরি হয়নি। আবার চেষ্টা করুন।');
    const body = await r.json() as { data: { csrfToken: string } };
    csrfToken = body.data.csrfToken; return csrfToken;
  }).finally(() => { csrfRequest = undefined; });
  return csrfRequest;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) headers.set('X-CSRF-Token', await getCsrf());
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' }); }
  catch { throw new ApiError(0, 'NETWORK_ERROR', 'সার্ভারের সঙ্গে সংযোগ পাওয়া যাচ্ছে না। ইন্টারনেট পরীক্ষা করুন; Render Free service চালু হতে কিছু সময় লাগতে পারে।'); }
  const body = await response.json().catch(() => ({})) as { data?: T; error?: { code: string; message: string } };
  if (!response.ok) {
    if (response.status === 403 && body.error?.code.includes('CSRF')) csrfToken = undefined;
    throw new ApiError(response.status, body.error?.code || 'REQUEST_FAILED', body.error?.message || 'অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।');
  }
  if (path === '/auth/login' || path === '/auth/logout') csrfToken = undefined;
  return body.data as T;
}

export const post = <T>(path: string, body: unknown, key?: string) => api<T>(path, { method: 'POST', body: JSON.stringify(body), ...(key ? { headers: { 'Idempotency-Key': key } } : {}) });

export function money(value: string | number | bigint | undefined | null): string {
  if (value === undefined || value === null) return '—';
  try {
    const n = BigInt(value); const sign = n < 0n ? '-' : ''; const v = n < 0n ? -n : n;
    return `${sign}৳${(v / 100n).toLocaleString('en-BD')}${v % 100n ? `.${(v % 100n).toString().padStart(2, '0')}` : ''}`;
  } catch { return '—'; }
}
export function parseMoney(value: string): string {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) throw new Error('সঠিক টাকার পরিমাণ লিখুন (সর্বোচ্চ ২ দশমিক)।');
  const [whole, decimal = ''] = value.split('.'); return (BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'))).toString();
}
export function date(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value));
}
