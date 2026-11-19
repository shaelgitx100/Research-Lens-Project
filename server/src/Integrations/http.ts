import { AppError } from '../Utils/AppError';

export async function getJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'ResearchLens/1.0', ...headers }, signal: ctrl.signal });
    if (res.status === 429) throw new AppError(429, 'The academic provider is rate limiting requests. Try again shortly or import papers manually.');
    if (!res.ok) throw new AppError(502, `The academic provider responded with status ${res.status}. You can import papers manually or upload a PDF.`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(502, 'The academic provider is unavailable. You can import papers manually or upload a PDF.');
  } finally {
    clearTimeout(timer);
  }
}
