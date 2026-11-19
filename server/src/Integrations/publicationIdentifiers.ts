export type PublicationIdentifiers = {
  openAlexId?: string;
  semanticScholarId?: string;
  arxivId?: string;
  pmid?: string;
};

const DOI_PATTERN = /\b10\.\d{4,9}\/[^\s<>"{}|\\^`]+/i;
const ARXIV_PATTERN = /\b(?:arxiv:\s*)?((?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?)/i;

export function normalizeDoi(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[.,;:)\]}>'"]+$/g, '')
    .trim();
  return /^10\.\d{4,9}\/\S+$/i.test(cleaned) ? cleaned.toLowerCase() : undefined;
}

export function extractPublicationIdentifiers(value: string): PublicationIdentifiers & { doi?: string } {
  const openAlexId = value.match(/(?:openalex\.org\/)?(W[0-9A-Z]+)/i)?.[1]?.toUpperCase();
  const semanticScholarId = value.match(/semanticscholar\.org\/paper\/(?:[^/]+\/)?([a-f0-9]{40})/i)?.[1]?.toLowerCase();
  const arxivId = value.match(/(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)?((?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?)/i)?.[1]?.toLowerCase();
  const pmid = value.match(/(?:PMID\s*[:#]?\s*|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d+)/i)?.[1];
  const doiMatch = value.match(DOI_PATTERN)?.[0];
  return {
    ...(openAlexId ? { openAlexId } : {}),
    ...(semanticScholarId ? { semanticScholarId } : {}),
    ...(arxivId ? { arxivId } : {}),
    ...(pmid ? { pmid } : {}),
    ...(normalizeDoi(doiMatch) ? { doi: normalizeDoi(doiMatch) } : {}),
  };
}

export function identifiersFromSource(
  source?: string,
  externalId?: string,
  existing: PublicationIdentifiers = {},
): PublicationIdentifiers {
  const ids = extractPublicationIdentifiers(externalId || '');
  const provider = source?.toLowerCase().replace(/[\s_-]/g, '');
  return {
    ...existing,
    ...(ids.openAlexId ? { openAlexId: ids.openAlexId } : {}),
    ...(ids.semanticScholarId ? { semanticScholarId: ids.semanticScholarId } : {}),
    ...(ids.arxivId ? { arxivId: ids.arxivId } : {}),
    ...(ids.pmid ? { pmid: ids.pmid } : {}),
    ...(provider === 'openalex' && externalId ? { openAlexId: ids.openAlexId || externalId.trim() } : {}),
    ...(provider === 'semanticscholar' && externalId ? { semanticScholarId: externalId.trim() } : {}),
    ...(provider === 'arxiv' && externalId ? { arxivId: ids.arxivId || externalId.trim() } : {}),
    ...(provider === 'pubmed' && externalId ? { pmid: ids.pmid || externalId.trim() } : {}),
  };
}

export function normalizedTitle(value: string): string {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function authorSurname(value: string): string {
  const words = value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().match(/\p{L}+/gu) || [];
  return words.at(-1) || '';
}

export function verifyPublicationMatch(
  local: { title: string; authors?: string[]; year?: number; doi?: string },
  candidate: { title?: string; authors?: string[]; year?: number; doi?: string },
): { verified: boolean; reason: string } {
  if (!candidate.title || normalizedTitle(local.title) !== normalizedTitle(candidate.title)) {
    return { verified: false, reason: 'Publication titles do not match exactly.' };
  }
  const localDoi = normalizeDoi(local.doi), candidateDoi = normalizeDoi(candidate.doi);
  if (localDoi && candidateDoi && localDoi !== candidateDoi) {
    return { verified: false, reason: 'The DOI does not match the publication record.' };
  }
  if (local.year && candidate.year && local.year !== candidate.year) {
    return { verified: false, reason: 'Publication years do not match.' };
  }
  let authorMatch = false;
  if (local.authors?.length && candidate.authors?.length) {
    const candidateSurnames = new Set(candidate.authors.map(authorSurname).filter(Boolean));
    authorMatch = local.authors.map(authorSurname).filter(Boolean).some((surname) => candidateSurnames.has(surname));
    if (!authorMatch) return { verified: false, reason: 'No author names match the publication record.' };
  }
  const yearMatch = Boolean(local.year && candidate.year && local.year === candidate.year);
  const doiMatch = Boolean(localDoi && candidateDoi && localDoi === candidateDoi);
  if (!authorMatch && !yearMatch && !doiMatch) {
    return { verified: false, reason: 'The exact title lacks a matching DOI, author, or publication year for verification.' };
  }
  return { verified: true, reason: 'Exact title and available publication metadata were verified.' };
}
