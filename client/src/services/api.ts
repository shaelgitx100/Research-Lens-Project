import type { ApiError } from '../types';
import { readSession } from './storage';

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly details?: unknown) {
    super(message); this.name = 'ApiRequestError';
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${apiBase}/api${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers });
  const body = await response.text();
  let data: unknown;
  try { data = body ? JSON.parse(body) : undefined; } catch { data = undefined; }
  if (!response.ok) {
    const problem = data as ApiError | undefined;
    throw new ApiRequestError(problem?.error ?? `Request failed (${response.status}).`, response.status, problem?.details);
  }
  if (body && data === undefined) throw new ApiRequestError('The server returned invalid JSON.', response.status);
  return data as T;
}

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, init, readSession()?.token);
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T = void>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  },
  put<T = void>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  },
  patch<T = void>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  },
  del<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
  upload<T>(path: string, body: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', body });
  },
};

export function qs(params: Record<string, string | number | boolean | string[] | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}
