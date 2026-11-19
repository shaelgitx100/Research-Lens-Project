import { getJson } from './http.js';
import { normalizeDoi, type PublicationIdentifiers } from './publicationIdentifiers.js';
import { paceProvider } from './rateLimit.js';

type OpenAlexWork = {
  id?: string;
  title?: string;
  abstract_inverted_index?: Record<string, number[]>;
  type?: string;
  publication_year?: number;
  doi?: string;
  cited_by_count?: number;
  referenced_works?: string[];
  keywords?: Array<{ display_name?: string }>;
  topics?: Array<{ display_name?: string }>;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { landing_page_url?: string; source?: { display_name?: string } };
};

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  abstract?: string;
  'container-title'?: string[];
  type?: string;
  subject?: string[];
  author?: Array<{ given?: string; family?: string }>;
  published?: { 'date-parts'?: number[][] };
  URL?: string;
  reference?: Array<{ DOI?: string; unstructured?: string }>;
  'is-referenced-by-count'?: number;
};

type SemanticScholarWork = {
  paperId?: string;
  title?: string;
  year?: number;
  abstract?: string;
  venue?: string;
  url?: string;
  externalIds?: { DOI?: string };
  citationCount?: number;
  referenceCount?: number;
  publicationTypes?: string[];
  fieldsOfStudy?: string[];
  authors?: Array<{ name?: string }>;
  references?: Array<{ paperId?: string; title?: string; year?: number; authors?: Array<{ name?: string }>; externalIds?: { DOI?: string }; url?: string }>;
  citations?: Array<{ paperId?: string; title?: string; year?: number; authors?: Array<{ name?: string }>; externalIds?: { DOI?: string }; url?: string }>;
};

export interface CitationMetadata {
  provider: 'OpenAlex' | 'Semantic Scholar' | 'Crossref';
  providerId?: string;
  title?: string;
  abstract?: string;
  venue?: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  citationCount: number | null;
  referenceCount: number | null;
  paperType?: string;
  keywords: string[];
  referenceIds: string[];
  references: Array<{ id: string; title?: string; doi?: string; year?: number; authors?: string[]; url?: string }>;
  citing: Array<{ id: string; title: string; doi?: string; year?: number; authors: string[]; url?: string }>;
}

type SavedPaper = { source?: string; externalId?: string; doi?: string; metadataProvider?: string; identifiers?: PublicationIdentifiers };
const normalizedDoi = normalizeDoi;
const emptyCitations = (provider: CitationMetadata['provider'], providerId?: string): CitationMetadata => ({
  provider, providerId, authors: [], citationCount: null, referenceCount: null, keywords: [], referenceIds: [], references: [], citing: [],
});

function openAlexWorkId(value?: string): string | undefined {
  const match = value?.match(/(?:openalex\.org\/)?(W[A-Z0-9]+)/i);
  return match?.[1]?.toUpperCase();
}

function openAlexAbstract(index?: Record<string, number[]>): string | undefined {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) positions.forEach((position) => { words[position] = word; });
  return words.join(' ') || undefined;
}

function fromOpenAlex(work: OpenAlexWork): CitationMetadata {
  const references = (work.referenced_works || []).map((id) => ({ id }));
  return {
    ...emptyCitations('OpenAlex', work.id),
    title: work.title || undefined,
    abstract: openAlexAbstract(work.abstract_inverted_index),
    venue: work.primary_location?.source?.display_name,
    paperType: work.type,
    keywords: [...(work.keywords || []), ...(work.topics || [])].map((item) => item.display_name || '').filter(Boolean),
    authors: (work.authorships || []).map((item) => item.author?.display_name || '').filter(Boolean),
    year: work.publication_year,
    doi: normalizedDoi(work.doi),
    url: work.primary_location?.landing_page_url || work.doi,
    citationCount: Number.isInteger(work.cited_by_count) ? work.cited_by_count! : null,
    referenceCount: Array.isArray(work.referenced_works) ? work.referenced_works.length : null,
    referenceIds: references.map((item) => item.id),
    references,
  };
}

function semanticWorks(items: SemanticScholarWork[] | undefined) {
  return (items || []).filter((item) => item.paperId).map((item) => ({
    id: item.paperId!,
    title: item.title || 'Title unavailable',
    doi: item.externalIds?.DOI,
    year: item.year,
    authors: (item.authors || []).map((author) => author.name || '').filter(Boolean),
    url: item.url,
  }));
}

