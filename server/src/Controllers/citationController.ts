import { Paper, Project } from '../model/index.js';
import Citation from '../Models/Citation.js';
import { asyncHandler } from '../Utils/asyncHandler.js';
import { formatCitation } from '../Services/citationService.js';
import { z } from 'zod';
import { fetchCitationMetadata, fetchOpenAlexCiting } from '../Integrations/citationMetadata.js';
import { normalizeDoi, normalizedTitle, type PublicationIdentifiers } from '../Integrations/publicationIdentifiers.js';
import { enqueuePaperEnrichment } from '../Services/paperEnrichmentService.js';

const requestSchema = z.object({ paperId: z.string(), style: z.enum(['APA', 'MLA', 'Chicago']).default('APA') });
const networkQuery = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  refresh: z.enum(['true', 'false']).default('false'),
});
const verifyMatchBody = z.object({
  provider: z.enum(['OpenAlex', 'Semantic Scholar', 'Crossref', 'arXiv', 'PubMed']),
  providerId: z.string().trim().min(1).max(500),
});
const paperIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const enrichmentBody = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  paperIds: z.array(paperIdSchema).max(100).optional(),
});
type SavedPaper = {
  _id: string | { toString(): string };
  isDemo?: boolean;
  title: string;
  authors?: string[];
  abstract?: string;
  publicationYear?: number;
  doi?: string;
  identifiers?: PublicationIdentifiers;
  discoveredIdentifiers?: PublicationIdentifiers & { doi?: string };
  metadataStatus?: string;
  metadataProvider?: string;
  metadataVerificationMethod?: string;
  metadataCandidates?: Array<Record<string, unknown>>;
  metadataError?: string;
  metadataAttempts?: number;
  metadataStartedAt?: Date | string;
  metadataLastEnrichedAt?: Date | string;
  citationMetadataSource?: string;
  citationRetrievedAt?: Date | string;
  referenceRetrievedAt?: Date | string;
  citationMetadataError?: string;
  citingWorks?: Array<{ id: string; title: string; doi?: string; year?: number; authors: string[]; url?: string }>;
  citingSource?: string;
  citingRetrievedAt?: Date | string;
  metadataRetryAt?: Date | string;
  venue?: string;
  source?: string;
  externalId?: string;
  publicationUrl?: string;
  paperType?: string;
  keywords?: string[];
  citationCount?: number | null;
  referenceCount?: number | null;
  referencedWorks?: string[];
};
type CitationRecord = NonNullable<Awaited<ReturnType<typeof fetchCitationMetadata>>>;
const isDemoPaper = (paper: SavedPaper) =>
  paper.isDemo === true || paper.source?.toLowerCase() === 'demo' || paper.externalId?.toLowerCase().startsWith('demo:');
const normalizedDoi = normalizeDoi;
const providerIdentifierAlias = (value?: string, source?: string) => {
  const providerNameValue = providerName(source);
  const provider = providerNameValue?.toLowerCase().replace(/\s/g, '');
  if (!value?.trim() || !provider) return undefined;
  const normalizedId = providerNameValue === 'OpenAlex'
    ? value.match(/(?:openalex\.org\/)?(W[A-Z0-9]+)/i)?.[1]?.toLowerCase() || value.trim().toLowerCase()
    : value.trim().toLowerCase();
  return `provider:${provider}:${normalizedId}`;
};
const doiAliases = (value?: string) => {
  const doi = normalizedDoi(value?.replace(/^doi:/i, ''));
  return doi?.startsWith('10.') ? [doi, `doi:${doi}`, `https://doi.org/${doi}`] : [];
};
const aliases = (paper: { externalId?: string; doi?: string; identifiers?: PublicationIdentifiers }, source?: string) => {
  return [
    providerIdentifierAlias(paper.externalId, source),
    providerIdentifierAlias(paper.identifiers?.openAlexId, 'openalex'),
    providerIdentifierAlias(paper.identifiers?.semanticScholarId, 'semanticscholar'),
    providerIdentifierAlias(paper.identifiers?.arxivId, 'arxiv'),
    providerIdentifierAlias(paper.identifiers?.pmid, 'pubmed'),
    ...doiAliases(paper.doi),
    ...doiAliases(paper.externalId),
  ].filter((value): value is string => !!value);
};
const providerName = (value?: string) => {
  const source = value?.toLowerCase().replace(/[\s_-]/g, '');
  if (source === 'openalex') return 'OpenAlex';
  if (source === 'semanticscholar') return 'Semantic Scholar';
  if (source === 'crossref') return 'Crossref';
  if (source === 'arxiv') return 'arXiv';
  if (source === 'pubmed') return 'PubMed';
  return null;
};
const canRefreshPaper = (paper: SavedPaper) => {
  return Boolean(paper.doi || paper.identifiers?.openAlexId || paper.identifiers?.semanticScholarId ||
    (paper.externalId && providerName(paper.source)));
};

