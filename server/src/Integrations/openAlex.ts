import { getJson } from './http';
import type { PaperRecord, SearchParams, SearchResult } from './types';
type Work = { id: string; doi?: string; title?: string; publication_year?: number; authorships?: Array<{ author?: { display_name?: string }; institutions?: Array<{ display_name?: string }> }>; abstract_inverted_index?: Record<string, number[]>; primary_location?: { landing_page_url?: string; source?: { display_name?: string; type?: string } }; open_access?: { is_oa?: boolean; oa_url?: string }; cited_by_count?: number; referenced_works?: string[]; type?: string; keywords?: Array<{ display_name?: string }>; topics?: Array<{ display_name?: string }>; concepts?: Array<{ display_name?: string }> };
type OpenAlexResponse = { results?: Work[]; meta?: { count?: number }; group_by?: Array<{ key?: string; count?: number }> };
function abstract(index?: Record<string, number[]>): string { const words: string[] = []; for (const [word, positions] of Object.entries(index || {})) for (const p of positions) words[p] = word; return words.join(' '); }
function toPaperRecord(w: Work): PaperRecord {
  return {
    title: w.title || 'Untitled',
    authors: (w.authorships || []).map((a) => a.author?.display_name || '').filter(Boolean),
    institutions: [...new Set((w.authorships || []).flatMap((a) => (a.institutions || []).map((i) => i.display_name || '').filter(Boolean)))],
    abstract: abstract(w.abstract_inverted_index),
    publicationYear: w.publication_year,
    venue: w.primary_location?.source?.display_name || '',
    paperType: w.type === 'book' ? 'book' : 'journal',
    DOI: w.doi?.replace(/^https?:\/\/doi.org\//, ''),
    source: 'openalex',
    externalId: w.id,
    keywords: [...(w.keywords || []), ...(w.topics || []), ...(w.concepts || [])].map((k) => k.display_name || '').filter(Boolean).slice(0, 30),
    publicationUrl: w.primary_location?.landing_page_url || w.doi || w.id,
    openAccess: !!w.open_access?.is_oa,
    citationCount: w.cited_by_count ?? null,
    referenceCount: w.referenced_works?.length ?? null,
    referencedWorks: (w.referenced_works || []).slice(0, 1500),
  };
}

export async function getOpenAlexTrends(query: string, yearFrom: number, yearTo: number) {
  const searchTerms = query.replace(/[,:]/g, ' ').replace(/\s+/g, ' ').trim();
  const filters = [
    `title_and_abstract.search:${searchTerms}`,
    `from_publication_date:${yearFrom}-01-01`,
    `to_publication_date:${yearTo}-12-31`,
  ].join(',');
  const groupedUrl = new URL('https://api.openalex.org/works');
  groupedUrl.searchParams.set('filter', filters);
  groupedUrl.searchParams.set('group_by', 'publication_year');

  const papersUrl = new URL('https://api.openalex.org/works');
  papersUrl.searchParams.set('filter', filters);
  papersUrl.searchParams.set('sort', 'cited_by_count:desc');
  papersUrl.searchParams.set('per-page', '25');

  const [grouped, papers] = await Promise.all([
    getJson<OpenAlexResponse>(groupedUrl.toString()),
    getJson<OpenAlexResponse>(papersUrl.toString()),
  ]);
  return {
    provider: 'OpenAlex',
    query: searchTerms,
    yearFrom,
    yearTo,
    total: papers.meta?.count || 0,
    yearlyCounts: (grouped.group_by || [])
      .map((item) => ({ year: Number(item.key), count: item.count || 0 }))
      .filter((item) => Number.isInteger(item.year) && item.year >= yearFrom && item.year <= yearTo)
      .sort((a, b) => a.year - b.year),
    papers: (papers.results || []).map(toPaperRecord),
    notes: ['Publication counts and citation totals are from OpenAlex title and abstract matches. Citation totals are cumulative provider counts, not real-time citation velocity.'],
  };
}

export async function searchOpenAlex(p: SearchParams): Promise<SearchResult> {
  const url = new URL('https://api.openalex.org/works');
  const terms = [p.q, p.keywords, p.author && `author:${p.author}`, p.venue && `"${p.venue}"`].filter(Boolean).join(' ');
  url.searchParams.set('search', terms); url.searchParams.set('per-page', String(p.perPage)); url.searchParams.set('page', String(p.page));
  const filters: string[] = [];
  if (p.yearFrom) filters.push(`from_publication_date:${p.yearFrom}-01-01`);
  if (p.yearTo) filters.push(`to_publication_date:${p.yearTo}-12-31`);
  if (p.openAccess) filters.push('is_oa:true');
  if (p.paperType === 'journal') filters.push('type:article');
  if (p.paperType === 'book') filters.push('type:book');
  if (filters.length) url.searchParams.set('filter', filters.join(','));
  const data = await getJson<OpenAlexResponse>(url.toString());
  const results: PaperRecord[] = (data.results || []).map(toPaperRecord);
  return { results, total: data.meta?.count || 0, page: p.page, notes: ['OpenAlex provides publication, author, venue, open-access, citation, and reference metadata where available.'] };
}
