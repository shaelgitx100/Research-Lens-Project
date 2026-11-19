import { Paper } from '../model/index.js';
import { fetchCitationMetadata, fetchOpenAlexCiting } from '../Integrations/citationMetadata.js';
import { identifiersFromSource, normalizeDoi, extractPublicationIdentifiers, type PublicationIdentifiers } from '../Integrations/publicationIdentifiers.js';
import { resolvePublication, type PublicationCandidate } from '../Integrations/publicationResolver.js';
import { logger } from '../Utils/logger.js';

type EnrichmentPaper = {
  _id: string | { toString(): string };
  title: string;
  authors?: string[];
  publicationYear?: number;
  doi?: string;
  source?: string;
  externalId?: string;
  publicationUrl?: string;
  extractedText?: string;
  fileName?: string;
  identifiers?: PublicationIdentifiers;
  discoveredIdentifiers?: PublicationIdentifiers & { doi?: string };
  metadataStatus?: string;
  metadataVerificationMethod?: string;
  metadataCandidates?: Array<Record<string, unknown>>;
};

const queue: Array<{ ownerId: string; paperId: string }> = [];
const queued = new Set<string>();
const active = new Set<string>();
const MAX_ACTIVE = 3;
const MAX_ATTEMPTS = 3;
const keyFor = (ownerId: string, paperId: string) => `${ownerId}:${paperId}`;
const candidateSummary = (candidate: PublicationCandidate) => ({
  provider: candidate.provider, providerId: candidate.providerId, title: candidate.title,
  authors: candidate.authors, year: candidate.year, doi: candidate.doi, url: candidate.url,
});
const sourceName = (source?: string) => {
  const value = source?.toLowerCase().replace(/[\s_-]/g, '');
  if (value === 'openalex') return 'OpenAlex';
  if (value === 'semanticscholar') return 'Semantic Scholar';
  if (value === 'crossref') return 'Crossref';
  if (value === 'arxiv') return 'arXiv';
  if (value === 'pubmed') return 'PubMed';
  return undefined;
};