async function loadNetworkPapers(ownerId: string, workspaceId: string, projectId?: string): Promise<SavedPaper[]> {
  const filter: Record<string, unknown> = { ownerId, workspaceId };
  if (projectId) filter.projectId = projectId;
  filter.$nor = [{ isDemo: true }, { source: /^demo$/i }, { externalId: /^demo:/i }];
  return Paper.find(filter).sort({ createdAt: -1 }).limit(100).lean<SavedPaper[]>().exec();
}

async function metadataFor(papers: SavedPaper[], shouldRefresh: boolean) {
  const fetched = new Map<string, Awaited<ReturnType<typeof fetchCitationMetadata>>>();
  const allEligible = shouldRefresh ? papers.filter(canRefreshPaper) : [];
  const eligible = allEligible.slice(0, 30);
  for (let offset = 0; offset < eligible.length; offset += 3) {
    const batch = eligible.slice(offset, offset + 3);
    const results = await Promise.all(batch.map((paper) => fetchCitationMetadata(paper)));
    results.forEach((result, index) => {
      if (result) fetched.set(String(batch[index]._id), result);
    });
  }
  return { fetched, refreshCandidates: allEligible.length, capped: allEligible.length > eligible.length };
}

export const network = asyncHandler(async (req, res) => {
  const { projectId, refresh } = networkQuery.parse(req.query);
  if (projectId && !await Project.exists({ _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId })) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const paperFilter: Record<string, unknown> = { ownerId: req.userId, workspaceId: req.workspaceId };
  if (projectId) paperFilter.projectId = projectId;
  const [allSaved, totalSavedCount, demoRecordsExcluded, unresolvedPublications] = await Promise.all([
    loadNetworkPapers(req.userId!, req.workspaceId!, projectId),
    Paper.countDocuments(paperFilter),
    Paper.countDocuments({ ...paperFilter, $or: [{ isDemo: true }, { source: /^demo$/i }, { externalId: /^demo:/i }] }),
    Paper.countDocuments({
      ...paperFilter,
      metadataStatus: { $ne: 'matched' },
      $nor: [{ isDemo: true }, { source: /^demo$/i }, { externalId: /^demo:/i }],
    }),
  ]);
  const saved = allSaved;
  const now = Date.now();
  saved.filter((paper) => {
    const state = paper.metadataStatus;
    if (!state || state === 'pending') return true;
    if (state === 'provider_unavailable') return !paper.metadataRetryAt || new Date(paper.metadataRetryAt).getTime() <= now;
    return state === 'resolving' && (!paper.metadataStartedAt || now - new Date(paper.metadataStartedAt).getTime() > 10 * 60 * 1000);
  }).forEach((paper) => enqueuePaperEnrichment(req.userId!, String(paper._id)));
  const { fetched, refreshCandidates, capped } = await metadataFor(saved, refresh === 'true');
  const refreshedAt = refresh === 'true' && refreshCandidates > 0 ? new Date().toISOString() : null;
  const parent = new Map(saved.map((paper) => [String(paper._id), String(paper._id)]));
  const rootOf = (id: string): string => {
    const root = parent.get(id) || id;
    if (root === id) return root;
    const next = rootOf(root);
    parent.set(id, next);
    return next;
  };
  const join = (left: string, right: string) => {
    const a = rootOf(left), b = rootOf(right);
    if (a !== b) parent.set(b, a);
  };
  const aliasOwners = new Map<string, string>();
  saved.forEach((paper) => {
    const id = String(paper._id);
    const live = fetched.get(id);
    const workAliases = new Set([
      ...aliases(paper, paper.source),
      ...aliases({ externalId: live?.providerId, doi: live?.doi }, live?.provider),
    ]);
    workAliases.forEach((alias) => {
      const owner = aliasOwners.get(alias);
      if (owner) join(id, owner);
      else aliasOwners.set(alias, id);
    });
  });
  const groups = new Map<string, SavedPaper[]>();
  saved.forEach((paper) => {
    const root = rootOf(String(paper._id));
    groups.set(root, [...(groups.get(root) || []), paper]);
  });
  const byAlias = new Map<string, string>();
  saved.forEach((paper) => {
    const id = rootOf(String(paper._id));
    const live = fetched.get(String(paper._id));
    [...aliases(paper, paper.source), ...aliases({ externalId: live?.providerId, doi: live?.doi }, live?.provider)]
      .forEach((alias) => byAlias.set(alias, id));
  });
  const evidenceByPaper = new Map<string, Array<{ id: string; provider: string; retrievedAt: string | null }>>();
  const papers = [...groups].map(([id, members]) => {
    const records = members.map((paper) => ({ paper, live: fetched.get(String(paper._id)) }));
    const getProviderReferences = ({ paper, live }: typeof records[number]) => {
      const provider = live?.provider || providerName(paper.citationMetadataSource) || providerName(paper.source);
      if (!provider) return [];
      const referenceIds = live?.referenceIds || paper.referencedWorks || [];
      const retrievedAt = live && refreshedAt ? refreshedAt : paper.referenceRetrievedAt ? new Date(paper.referenceRetrievedAt).toISOString() : null;
      return referenceIds.map((referenceId) => ({ id: referenceId, provider, retrievedAt }));
    };
    const evidence = records.flatMap(getProviderReferences);
    const uniqueEvidence = [...new Map(evidence.map((item) => [`${item.id.toLowerCase()}|${item.provider}`, item])).values()];
    const uniqueReferenceCount = new Set(uniqueEvidence.map((item) => item.id.toLowerCase())).size;
    evidenceByPaper.set(id, uniqueEvidence);
    const liveCountRecord = records.find(({ live }) => live?.citationCount !== null && live?.citationCount !== undefined);
    const savedCountRecord = records.find(({ paper }) => (providerName(paper.citationMetadataSource) || providerName(paper.source)) && paper.citationCount != null);
    const liveReferenceCount = records.find(({ live }) => live?.referenceCount !== null && live?.referenceCount !== undefined);
    const savedReferenceCount = records.find(({ paper }) => (providerName(paper.citationMetadataSource) || providerName(paper.source)) && paper.referenceCount != null);
    const referenceCount = liveReferenceCount?.live?.referenceCount ?? savedReferenceCount?.paper.referenceCount ?? (uniqueReferenceCount || null);
    const fields = <T,>(select: (paper: SavedPaper) => T | undefined, liveSelect?: (live: CitationRecord) => T | undefined) => {
      for (const record of records) {
        const fromLive = record.live && liveSelect ? liveSelect(record.live) : undefined;
        if (fromLive !== undefined && fromLive !== '') return fromLive;
        const fromSaved = select(record.paper);
        if (fromSaved !== undefined && fromSaved !== '') return fromSaved;
      }
      return undefined;
    };
    const authors = [...new Set(records.flatMap(({ paper, live }) => live?.authors.length ? live.authors : paper.authors || []))];
    const keywords = [...new Set(records.flatMap(({ paper, live }) => live?.keywords.length ? live.keywords : paper.keywords || []))];
    const providers = [...new Set(records.map(({ live, paper }) => live?.provider || providerName(paper.citationMetadataSource) || providerName(paper.source))
      .filter((provider): provider is Exclude<typeof provider, null> => provider !== null))];
    const countSource = liveCountRecord?.live?.provider || (savedCountRecord
      ? providerName(savedCountRecord.paper.citationMetadataSource) || providerName(savedCountRecord.paper.source)
      : null);
    return {
      id, title: fields((paper) => paper.title, (live) => live.title) || 'Untitled publication',
      authors, abstract: fields((paper) => paper.abstract, (live) => live.abstract) || '',
      year: fields((paper) => paper.publicationYear, (live) => live.year),
      doi: fields((paper) => paper.doi, (live) => live.doi),
      venue: fields((paper) => paper.venue, (live) => live.venue),
      source: providers.join(', ') || records[0].paper.source,
      externalId: fields((paper) => paper.externalId, (live) => live.providerId),
      identifiers: records.reduce<PublicationIdentifiers>((merged, { paper, live }) => ({
        ...merged, ...paper.identifiers,
        ...(live?.provider === 'OpenAlex' && live.providerId ? { openAlexId: live.providerId } : {}),
        ...(live?.provider === 'Semantic Scholar' && live.providerId ? { semanticScholarId: live.providerId } : {}),
      }), {}),
      discoveredIdentifiers: records.reduce<PublicationIdentifiers & { doi?: string }>((merged, { paper }) => ({
        ...merged, ...paper.discoveredIdentifiers,
      }), {}),
      metadataStatus: records.some(({ paper }) => paper.metadataStatus === 'matched') ? 'matched' :
        records.find(({ paper }) => paper.metadataStatus)?.paper.metadataStatus || 'pending',
      metadataProvider: records.find(({ paper }) => paper.metadataProvider)?.paper.metadataProvider,
      metadataVerificationMethod: records.find(({ paper }) => paper.metadataVerificationMethod)?.paper.metadataVerificationMethod,
      metadataError: records.find(({ paper }) => paper.metadataError)?.paper.metadataError,
      metadataCandidates: records.flatMap(({ paper }) => (paper.metadataCandidates || [])
        .map((candidate) => ({ ...candidate, recordId: String(paper._id) }))).slice(0, 10),
      metadataLastEnrichedAt: records.find(({ paper }) => paper.metadataLastEnrichedAt)?.paper.metadataLastEnrichedAt,
      publicationUrl: fields((paper) => paper.publicationUrl, (live) => live.url),
      paperType: fields((paper) => paper.paperType, (live) => live.paperType),
      keywords,
      citationCount: liveCountRecord?.live?.citationCount ?? savedCountRecord?.paper.citationCount ?? null,
      citationCountSource: countSource || (savedCountRecord ? providerName(savedCountRecord.paper.citationMetadataSource) || providerName(savedCountRecord.paper.source) : null),
      citationCountRetrievedAt: liveCountRecord ? refreshedAt : savedCountRecord?.paper.citationRetrievedAt || null,
      referenceCount,
      referenceIds: [...new Set(uniqueEvidence.map((item) => item.id))],
      relationshipSource: [...new Set(uniqueEvidence.map((item) => item.provider))].join(', ') || providers.join(', ') || null,
      providerRecordFound: records.some(({ live }) => Boolean(live)),
    };
  });
  const edges = new Map<string, { source: string; target: string; provider: string; retrievedAt: string | null }>();
  for (const [sourceId, evidence] of evidenceByPaper) {
    for (const reference of evidence) {
      const targetId = [
        providerIdentifierAlias(reference.id, reference.provider),
        ...doiAliases(reference.id),
      ].filter((alias): alias is string => !!alias).map((alias) => byAlias.get(alias)).find(Boolean);
      if (!targetId || targetId === sourceId) continue;
      const key = `${sourceId}>${targetId}`;
      const previous = edges.get(key);
      edges.set(key, {
        source: sourceId, target: targetId,
        provider: [...new Set([...(previous?.provider.split(', ') || []), reference.provider])].join(', '),
        retrievedAt: previous?.retrievedAt || reference.retrievedAt,
      });
    }
  }
  const savedProviders = [...new Set(papers
    .filter((paper) => paper.providerRecordFound || paper.referenceIds.length > 0 || paper.referenceCount != null || paper.citationCount != null)
    .map((paper) => paper.relationshipSource || paper.citationCountSource)
    .filter((provider): provider is Exclude<typeof provider, null> => provider !== null))];
  return res.json({
    papers, edges: [...edges.values()],
    coverage: {
      totalPublications: papers.length,
      networkedPublications: papers.length,
      savedRecords: Math.max(0, totalSavedCount - demoRecordsExcluded),
      networkLimit: 100,
      networkLimitReached: Math.max(0, totalSavedCount - demoRecordsExcluded) > saved.length,
      demoRecordsExcluded,
      unresolvedPublications,
      papersWithReferenceData: papers.filter((paper) => paper.referenceCount != null || paper.referenceIds.length > 0).length,
      citationRelationships: edges.size,
      provider: refresh === 'true'
        ? (refreshCandidates === 0
          ? 'No supported provider identifiers available'
          : [...new Set([...fetched.values()].map((item) => item?.provider).filter(Boolean))].join(', ') || 'No matching provider records found')
        : savedProviders.length ? `Saved ${savedProviders.join(', ')} metadata` : 'No citation provider metadata available',
      retrievedAt: refreshedAt,
      refreshCandidates,
      refreshedRecords: fetched.size,
      refreshLimit: 30,
      refreshLimitReached: capped,
      note: refresh === 'true'
        ? refreshCandidates === 0
          ? 'No verified citation-provider identifier is available yet. Resolve missing metadata to search and verify DOI and provider records before retrieving citation data.'
          : 'Provider citation counts and reference lists are reported with their source. The graph shows verified library-to-library relationships; exploring a paper can expand provider-returned external works.'
        : 'Only saved provider reference lists are used. Select “Refresh provider data” to retrieve current metadata; no citation links are inferred.',
      ...(demoRecordsExcluded ? { excludedDemoNote: `${demoRecordsExcluded} fictional DEMO publication(s) were excluded from citation statistics and relationships.` } : {}),
    },
  });
});