export async function fetchCitationMetadata(paper: SavedPaper): Promise<CitationMetadata | null> {
  const doi = normalizedDoi(paper.doi);
  const source = (paper.source || '').toLowerCase();
  const normalizedSource = source.replace(/[\s_-]/g, '');
  const resolvedSource = (paper.metadataProvider || '').toLowerCase().replace(/[\s_-]/g, '');
  const semanticId = paper.identifiers?.semanticScholarId ||
    (normalizedSource === 'semanticscholar' ? paper.externalId || (doi ? `DOI:${doi}` : undefined) : undefined);
  const workId = openAlexWorkId(paper.identifiers?.openAlexId || (normalizedSource === 'openalex' ? paper.externalId : undefined));

  if ((normalizedSource === 'semanticscholar' || resolvedSource === 'semanticscholar') && semanticId) {
    const url = new URL(`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(semanticId)}`);
    url.searchParams.set('fields', 'paperId,title,year,authors,url,externalIds,citationCount,referenceCount,references,citations,publicationTypes,fieldsOfStudy');
    const headers: Record<string, string> = {};
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    await paceProvider('semanticscholar', 1000);
    const work = await getJson<SemanticScholarWork>(url.toString(), headers);
    const references = semanticWorks(work.references);
    return {
      ...emptyCitations('Semantic Scholar', work.paperId),
      title: work.title,
      abstract: work.abstract,
      venue: work.venue,
      authors: (work.authors || []).map((author) => author.name || '').filter(Boolean),
      year: work.year,
      doi: work.externalIds?.DOI,
      url: work.url,
      citationCount: Number.isInteger(work.citationCount) ? work.citationCount! : null,
      referenceCount: Number.isInteger(work.referenceCount) ? work.referenceCount! : null,
      paperType: work.publicationTypes?.[0],
      keywords: work.fieldsOfStudy || [],
      referenceIds: references.map((item) => item.id),
      references,
      citing: semanticWorks(work.citations),
    };
  }

  if ((normalizedSource === 'crossref' || resolvedSource === 'crossref') && doi) {
    await paceProvider('crossref', 100);
    const work = await getJson<{ message?: CrossrefWork }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    const record = work.message;
    if (!record) return null;
    const references = (record.reference || []).map((reference, index) => {
      const id = reference.DOI ? `doi:${normalizedDoi(reference.DOI)!.toLowerCase()}` : `crossref-ref:${index}:${reference.unstructured || ''}`;
      return { id, title: reference.unstructured || undefined, doi: reference.DOI };
    });
    return {
      ...emptyCitations('Crossref', record.DOI),
      title: record.title?.[0],
      abstract: record.abstract?.replace(/<[^>]*>/g, ''),
      venue: record['container-title']?.[0],
      paperType: record.type,
      keywords: record.subject || [],
      authors: (record.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
      year: record.published?.['date-parts']?.[0]?.[0],
      doi: normalizedDoi(record.DOI),
      url: record.URL,
      citationCount: Number.isInteger(record['is-referenced-by-count']) ? record['is-referenced-by-count']! : null,
      referenceCount: Array.isArray(record.reference) ? record.reference.length : null,
      referenceIds: references.map((item) => item.id),
      references,
    };
  }

  if (workId) {
    await paceProvider('openalex', 100);
    return fromOpenAlex(await getJson<OpenAlexWork>(`https://api.openalex.org/works/${workId}`));
  }
  if (doi) {
    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('filter', `doi:${doi}`);
    url.searchParams.set('per-page', '1');
    await paceProvider('openalex', 100);
    const response = await getJson<{ results?: OpenAlexWork[] }>(url.toString());
    return response.results?.[0] ? fromOpenAlex(response.results[0]) : null;
  }
  return null;
}

export async function fetchOpenAlexCiting(workId?: string) {
  const normalizedId = openAlexWorkId(workId);
  if (!normalizedId) return [];
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', `cites:${normalizedId}`);
  url.searchParams.set('per-page', '20');
  url.searchParams.set('sort', 'publication_year:desc');
  url.searchParams.set('select', 'id,title,publication_year,doi,cited_by_count,authorships,primary_location');
  await paceProvider('openalex', 100);
  const response = await getJson<{ results?: OpenAlexWork[] }>(url.toString());
  return (response.results || []).filter((work) => work.id).map((work) => ({
    id: work.id!,
    title: work.title || 'Title unavailable',
    doi: normalizedDoi(work.doi),
    year: work.publication_year,
    authors: (work.authorships || []).map((item) => item.author?.display_name || '').filter(Boolean),
    url: work.primary_location?.landing_page_url || work.doi || work.id,
  }));
}
