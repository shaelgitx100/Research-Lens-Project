import { getJson } from './http';
import type { PaperRecord, SearchParams, SearchResult } from './types';
import { paceProvider } from './rateLimit';
import { AppError } from '../Utils/AppError';
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (s: string, name: string) => decode(s.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]?.replace(/<[^>]+>/g, ' ') || '');
export async function searchArxiv(p: SearchParams): Promise<SearchResult> {
  const url = new URL('https://export.arxiv.org/api/query'); url.searchParams.set('search_query', `all:${(p.q || p.keywords || '').replace(/[{}]/g, ' ')}`); url.searchParams.set('start', String((p.page - 1) * p.perPage)); url.searchParams.set('max_results', String(p.perPage)); url.searchParams.set('sortBy', 'relevance');
  const xml = await getJsonText(url.toString()); const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const results: PaperRecord[] = blocks.map((entry) => { const id = tag(entry, 'id'); const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)].map((m) => decode(m[1])); const category = [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1]); return { title: tag(entry, 'title').replace(/\s+/g, ' '), authors, abstract: tag(entry, 'summary').replace(/\s+/g, ' '), publicationYear: Number(tag(entry, 'published').slice(0, 4)) || undefined, venue: category.join(', '), paperType: 'preprint', source: 'arxiv', externalId: id, keywords: category, publicationUrl: id, openAccess: true, citationCount: null, referencedWorks: [], isPreprint: true }; });
  const count = Number(xml.match(/<opensearch:totalResults[^>]*>(\d+)</)?.[1] || results.length);
  return { results, total: count, page: p.page, notes: ['arXiv records are preprints. Publication elsewhere is not independently verified; check Crossref or another publication registry.'] };
}
async function getJsonText(url: string): Promise<string> { await paceProvider('arxiv', 3000); const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000); try { const res = await fetch(url, { headers: { Accept: 'application/atom+xml', 'User-Agent': 'ResearchLens/1.0' }, signal: ctrl.signal }); if (res.status === 429) throw new AppError(429, 'arXiv is rate limiting requests. Try again later.'); if (!res.ok) throw new AppError(502, `arXiv responded with status ${res.status}.`); return await res.text(); } catch (e) { if (e instanceof AppError) throw e; throw new AppError(502, 'arXiv is unavailable. Try again later.'); } finally { clearTimeout(timer); } }