export const resolveMissingMetadata = asyncHandler(async (req, res) => {
  const { projectId, paperIds } = enrichmentBody.parse(req.body || {});
  if (projectId && !await Project.exists({ _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId })) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const filter: Record<string, unknown> = {
    ownerId: req.userId,
    workspaceId: req.workspaceId,
    metadataStatus: { $ne: 'matched' },
    $nor: [{ isDemo: true }, { source: /^demo$/i }, { externalId: /^demo:/i }],
  };
  if (projectId) filter.projectId = projectId;
  if (paperIds?.length) filter._id = { $in: paperIds };
  const papers = await Paper.find(filter).sort({ createdAt: -1 }).limit(100).select('_id metadataStatus').lean<Array<{ _id: string | { toString(): string }; metadataStatus?: string }>>();
  const unresolved = papers.filter((paper) => paper.metadataStatus !== 'matched');
  let queued = 0;
  unresolved.forEach((paper) => {
    if (enqueuePaperEnrichment(req.userId!, String(paper._id))) queued += 1;
  });
  return res.status(202).json({ queued, alreadyInProgress: unresolved.length - queued, checked: papers.length });
});

export const verifyMetadataMatch = asyncHandler(async (req, res) => {
  const paperId = paperIdSchema.parse(req.params.paperId);
  const { provider, providerId } = verifyMatchBody.parse(req.body);
  const paper = await Paper.findOne({ _id: paperId, ownerId: req.userId, workspaceId: req.workspaceId }).lean<SavedPaper>().exec();
  if (!paper || isDemoPaper(paper)) return res.status(404).json({ error: 'Publication not found.' });
  const candidate = paper.metadataCandidates?.find((item) => item.provider === provider && item.providerId === providerId) as
    | { provider: string; providerId: string; title?: string; doi?: string }
    | undefined;
  if (!candidate || !candidate.title) return res.status(404).json({ error: 'That provider match is no longer available. Resolve metadata again.' });
  if (normalizedTitle(candidate.title) !== normalizedTitle(paper.title)) {
    return res.status(409).json({ error: 'The candidate title does not exactly match this publication.' });
  }
  const identifiers: PublicationIdentifiers = { ...paper.identifiers };
  if (provider === 'OpenAlex') identifiers.openAlexId = providerId;
  if (provider === 'Semantic Scholar') identifiers.semanticScholarId = providerId;
  if (provider === 'arXiv') identifiers.arxivId = providerId;
  if (provider === 'PubMed') identifiers.pmid = providerId;
  const now = new Date();
  await Paper.updateOne({ _id: paperId, ownerId: req.userId, workspaceId: req.workspaceId }, {
    $set: {
      identifiers,
      ...(normalizeDoi(candidate.doi) ? { doi: normalizeDoi(candidate.doi) } : {}),
      metadataStatus: 'matched',
      metadataProvider: provider,
      metadataVerificationMethod: 'researcher',
      metadataCandidates: [candidate],
      metadataError: '',
      metadataLastEnrichedAt: now,
    },
  });
  enqueuePaperEnrichment(req.userId!, paperId);
  return res.status(202).json({ status: 'matched', verificationMethod: 'researcher' });
});

