import { AppError } from '../Utils/AppError.js';
import { paceProvider } from './rateLimit.js';
import { extractPublicationIdentifiers, normalizeDoi, normalizedTitle, verifyPublicationMatch, type PublicationIdentifiers } from './publicationIdentifiers.js';

type ProviderName = 'OpenAlex' | 'Semantic Scholar' | 'Crossref' | 'arXiv' | 'PubMed';
export type PublicationCandidate = {
  provider: ProviderName;
  providerId: string;
  title: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  identifiers: PublicationIdentifiers;
};
type ResolverPaper = { title: string; authors?: string[]; publicationYear?: number; doi?: string; identifiers?: PublicationIdentifiers };
type Resolution = { status: 'matched' | 'ambiguous' | 'not_found'; candidates: PublicationCandidate[]; identifiers?: PublicationIdentifiers; doi?: string; provider?: ProviderName; reason?: string };

async function json<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'ResearchLens/1.0 (academic metadata resolution)', ...headers }, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new AppError(502, 'An academic metadata provider timed out or is unavailable.');
  }
  if (response.status === 404) return null;
  if (response.status === 429) throw new AppError(429, 'An academic metadata provider is rate limiting requests.');
  if (!response.ok) throw new AppError(502, `An academic metadata provider responded with status ${response.status}.`);
  return response.json() as Promise<T>;
}

async function xml(url: string): Promise<string | null> {
  await paceProvider('arxiv', 3000);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/atom+xml', 'User-Agent': 'ResearchLens/1.0' }, signal: AbortSignal.timeout(12000) });
  } catch {
    throw new AppError(502, 'arXiv metadata is temporarily unavailable.');
  }
  if (response.status === 404) return null;
  if (response.status === 429) throw new AppError(429, 'arXiv is rate limiting metadata requests.');
  if (!response.ok) throw new AppError(502, `arXiv responded with status ${response.status}.`);
  return response.text();
}

const decodeXml = (value: string) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const xmlTag = (block: string, name: string) => decodeXml(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]?.replace(/<[^>]+>/g, ' ') || '');
const s2Headers = (): Record<string, string> => process.env.SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY } : {};
const s2Fields = 'paperId,title,year,authors,externalIds,url';
const authorsFromOpenAlex = (work: { authorships?: Array<{ author?: { display_name?: string } }> }) =>
  (work.authorships || []).map(({ author }) => author?.display_name || '').filter(Boolean);

function openAlexCandidate(work: {
  id?: string; title?: string; publication_year?: number; doi?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { landing_page_url?: string };
}): PublicationCandidate | undefined {
  const providerId = work.id?.match(/(W[0-9A-Z]+)/i)?.[1]?.toUpperCase();
  if (!providerId || !work.title) return undefined;
  return {
    provider: 'OpenAlex', providerId, title: work.title, authors: authorsFromOpenAlex(work),
    year: work.publication_year, doi: normalizeDoi(work.doi), url: work.primary_location?.landing_page_url || work.doi,
    identifiers: { openAlexId: providerId },
  };
}

function crossrefCandidate(work: {
  DOI?: string; title?: string[]; author?: Array<{ given?: string; family?: string }>;
  published?: { 'date-parts'?: number[][] }; URL?: string;
}): PublicationCandidate | undefined {
  const doi = normalizeDoi(work.DOI), title = work.title?.[0];
  if (!doi || !title) return undefined;
  return {
    provider: 'Crossref', providerId: doi, title,
    authors: (work.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
    year: work.published?.['date-parts']?.[0]?.[0], doi, url: work.URL,
    identifiers: {},
  };
}

function semanticCandidate(work: {
  paperId?: string; title?: string; year?: number; authors?: Array<{ name?: string }>;
  externalIds?: { DOI?: string; ArXiv?: string }; url?: string;
}): PublicationCandidate | undefined {
  if (!work.paperId || !work.title) return undefined;
  const arxivId = extractPublicationIdentifiers(work.externalIds?.ArXiv || '').arxivId;
  return {
    provider: 'Semantic Scholar', providerId: work.paperId, title: work.title,
    authors: (work.authors || []).map((author) => author.name || '').filter(Boolean),
    year: work.year, doi: normalizeDoi(work.externalIds?.DOI), url: work.url,
    identifiers: { semanticScholarId: work.paperId, ...(arxivId ? { arxivId } : {}) },
  };
}

async function resolveDoi(doi: string): Promise<{ candidates: PublicationCandidate[]; successes: number }> {
  const openAlexUrl = new URL('https://api.openalex.org/works');
  openAlexUrl.searchParams.set('filter', `doi:${doi}`);
  openAlexUrl.searchParams.set('per-page', '5');
  const semanticUrl = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(`DOI:${doi}`)}?fields=${encodeURIComponent(s2Fields)}`;
  const jobs = [
    paceMetadataProvider('OpenAlex', () => json<{ results?: Parameters<typeof openAlexCandidate>[0][] }>(openAlexUrl.toString())
      .then((data) => (data?.results || []).map(openAlexCandidate).filter((item): item is PublicationCandidate => !!item))),
    paceMetadataProvider('Crossref', () => json<{ message?: Parameters<typeof crossrefCandidate>[0] }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`).then((data) => {
      const candidate = data?.message && crossrefCandidate(data.message);
      return candidate ? [candidate] : [];
    })),
    paceMetadataProvider('Semantic Scholar', () => json<Parameters<typeof semanticCandidate>[0]>(semanticUrl, s2Headers()).then((data) => {
      const candidate = data && semanticCandidate(data);
      return candidate ? [candidate] : [];
    })),
  ];
  const results = await Promise.allSettled(jobs);
  const candidates = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  return { candidates, successes: results.filter((result) => result.status === 'fulfilled').length };
}

