import { getJson } from './http';
import type { PaperRecord, SearchParams, SearchResult } from './types';
type Article = { bibjson?: { title?: string; author?: Array<{ name?: string }>; abstract?: string; year?: string; journal?: { title?: string; publisher?: string }; identifier?: Array<{ type?: string; id?: string }>; link?: Array<{ url?: string; type?: string }>; subject?: Array<{ term?: string }> } };
export async function searchDoaj(p: SearchParams): Promise<SearchResult> {
  const url = new URL('https://doaj.org/api/v3/search/articles/' + encodeURIComponent([p.q, p.keywords, p.author].filter(Boolean).join(' ') || '*')); url.searchParams.set('page', String(p.page - 1)); url.searchParams.set('pageSize', String(p.perPage));
  const headers: Record<string, string> = {}; if (process.env.DOAJ_API_KEY) headers['X-API-KEY'] = process.env.DOAJ_API_KEY;
  const data = await getJson<{ results?: Article[]; total?: number }>(url.toString(), headers);
  const results: PaperRecord[] = (data.results || []).map((item) => { const w = item.bibjson || {}; const ids = w.identifier || []; const doi = ids.find((i) => i.type?.toLowerCase() === 'doi')?.id; const link = w.link?.find((l) => /fulltext|pdf/i.test(l.type || ''))?.url || w.link?.[0]?.url || ''; return { title: w.title || 'Untitled', authors: (w.author || []).map((a) => a.name || '').filter(Boolean), abstract: w.abstract || '', publicationYear: Number(w.year) || undefined, venue: w.journal?.title || '', paperType: 'journal', DOI: doi, source: 'doaj', externalId: doi || link || w.title || '', keywords: (w.subject || []).map((s) => s.term || '').filter(Boolean), publicationUrl: link, openAccess: true, citationCount: null, referencedWorks: [] }; });
  return { results, total: data.total || 0, page: p.page, notes: ['DOAJ results are open-access journal articles. Journal and article metadata are returned as indexed by DOAJ.'] };
}