export const explore = asyncHandler(async (req, res) => {
  const paperId = paperIdSchema.parse(req.params.paperId);
  const paper = await Paper.findOne({ _id: paperId, ownerId: req.userId, workspaceId: req.workspaceId }).lean<SavedPaper>().exec();
  if (!paper) return res.status(404).json({ error: 'Paper not found.' });
  if (paper.isDemo || paper.source?.toLowerCase() === 'demo' || paper.externalId?.toLowerCase().startsWith('demo:')) {
    return res.status(404).json({ error: 'Fictional DEMO records are not available in citation exploration.' });
  }
  const saved = await loadNetworkPapers(req.userId!, req.workspaceId!);
  const byAlias = new Map<string, { id: string; title: string; publicationUrl?: string; doi?: string }>();
  saved.forEach((item) => aliases(item, item.source).forEach((alias) => byAlias.set(alias, {
    id: String(item._id), title: item.title, publicationUrl: item.publicationUrl, doi: item.doi,
  })));
  const metadata = await fetchCitationMetadata(paper);
  const savedProvider = providerName(paper.citationMetadataSource) || providerName(paper.source);
  const referenceIds = metadata?.referenceIds || (savedProvider ? paper.referencedWorks || [] : []);
  const references = referenceIds.map((id) => {
    const local = [
      providerIdentifierAlias(id, metadata?.provider || paper.source),
      ...doiAliases(id),
    ].filter((alias): alias is string => !!alias).map((alias) => byAlias.get(alias)).find(Boolean);
    const fromMetadata = metadata?.references.find((item) => item.id.toLowerCase() === id.toLowerCase());
    return {
      id: local?.id || id, providerId: id, title: local?.title || fromMetadata?.title || id,
      doi: local?.doi || fromMetadata?.doi, url: local?.publicationUrl || fromMetadata?.url,
      inLibrary: Boolean(local),
    };
  });
  const internalCiting = saved.filter((candidate) => (providerName(candidate.citationMetadataSource) || providerName(candidate.source)) &&
    candidate.referencedWorks?.some((ref) => {
      const target = [
        providerIdentifierAlias(ref, candidate.source),
        ...doiAliases(ref),
      ].filter((alias): alias is string => !!alias).map((alias) => byAlias.get(alias)).find(Boolean);
      return target?.id === String(paper._id);
    }),
  ).map((candidate) => ({
    id: String(candidate._id), title: candidate.title, year: candidate.publicationYear,
    doi: candidate.doi, authors: candidate.authors || [], url: candidate.publicationUrl,
    source: providerName(candidate.citationMetadataSource) || providerName(candidate.source) || 'Saved reference metadata',
  }));
  const liveCiting = metadata?.provider === 'OpenAlex'
    ? await fetchOpenAlexCiting(metadata.providerId)
    : metadata?.provider === 'Semantic Scholar'
      ? metadata.citing
      : paper.citingWorks || [];
  const citing = [...new Map([...internalCiting, ...liveCiting].map((item) => [item.doi?.toLowerCase() || item.id.toLowerCase(), item])).values()];
  return res.json({
    paper: {
      id: String(paper._id), title: metadata?.title || paper.title, authors: metadata?.authors.length ? metadata.authors : paper.authors || [],
      abstract: metadata?.abstract || paper.abstract || '',
      year: metadata?.year ?? paper.publicationYear, doi: metadata?.doi || paper.doi,
      venue: metadata?.venue || paper.venue, publicationUrl: metadata?.url || paper.publicationUrl,
      citationCount: metadata?.citationCount ?? (savedProvider ? paper.citationCount ?? null : null),
      referenceCount: metadata?.referenceCount ?? (savedProvider
        ? paper.referenceCount ?? (paper.referencedWorks?.length ? paper.referencedWorks.length : null)
        : null),
    },
    provider: metadata?.provider || paper.citingSource || providerName(paper.citationMetadataSource) || providerName(paper.source),
    retrievedAt: metadata ? new Date().toISOString() : paper.citingRetrievedAt ? new Date(paper.citingRetrievedAt).toISOString() : null,
    references, citing,
    note: metadata
      ? `${metadata.provider} data retrieved now. Citing publications are direct provider records; related-work similarity is calculated separately from shared references.`
      : 'No supported provider record is available for this paper. Saved reference data is shown where present; missing citation metadata is not treated as zero.',
  });
});

export const list = asyncHandler(async (req, res) => res.json({ items: await Citation.find({ ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).lean() }));
export const create = asyncHandler(async (req, res) => {
  const input = requestSchema.parse(req.body);
  const paper = await Paper.findOne({ _id: input.paperId, ownerId: req.userId, workspaceId: req.workspaceId });
  if (!paper) return res.status(404).json({ error: 'Paper not found.' });
  const formattedText = formatCitation(paper, input.style);
  return res.status(201).json(await Citation.create({
    paperId: paper._id, ownerId: req.userId, workspaceId: req.workspaceId, style: input.style, formattedText,
  }));
});
