import { getJson } from './http';
import type { PaperRecord, SearchParams, SearchResult } from './types';
import { AppError } from '../Utils/AppError';
type Item = { id?: number; title?: string; abstract?: string; authors?: string | Array<string | { name?: string }>; yearPublished?: number; journals?: Array<{ title?: string }>; downloadUrl?: string; sourceFulltextUrls?: string[]; doi?: string; citations?: number };
export async function searchCore(p: SearchParams): Promise<SearchResult> {
  const key = process.env.CORE_API_KEY; if (!key) throw new AppError(503, 'CORE search requires CORE_API_KEY. Configure a CORE API key to enable this source.');
  const url = new URL('https://api.core.ac.uk/v3/search/works'); url.searchParams.set('q', [p.q, p.keywords, p.author].filter(Boolean).join(' ')); url.searchParams.set('limit', String(p.perPage)); url.searchParams.set('offset', String((p.page - 1) * p.perPage));
  const data = await getJson<{ results?: Item[]; totalHits?: number }>(url.toString(), { Authorization: `Bearer ${key}` });
  const results: PaperRecord[] = (data.results || []).map((w) => ({ title: w.title || 'Untitled', authors: (Array.isArray(w.authors) ? w.authors.map((a) => typeof a === 'string' ? a : a.name || '') : (w.authors || '').split(/[,;]|\band\b/)).map((a) => a.trim()).filter(Boolean), abstract: w.abstract || '', publicationYear: w.yearPublished, venue: w.journals?.[0]?.title || '', paperType: 'other', DOI: w.doi, source: 'core', externalId: String(w.id || ''), keywords: [], publicationUrl: w.downloadUrl || w.sourceFulltextUrls?.[0] || '', openAccess: true, citationCount: w.citations ?? null, referencedWorks: [] }));
  return { results, total: data.totalHits || 0, page: p.page, notes: ['CORE indexes open-access repository records. Full text is linked only when supplied by the repository.'] };
}