async function enrichPaper(ownerId: string, paperId: string): Promise<void> {
  const paper = await Paper.findOne({ _id: paperId, ownerId }).lean<EnrichmentPaper>().exec();
  if (!paper) return;
  const identifiers = identifiersFromSource(paper.source, paper.externalId, paper.identifiers);
  const extracted = extractPublicationIdentifiers([paper.fileName, paper.title, paper.extractedText].filter(Boolean).join('\n'));
  const discoveredIdentifiers = { ...paper.discoveredIdentifiers, ...extracted };
  const foundIdentifiers = identifiersFromSource(undefined, undefined, discoveredIdentifiers);
  const doi = normalizeDoi(paper.doi) || normalizeDoi(discoveredIdentifiers.doi);
  const knownSource = sourceName(paper.source);
  const importedProviderRecord = Boolean(knownSource && (paper.externalId || doi));
  const hasSavedProviderId = Boolean(identifiers.openAlexId || identifiers.semanticScholarId || identifiers.arxivId || identifiers.pmid);
  const priorMatched = paper.metadataStatus === 'matched' || importedProviderRecord;
  await Paper.updateOne({ _id: paperId, ownerId }, {
    $set: {
      ...(Object.keys(identifiers).length ? { identifiers } : {}),
      ...(Object.keys(discoveredIdentifiers).length ? { discoveredIdentifiers } : {}),
      metadataStatus: 'resolving',
      metadataStartedAt: new Date(),
      metadataError: '',
    },
  });

  if (!priorMatched && !hasSavedProviderId && !doi && !paper.title.trim()) {
    await Paper.updateOne({ _id: paperId, ownerId }, { $set: { metadataStatus: 'not_found', metadataLastEnrichedAt: new Date() } });
    return;
  }

  let verifiedIdentifiers = identifiers;
  let metadataProvider = knownSource;
  let acceptedDoi = doi;
  let candidates: PublicationCandidate[] = [];
  if (!priorMatched) {
    const resolution = await resolvePublication({
      title: paper.title, authors: paper.authors, publicationYear: paper.publicationYear,
      doi, identifiers: foundIdentifiers,
    });
    candidates = resolution.candidates;
    if (resolution.status !== 'matched') {
      const state = resolution.status === 'ambiguous' ? 'ambiguous' : 'not_found';
      await Paper.updateOne({ _id: paperId, ownerId }, {
        $set: {
          metadataStatus: state,
          metadataCandidates: candidates.slice(0, 10).map(candidateSummary),
          metadataError: resolution.reason || '',
          metadataLastEnrichedAt: new Date(),
        },
      });
      return;
    }
    verifiedIdentifiers = { ...identifiers, ...(resolution.identifiers || {}) };
    metadataProvider = resolution.provider;
    acceptedDoi = resolution.doi || doi;
  } else {
    metadataProvider ||= hasSavedProviderId ? 'Provider record' : undefined;
  }

  const now = new Date();
  const resolvedCandidates = candidates.length ? candidates.map(candidateSummary) : paper.metadataCandidates || [];
  const verifiedUpdate = {
    ...(acceptedDoi ? { doi: acceptedDoi } : {}),
    identifiers: verifiedIdentifiers,
    metadataStatus: 'matched',
    metadataVerificationMethod: priorMatched ? paper.metadataVerificationMethod || 'source' : 'provider',
    metadataProvider: metadataProvider || 'Academic provider',
    metadataLastEnrichedAt: now,
    metadataCandidates: resolvedCandidates.slice(0, 10),
    metadataError: '',
  };
  await Paper.updateOne({ _id: paperId, ownerId }, { $set: verifiedUpdate });

  try {
    const live = await fetchCitationMetadata({
      ...paper, doi: acceptedDoi, identifiers: verifiedIdentifiers,
      source: knownSource?.toLowerCase() || metadataProvider?.toLowerCase(),
      externalId: paper.externalId,
    });
    if (!live) return;
    const citationUpdate: Record<string, unknown> = {
      citationMetadataSource: live.provider,
      citationRetrievedAt: now,
      citationMetadataError: '',
    };
    if (live.citationCount !== null) citationUpdate.citationCount = live.citationCount;
    if (live.referenceCount !== null) {
      citationUpdate.referenceCount = live.referenceCount;
      citationUpdate.referencedWorks = live.referenceIds;
      citationUpdate.referenceRetrievedAt = now;
    }
    if (live.provider === 'Semantic Scholar') {
      citationUpdate.citingWorks = live.citing;
      citationUpdate.citingSource = live.provider;
      citationUpdate.citingRetrievedAt = now;
    } else if (live.provider === 'OpenAlex') {
      try {
        citationUpdate.citingWorks = await fetchOpenAlexCiting(live.providerId);
        citationUpdate.citingSource = live.provider;
        citationUpdate.citingRetrievedAt = now;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Citing publications could not be refreshed.';
        citationUpdate.citationMetadataError = message;
        logger.warn('OpenAlex citing works could not be refreshed', { paperId, message });
      }
    }
    await Paper.updateOne({ _id: paperId, ownerId }, { $set: citationUpdate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Citation metrics could not be refreshed.';
    await Paper.updateOne({ _id: paperId, ownerId }, { $set: { citationMetadataError: message } });
    logger.warn('Citation metadata refresh failed after publication match', { paperId, message });
  }
}

async function runJob(ownerId: string, paperId: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await Paper.updateOne({ _id: paperId, ownerId }, { $set: { metadataAttempts: attempt } });
    try {
      await enrichPaper(ownerId, paperId);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** (attempt - 1)));
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'Academic metadata providers are temporarily unavailable.';
  await Paper.updateOne({ _id: paperId, ownerId }, {
    $set: {
      metadataStatus: 'provider_unavailable',
      metadataError: message,
      metadataRetryAt: new Date(Date.now() + 30 * 60 * 1000),
      metadataLastEnrichedAt: new Date(),
    },
  });
  logger.warn('Publication metadata enrichment failed after retries', { paperId, message });
}

function pumpQueue(): void {
  while (active.size < MAX_ACTIVE && queue.length) {
    const job = queue.shift()!;
    const key = keyFor(job.ownerId, job.paperId);
    queued.delete(key);
    active.add(key);
    void runJob(job.ownerId, job.paperId).catch((error: unknown) => {
      logger.error('Publication metadata job could not be completed', {
        paperId: job.paperId, message: error instanceof Error ? error.message : String(error),
      });
    }).finally(() => {
      active.delete(key);
      pumpQueue();
    });
  }
}

export function enqueuePaperEnrichment(ownerId: string, paperId: string): boolean {
  const key = keyFor(ownerId, paperId);
  if (queued.has(key) || active.has(key)) return false;
  queued.add(key);
  queue.push({ ownerId, paperId });
  void Paper.updateOne({ _id: paperId, ownerId, metadataStatus: { $ne: 'matched' } }, {
    $set: { metadataStatus: 'pending', metadataError: '' },
  }).then(() => pumpQueue()).catch((error: unknown) => {
    logger.error('Could not persist queued publication metadata job', {
      paperId, message: error instanceof Error ? error.message : String(error),
    });
    queued.delete(key);
    const index = queue.findIndex((job) => job.ownerId === ownerId && job.paperId === paperId);
    if (index >= 0) queue.splice(index, 1);
  });
  return true;
}