async function resolveTitle(title: string): Promise<{ candidates: PublicationCandidate[]; successes: number }> {
  const openAlexUrl = new URL('https://api.openalex.org/works');
  openAlexUrl.searchParams.set('search', title);
  openAlexUrl.searchParams.set('per-page', '5');
  const crossrefUrl = new URL('https://api.crossref.org/works');
  crossrefUrl.searchParams.set('query.title', title);
  crossrefUrl.searchParams.set('rows', '5');
  const semanticUrl = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
  semanticUrl.searchParams.set('query', title);
  semanticUrl.searchParams.set('limit', '5');
  semanticUrl.searchParams.set('fields', s2Fields);
  const jobs = [
    paceMetadataProvider('OpenAlex', () => json<{ results?: Parameters<typeof openAlexCandidate>[0][] }>(openAlexUrl.toString()).then((data) => (data?.results || []).map(openAlexCandidate).filter((item): item is PublicationCandidate => !!item))),
    paceMetadataProvider('Crossref', () => json<{ message?: { items?: Parameters<typeof crossrefCandidate>[0][] } }>(crossrefUrl.toString()).then((data) => (data?.message?.items || []).map(crossrefCandidate).filter((item): item is PublicationCandidate => !!item))),
    paceMetadataProvider('Semantic Scholar', () => json<{ data?: Parameters<typeof semanticCandidate>[0][] }>(semanticUrl.toString(), s2Headers()).then((data) => (data?.data || []).map(semanticCandidate).filter((item): item is PublicationCandidate => !!item))),
  ];
  const results = await Promise.allSettled(jobs);
  return {
    candidates: results.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
    successes: results.filter((result) => result.status === 'fulfilled').length,
  };
}

