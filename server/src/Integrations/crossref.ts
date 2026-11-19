import { getJson } from './http';
import type { PaperRecord, SearchParams, SearchResult } from './types';
type Work = { DOI?: string; title?: string[]; author?: Array<{ given?: string; family?: string }>; abstract?: string; published?: { 'date-parts'?: number[][] }; 'container-title'?: string[]; URL?: string; type?: string; reference?: Array<{ DOI?: string }>; 'is-referenced-by-count'?: number };
const toRecord = (w: Work): PaperRecord => ({ title: w.title?.[0] || 'Untitled', authors: (w.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ')), abstract: (w.abstract || '').replace(/<[^>]*>/g, ''), publicationYear: w.published?.['date-parts']?.[0]?.[0], venue: w['container-title']?.[0] || '', paperType: /proceedings|conference/i.test(w.type || '') ? 'conference' : 'journal', DOI: w.DOI, source: 'crossref', externalId: w.DOI || w.URL || '', keywords: [], publicationUrl: w.URL || (w.DOI ? `https://doi.org/${w.DOI}` : ''), openAccess: false, citationCount: w['is-referenced-by-count'] ?? null, referenceCount: w.reference?.length ?? null, referencedWorks: (w.reference || []).map((r) => r.DOI || '').filter(Boolean) });
export async function searchCrossref(p: SearchParams): Promise<SearchResult> {
  const doi = p.q.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  if (/^10\.\d{4,9}\/\S+$/i.test(doi)) {
    const exact = await getJson<{ message?: Work }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    return { results: exact.message ? [toRecord(exact.message)] : [], total: exact.message ? 1 : 0, page: p.page, notes: ['Crossref DOI lookup returned the publisher-deposited record. Compare title, authors, venue and year to verify the citation.'] };
  }
  const url = new URL('https://api.crossref.org/works'); url.searchParams.set('query', [p.q, p.keywords, p.author && `author:${p.author}`, p.venue].filter(Boolean).join(' ')); url.searchParams.set('rows', String(p.perPage)); url.searchParams.set('offset', String((p.page - 1) * p.perPage));
  if (p.yearFrom || p.yearTo) url.searchParams.set('filter', `from-pub-date:${p.yearFrom || 1500},until-pub-date:${p.yearTo || 2200}`);
  const data = await getJson<{ message?: { items?: Work[]; 'total-results'?: number } }>(url.toString());
  const results: PaperRecord[] = (data.message?.items || []).map(toRecord);
  return { results, total: data.message?.['total-results'] || 0, page: p.page, notes: ['Crossref is used for DOI and publication metadata verification. Abstracts and reference lists are available only when deposited by the publisher.'] };
}