async function resolveArxiv(arxivId: string): Promise<PublicationCandidate[]> {
  const url = new URL('https://export.arxiv.org/api/query');
  url.searchParams.set('id_list', arxivId.replace(/v\d+$/i, ''));
  const body = await xml(url.toString());
  if (!body) return [];
  return (body.match(/<entry>[\s\S]*?<\/entry>/g) || []).flatMap((entry) => {
    const id = xmlTag(entry, 'id').match(/(?:abs|pdf)\/([^?#]+)/i)?.[1];
    const title = xmlTag(entry, 'title').replace(/\s+/g, ' ');
    if (!id || !title) return [];
    const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)].map((match) => decodeXml(match[1]));
    const year = Number(xmlTag(entry, 'published').slice(0, 4)) || undefined;
    return [{ provider: 'arXiv' as const, providerId: id, title, authors, year, url: xmlTag(entry, 'id'), identifiers: { arxivId: id.toLowerCase() } }];
  });
}

async function resolvePubmed(pmid: string): Promise<PublicationCandidate[]> {
  const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
  url.searchParams.set('db', 'pubmed');
  url.searchParams.set('id', pmid);
  url.searchParams.set('retmode', 'json');
  if (process.env.NCBI_API_KEY) url.searchParams.set('api_key', process.env.NCBI_API_KEY);
  await paceProvider('ncbi', process.env.NCBI_API_KEY ? 110 : 350);
  const data = await json<{ result?: { uids?: string[]; [id: string]: unknown } }>(url.toString());
  const record = data?.result?.[pmid] as {
    title?: string; authors?: Array<{ name?: string }>; pubdate?: string; elocationid?: string;
    articleids?: Array<{ idtype?: string; value?: string }>; fulljournalname?: string;
  } | undefined;
  if (!record?.title) return [];
  const doi = normalizeDoi(record.articleids?.find((item) => item.idtype?.toLowerCase() === 'doi')?.value || record.elocationid);
  const year = Number(record.pubdate?.match(/\b(1[5-9]\d{2}|20\d{2}|2100)\b/)?.[1]) || undefined;
  return [{
    provider: 'PubMed', providerId: pmid, title: record.title,
    authors: (record.authors || []).map((author) => author.name || '').filter(Boolean),
    year, doi, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    identifiers: { pmid },
  }];
}

function distinctGroups(candidates: PublicationCandidate[]) {
  const groups = new Map<string, PublicationCandidate[]>();
  for (const candidate of candidates) {
    const authorKey = candidate.authors.map((name) => normalizedTitle(name).split(' ').at(-1)).filter(Boolean).sort().join(',');
    const key = candidate.doi
      ? `doi:${normalizeDoi(candidate.doi)}`
      : `${normalizedTitle(candidate.title)}|${candidate.year || ''}|${authorKey}`;
    groups.set(key, [...(groups.get(key) || []), candidate]);
  }
  return [...groups.values()];
}

export async function resolvePublication(paper: ResolverPaper): Promise<Resolution> {
  const ids = paper.identifiers || {};
  const doi = normalizeDoi(paper.doi);
  let candidates: PublicationCandidate[] = [];
  let successfulProviders = 0;
  if (doi) {
    const direct = await resolveDoi(doi);
    candidates = direct.candidates;
    successfulProviders += direct.successes;
  }
  if (!candidates.some((candidate) => normalizedTitle(candidate.title) === normalizedTitle(paper.title)) && paper.title.trim()) {
    const titleResults = await resolveTitle(paper.title.trim());
    candidates = [...candidates, ...titleResults.candidates];
    successfulProviders += titleResults.successes;
  }
  if (ids.arxivId) {
    try {
      candidates.push(...await resolveArxiv(ids.arxivId));
      successfulProviders += 1;
    } catch (error) {
      if (successfulProviders === 0) throw error;
    }
  }
  if (ids.pmid) {
    try {
      candidates.push(...await resolvePubmed(ids.pmid));
      successfulProviders += 1;
    } catch (error) {
      if (successfulProviders === 0) throw error;
    }
  }
  const title = normalizedTitle(paper.title);
  const exactCandidates = candidates.filter((candidate) => normalizedTitle(candidate.title) === title);
  const verified = exactCandidates.filter((candidate) => verifyPublicationMatch({
    title: paper.title, authors: paper.authors, year: paper.publicationYear, doi,
  }, candidate).verified);
  const groups = distinctGroups(exactCandidates);
  if (verified.length) {
    const verifiedGroups = distinctGroups(verified);
    if (verifiedGroups.length === 1) {
      const accepted = verifiedGroups[0];
      const mergedIds = accepted.reduce<PublicationIdentifiers>((all, candidate) => ({
        ...all, ...candidate.identifiers,
      }), {});
      const chosen = accepted.find((candidate) => candidate.provider === 'OpenAlex') ||
        accepted.find((candidate) => candidate.provider === 'Semantic Scholar') || accepted[0];
      const acceptedDoi = accepted.find((candidate) => candidate.doi)?.doi || doi;
      return {
        status: 'matched', candidates: accepted, identifiers: mergedIds,
        doi: acceptedDoi, provider: chosen.provider,
      };
    }
    return { status: 'ambiguous', candidates: exactCandidates, reason: 'More than one distinct publication matches the available metadata.' };
  }
  if (groups.length || exactCandidates.length) {
    return { status: 'ambiguous', candidates: exactCandidates, reason: 'Exact-title records were found, but authors, year, or DOI could not verify a unique match.' };
  }
  if (!successfulProviders) throw new AppError(502, 'Academic metadata providers are temporarily unavailable. Retry metadata resolution later.');
  return { status: 'not_found', candidates: [] };
}

export async function paceMetadataProvider(provider: ProviderName, callback: () => Promise<PublicationCandidate[]>): Promise<PublicationCandidate[]> {
  const intervals = { OpenAlex: 100, Crossref: 100, 'Semantic Scholar': 1000 };
  if (provider === 'arXiv' || provider === 'PubMed') return callback();
  await paceProvider(provider.toLowerCase().replace(/\s/g, ''), intervals[provider]);
  return callback();
}
