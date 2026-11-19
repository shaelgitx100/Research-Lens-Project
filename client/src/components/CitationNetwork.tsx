import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, ExternalLink, Filter, GitBranch, RefreshCw, Search, X } from 'lucide-react';
import { GraphCanvas } from '../graph/GraphCanvas';
import './citation-network.css';

type NetworkPaper = {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year?: number;
  doi?: string;
  venue?: string;
  source?: string;
  externalId?: string;
  identifiers?: { openAlexId?: string; semanticScholarId?: string; arxivId?: string; pmid?: string };
  discoveredIdentifiers?: { doi?: string; openAlexId?: string; semanticScholarId?: string; arxivId?: string; pmid?: string };
  metadataStatus?: string;
  metadataProvider?: string;
  metadataVerificationMethod?: string;
  metadataError?: string;
  metadataCandidates?: Array<{ provider?: string; providerId?: string; recordId?: string; title?: string; doi?: string; year?: number; reason?: string }>;
  metadataLastEnrichedAt?: string | null;
  publicationUrl?: string;
  paperType?: string;
  keywords: string[];
  citationCount: number | null;
  citationCountSource: string | null;
  citationCountRetrievedAt: string | null;
  referenceCount: number | null;
  referenceIds: string[];
  relationshipSource: string | null;
  providerRecordFound: boolean;
};
type GraphPaper = NetworkPaper & { isExternal?: boolean };

type NetworkEdge = { source: string; target: string; provider: string; retrievedAt: string | null };
type NetworkData = {
  papers: NetworkPaper[];
  edges: NetworkEdge[];
  coverage: {
    totalPublications: number;
    networkedPublications: number;
    savedRecords: number;
    networkLimit: number;
    networkLimitReached: boolean;
    unresolvedPublications: number;
    papersWithReferenceData: number;
    citationRelationships: number;
    demoRecordsExcluded: number;
    provider: string;
    retrievedAt: string | null;
    refreshedRecords: number;
    refreshLimit: number;
    refreshLimitReached: boolean;
    note: string;
  };
};
type ExploredPaper = {
  paper: {
    id: string;
    citationCount?: number | null;
    referenceCount?: number | null;
  };
  provider: string | null;
  retrievedAt: string | null;
  references: Array<{ id: string; providerId?: string; title: string; doi?: string; url?: string; inLibrary: boolean }>;
  citing: Array<{ id: string; title: string; doi?: string; year?: number; authors: string[]; url?: string; source?: string }>;
  note: string;
};
type ProjectOption = { _id: string; title: string };
const CLUSTER_COLORS = [
  'var(--citation-cluster-1)', 'var(--citation-cluster-2)', 'var(--citation-cluster-3)',
  'var(--citation-cluster-4)', 'var(--citation-cluster-5)', 'var(--citation-cluster-6)',
  'var(--citation-cluster-7)',
];
const METADATA_STATUS: Record<string, string> = {
  pending: 'Queued', resolving: 'In progress', matched: 'Successfully matched',
  ambiguous: 'Needs verification', not_found: 'No matching publication found',
  provider_unavailable: 'Provider temporarily unavailable',
};
const metadataStatusLabel = (status?: string) => METADATA_STATUS[status || ''] || 'Not resolved';
const paperMetadataStatus = (paper: NetworkPaper) => {
  if (paper.metadataStatus === 'matched' && paper.metadataVerificationMethod === 'researcher') return 'Researcher verified';
  if (paper.metadataStatus === 'pending' && Object.values(paper.discoveredIdentifiers || {}).some(Boolean)) return 'Identifiers found · queued';
  if (paper.metadataStatus === 'resolving' && Object.values(paper.discoveredIdentifiers || {}).some(Boolean)) return 'Identifiers found · in progress';
  return metadataStatusLabel(paper.metadataStatus);
};
const labelSource = (source?: string | null) => source === 'semanticscholar' ? 'Semantic Scholar' : source === 'openalex' ? 'OpenAlex' : source === 'crossref' ? 'Crossref' : source || 'Provider metadata';
const safeHref = (value?: string) => value && /^https?:\/\//i.test(value) ? value : undefined;
const canonical = (value: string) => value.toLocaleLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '').replace(/^doi:/, '').trim();

async function requestJson<T>(url: string, token: string, workspaceId: string, signal?: AbortSignal, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Workspace-Id', workspaceId);
  const response = await fetch(url, { ...init, headers, signal });
  const body = await response.text();
  let data: { error?: string } & T;
  try { data = JSON.parse(body) as { error?: string } & T; }
  catch { throw new Error(response.ok ? 'The citation service returned an invalid response.' : `Citation request failed (${response.status}).`); }
  if (!response.ok) throw new Error(data.error || `Citation request failed (${response.status}).`);
  return data;
}

function connectedClusters(papers: NetworkPaper[], edges: NetworkEdge[]) {
  const parent = new Map(papers.map((paper) => [paper.id, paper.id]));
  const find = (id: string): string => {
    const root = parent.get(id) || id;
    if (root === id) return root;
    const next = find(root);
    parent.set(id, next);
    return next;
  };
  edges.forEach(({ source, target }) => {
    if (!parent.has(source) || !parent.has(target)) return;
    const a = find(source), b = find(target);
    if (a !== b) parent.set(a, b);
  });
  const members = new Map<string, string[]>();
  papers.forEach(({ id }) => {
    const root = find(id);
    members.set(root, [...(members.get(root) || []), id]);
  });
  const roots = [...members].filter(([, ids]) => ids.length > 1).sort((a, b) => b[1].length - a[1].length);
  const byPaper = new Map<string, string>();
  roots.forEach(([root, ids], index) => ids.forEach((id) => byPaper.set(id, root)));
  return { byPaper, clusters: roots.map(([id, ids], index) => ({ id, ids, label: `Citation cluster ${index + 1}`, color: CLUSTER_COLORS[index % CLUSTER_COLORS.length] })) };
}

function findCitationPath(source: string, target: string, edges: NetworkEdge[]) {
  const next = new Map<string, string[]>();
  edges.forEach((edge) => next.set(edge.source, [...(next.get(edge.source) || []), edge.target]));
  const queue = [source], previous = new Map<string, string | null>([[source, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current === target) break;
    for (const neighbor of next.get(current) || []) {
      if (previous.has(neighbor)) continue;
      previous.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  if (!previous.has(target)) return [];
  const path = [target];
  for (let cursor = previous.get(target); cursor; cursor = previous.get(cursor)) path.unshift(cursor);
  return path;
}

export default function CitationNetwork({ token, workspaceId, projects, initialProjectId }: {
  token: string;
  workspaceId: string;
  projects: ProjectOption[];
  initialProjectId?: string;
}) {
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingMetadata, setResolvingMetadata] = useState(false);
  const [verifyingMatch, setVerifyingMatch] = useState('');
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explored, setExplored] = useState<ExploredPaper | null>(null);
  const [exploring, setExploring] = useState(false);
  const [exploreError, setExploreError] = useState('');
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [topic, setTopic] = useState('');
  const [paperType, setPaperType] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [pathTarget, setPathTarget] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [graphResetKey, setGraphResetKey] = useState(0);

  useEffect(() => {
    setProjectId(initialProjectId || '');
  }, [initialProjectId]);

  useEffect(() => {
    const abort = new AbortController();
    const queryString = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    setLoading(true);
    setData(null);
    setError('');
    setSelectedId(null);
    setExplored(null);
    requestJson<NetworkData>(`/api/citations/network${queryString}`, token, workspaceId, abort.signal)
      .then(setData)
      .catch((cause: Error) => { if (cause.name !== 'AbortError') setError(cause.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [projectId, token, workspaceId]);

  const papers = data?.papers || [];
  const unresolvedCount = data?.coverage.unresolvedPublications ?? papers.filter((paper) => paper.metadataStatus !== 'matched').length;
  const enrichmentActive = papers.some((paper) => ['pending', 'resolving'].includes(paper.metadataStatus || ''));
  useEffect(() => {
    if (!enrichmentActive) return;
    const timer = window.setInterval(() => {
      const queryString = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      requestJson<NetworkData>(`/api/citations/network${queryString}`, token, workspaceId)
        .then(setData)
        .catch((cause: Error) => setError(cause.message));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [enrichmentActive, projectId, token, workspaceId]);
  const paperById = useMemo(() => new Map(papers.map((paper) => [paper.id, paper])), [papers]);
  const expanded = useMemo(() => {
    if (!explored) return { papers: [] as GraphPaper[], edges: [] as NetworkEdge[] };
    const externalPapers = new Map<string, GraphPaper>();
    const edges = new Map<string, NetworkEdge>();
    const addEdge = (source: string, target: string, provider?: string | null) => {
      edges.set(`${source}>${target}`, { source, target, provider: provider || explored.provider || 'Provider', retrievedAt: explored.retrievedAt });
    };
    explored.references.forEach((reference) => {
      if (!reference.id) return;
      if (reference.inLibrary) {
        addEdge(explored.paper.id, reference.id);
        return;
      }
      externalPapers.set(reference.id, {
        id: reference.id, title: reference.title === reference.id ? `External reference · ${reference.id}` : reference.title,
        authors: [], abstract: '', doi: reference.doi, publicationUrl: reference.url,
        keywords: [], citationCount: null, citationCountSource: null, citationCountRetrievedAt: null,
        referenceCount: null, referenceIds: [], relationshipSource: explored.provider,
        providerRecordFound: true, source: explored.provider || undefined, isExternal: true,
      });
      addEdge(explored.paper.id, reference.id);
    });
    explored.citing.forEach((citation) => {
      if (!citation.id) return;
      if (paperById.has(citation.id)) {
        addEdge(citation.id, explored.paper.id, citation.source);
        return;
      }
      externalPapers.set(citation.id, {
        id: citation.id, title: citation.title, authors: citation.authors || [], abstract: '',
        year: citation.year, doi: citation.doi, publicationUrl: citation.url,
        keywords: [], citationCount: null, citationCountSource: null, citationCountRetrievedAt: null,
        referenceCount: null, referenceIds: [], relationshipSource: citation.source || explored.provider,
        providerRecordFound: true, source: citation.source || explored.provider || undefined, isExternal: true,
      });
      addEdge(citation.id, explored.paper.id, citation.source);
    });
    return { papers: [...externalPapers.values()], edges: [...edges.values()] };
  }, [explored, paperById]);
  const graphPapers = useMemo<GraphPaper[]>(() => [
    ...papers.map((paper) => explored?.paper.id === paper.id ? {
      ...paper,
      citationCount: explored.paper.citationCount ?? paper.citationCount,
      citationCountSource: explored.paper.citationCount != null ? explored.provider : paper.citationCountSource,
      citationCountRetrievedAt: explored.paper.citationCount != null ? explored.retrievedAt : paper.citationCountRetrievedAt,
      referenceCount: explored.paper.referenceCount ?? paper.referenceCount,
      referenceIds: explored.references.map((reference) => reference.providerId || reference.id),
    } : paper),
    ...expanded.papers,
  ], [papers, explored, expanded.papers]);
  const graphEdgesData = useMemo(() => [...(data?.edges || []), ...expanded.edges], [data?.edges, expanded.edges]);
  const graphPaperById = useMemo(() => new Map(graphPapers.map((paper) => [paper.id, paper])), [graphPapers]);
  const clusters = useMemo(() => connectedClusters(graphPapers, graphEdgesData), [graphPapers, graphEdgesData]);
  const years = useMemo(() => [...new Set(papers.map((paper) => paper.year).filter((year): year is number => Number.isInteger(year)))].sort((a, b) => a - b), [papers]);
  const topics = useMemo(() => [...new Set(papers.flatMap((paper) => paper.keywords).map((tag) => tag.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [papers]);
  const types = useMemo(() => [...new Set(papers.map((paper) => paper.paperType).filter((type): type is string => !!type))].sort(), [papers]);
  const selected = selectedId ? graphPaperById.get(selectedId) : undefined;

  const filteredPapers = useMemo(() => graphPapers.filter((paper) => {
    if (query && !paper.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    if (author && !paper.authors.some((name) => name.toLocaleLowerCase().includes(author.toLocaleLowerCase()))) return false;
    if (yearFrom && (paper.year || 0) < Number(yearFrom)) return false;
    if (yearTo && (paper.year || 9999) > Number(yearTo)) return false;
    if (topic && !paper.keywords.includes(topic)) return false;
    if (paperType && paper.paperType !== paperType) return false;
    if (clusterId && clusters.byPaper.get(paper.id) !== clusterId) return false;
    if (connectedOnly && !graphEdgesData.some((edge) => edge.source === paper.id || edge.target === paper.id)) return false;
    return true;
  }), [graphPapers, query, author, yearFrom, yearTo, topic, paperType, clusterId, connectedOnly, clusters.byPaper, graphEdgesData]);
  const visibleIds = useMemo(() => new Set(filteredPapers.map((paper) => paper.id)), [filteredPapers]);
  const visibleEdges = useMemo(() => graphEdgesData.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graphEdgesData, visibleIds]);

  const refresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      const queryString = new URLSearchParams({ refresh: 'true', ...(projectId ? { projectId } : {}) });
      setData(await requestJson<NetworkData>(`/api/citations/network?${queryString}`, token, workspaceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not refresh provider citation data.');
    } finally { setRefreshing(false); }
  };
  const resolveMetadata = async () => {
    setResolvingMetadata(true);
    setResolutionMessage('');
    setError('');
    try {
      const result = await requestJson<{ queued: number; alreadyInProgress: number; checked: number }>(
        '/api/citations/resolve-metadata', token, workspaceId, undefined,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectId ? { projectId } : {}) },
      );
      setResolutionMessage(result.queued
        ? `Resolving metadata for ${result.queued} publication${result.queued === 1 ? '' : 's'}. Results will appear here.`
        : result.alreadyInProgress
          ? 'Metadata resolution is already in progress.'
          : 'No unresolved publications found in this scope.');
      const queryString = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      setData(await requestJson<NetworkData>(`/api/citations/network${queryString}`, token, workspaceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resolve publication metadata.');
    } finally { setResolvingMetadata(false); }
  };
  const verifyCandidate = async (paper: NetworkPaper, candidate: NonNullable<NetworkPaper['metadataCandidates']>[number]) => {
    if (!candidate.provider || !candidate.providerId) return;
    const key = `${paper.id}:${candidate.providerId}`;
    setVerifyingMatch(key);
    setError('');
    try {
      await requestJson(`/api/citations/network/${encodeURIComponent(candidate.recordId || paper.id)}/verify-match`, token, workspaceId, undefined, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: candidate.provider, providerId: candidate.providerId }),
      });
      setResolutionMessage(`Confirmed ${candidate.provider} metadata for “${paper.title}”.`);
      const queryString = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      setData(await requestJson<NetworkData>(`/api/citations/network${queryString}`, token, workspaceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not confirm this provider match.');
    } finally { setVerifyingMatch(''); }
  };
  const exploreSelected = async () => {
    if (!selectedId) return;
    setExploring(true);
    setExploreError('');
    try {
      setExplored(await requestJson<ExploredPaper>(`/api/citations/network/${encodeURIComponent(selectedId)}/explore`, token, workspaceId));
    } catch (cause) {
      setExploreError(cause instanceof Error ? cause.message : 'Could not retrieve citation details.');
    } finally { setExploring(false); }
  };
  const exportGraph = () => {
    if (!data) return;
    const contents = JSON.stringify({
      exportedAt: new Date().toISOString(),
      provenance: data.coverage,
      papers: filteredPapers,
      relationships: visibleEdges,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `researchlens-citation-network-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const resetFilters = () => {
    setQuery(''); setAuthor(''); setYearFrom(''); setYearTo(''); setTopic('');
    setPaperType(''); setClusterId(''); setConnectedOnly(false); setPath([]);
  };

  const incomingCount = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.edges || []).forEach((edge) => counts.set(edge.target, (counts.get(edge.target) || 0) + 1));
    return counts;
  }, [data?.edges]);
  const mostCited = useMemo(() => papers.filter((paper) => paper.citationCount !== null)
    .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0)).slice(0, 5), [papers]);
  const influentialAuthors = useMemo(() => {
    const scores = new Map<string, number>();
    papers.forEach((paper) => paper.authors.forEach((name) => scores.set(name, (scores.get(name) || 0) + (incomingCount.get(paper.id) || 0))));
    return [...scores].filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [papers, incomingCount]);
  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>();
    papers.forEach((paper) => { if (paper.year) counts.set(paper.year, (counts.get(paper.year) || 0) + 1); });
    return [...counts].sort((a, b) => a[0] - b[0]);
  }, [papers]);
  const topicClusters = useMemo(() => topics.map((tag) => ({
    tag,
    count: papers.filter((paper) => paper.keywords.includes(tag)).length,
  })).filter((item) => item.count > 1).sort((a, b) => b.count - a.count), [topics, papers]);
  const emergingTopics = useMemo(() => {
    if (years.length < 2) return [];
    const latestYear = years[years.length - 1];
    const recent = papers.filter((paper) => paper.year !== undefined && paper.year >= latestYear - 2 && paper.year <= latestYear);
    const previous = papers.filter((paper) => paper.year !== undefined && paper.year >= latestYear - 5 && paper.year < latestYear - 2);
    if (recent.length < 3 || previous.length < 3) return [];
    const counts = (items: NetworkPaper[]) => {
      const result = new Map<string, { label: string; count: number }>();
      items.forEach((paper) => new Set(paper.keywords).forEach((tag) => {
        const key = tag.toLocaleLowerCase();
        const entry = result.get(key) || { label: tag, count: 0 };
        entry.count += 1;
        result.set(key, entry);
      }));
      return result;
    };
    const recentCounts = counts(recent), previousCounts = counts(previous);
    return [...recentCounts].filter(([key, item]) => item.count >= 2 && item.count > (previousCounts.get(key)?.count || 0))
      .map(([, item]) => item).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [papers, years]);
  const selectedIncoming = selectedId ? visibleEdges.filter((edge) => edge.target === selectedId).map((edge) => edge.source) : [];
  const selectedOutgoing = selectedId ? visibleEdges.filter((edge) => edge.source === selectedId).map((edge) => edge.target) : [];
  const relatedByReferences = useMemo(() => {
    if (!selected) return [];
    const selectedRefs = new Set(selected.referenceIds.map(canonical));
    return papers.filter((paper) => paper.id !== selected.id).map((paper) => ({
      paper,
      shared: paper.referenceIds.filter((ref) => selectedRefs.has(canonical(ref))).length,
    })).filter((item) => item.shared > 0).sort((a, b) => b.shared - a.shared).slice(0, 5);
  }, [selected, papers]);
  const coCited = useMemo(() => {
    if (!selectedId) return [];
    const citedTogether = new Map<string, number>();
    const citingSelected = new Set(graphEdgesData.filter((edge) => edge.target === selectedId).map((edge) => edge.source));
    graphEdgesData.filter((edge) => citingSelected.has(edge.source) && edge.target !== selectedId)
      .forEach((edge) => citedTogether.set(edge.target, (citedTogether.get(edge.target) || 0) + 1));
    return [...citedTogether].map(([id, count]) => ({ paper: graphPaperById.get(id), count }))
      .filter((item): item is { paper: GraphPaper; count: number } => !!item.paper)
      .sort((a, b) => b.count - a.count).slice(0, 5);
  }, [selectedId, graphEdgesData, graphPaperById]);
  const graphNodes = filteredPapers.map((paper) => {
    let color = paper.isExternal ? 'var(--citation-node-external)' : clusters.clusters.find((cluster) => cluster.id === clusters.byPaper.get(paper.id))?.color || 'var(--citation-node-default)';
    if (selectedId && paper.id === selectedId) color = 'var(--citation-node-selected)';
    else if (selectedId && selectedIncoming.includes(paper.id)) color = 'var(--citation-node-citing)';
    else if (selectedId && selectedOutgoing.includes(paper.id)) color = 'var(--citation-node-cited)';
    const radius = paper.citationCount === null ? 11 : 11 + Math.min(8, Math.log10(paper.citationCount + 1) * 2);
    return { id: paper.id, label: paper.title, color, radius, status: `Metadata: ${paperMetadataStatus(paper)}` };
  });
  const graphEdges = visibleEdges.map((edge, index) => ({
    id: `${edge.source}>${edge.target}:${index}`, source: edge.source, target: edge.target, directed: true,
    label: `Direct citation relationship · ${edge.provider}${edge.retrievedAt ? ` · retrieved ${new Date(edge.retrievedAt).toLocaleString()}` : ' · saved provider reference list'}`,
  }));
  const pathPapers = path.map((id) => paperById.get(id)).filter((paper): paper is NetworkPaper => !!paper);
  const maxYearCount = Math.max(1, ...yearCounts.map(([, count]) => count));
  const selectedLink = safeHref(selected?.publicationUrl) || (selected?.doi ? `https://doi.org/${encodeURIComponent(selected.doi)}` : undefined);
  const selectedCitationCount = explored && selected && explored.paper.id === selected.id
    ? explored.paper.citationCount ?? selected.citationCount
    : selected?.citationCount;
  const selectedCitationSource = explored && selected && explored.paper.id === selected.id && explored.paper.citationCount != null
    ? explored.provider
    : selected?.citationCountSource;
  const selectGraphNode = (id: string | null) => {
    setSelectedId(id);
    if (id && paperById.has(id)) setExplored((current) => current?.paper.id === id ? current : null);
  };

  return (
    <section className="citation-network">
      <header className="citation-heading">
        <div>
          <div className="section-kicker">SOURCE-VERIFIED PUBLICATION RELATIONSHIPS</div>
          <h2>Citation network</h2>
          <p>Trace direct references and cited-by records. Similarity measures are labeled separately from citation evidence.</p>
        </div>
        <div className="citation-heading-actions">
          <label className="citation-project-filter">Scope
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">All saved publications</option>
              {projects.map((project) => <option key={project._id} value={project._id}>{project.title}</option>)}
            </select>
          </label>
          <button className="button secondary" onClick={exportGraph} disabled={!data || !filteredPapers.length}><Download size={15}/> Export data</button>
          <button className="button secondary" onClick={resolveMetadata} disabled={loading || resolvingMetadata || !unresolvedCount}><Search size={15} className={resolvingMetadata ? 'citation-spin' : ''}/>{resolvingMetadata ? 'Resolving…' : 'Resolve Missing Metadata'}</button>
          <button className="button primary" onClick={refresh} disabled={loading || refreshing || !papers.length}><RefreshCw size={15} className={refreshing ? 'citation-spin' : ''}/>{refreshing ? 'Refreshing…' : 'Refresh provider data'}</button>
        </div>
      </header>

      {error && <div className="citation-alert" role="alert">{error}</div>}
      {resolutionMessage && <div className="citation-status-message" role="status">{resolutionMessage}</div>}
      {loading && <div className="citation-state" role="status"><span className="citation-spinner"/>Loading saved publications and citation data…</div>}
      {!loading && !error && !papers.length && (
        <div className="citation-empty">
          <GitBranch size={24}/>
          <div><h3>No source-backed publications in this scope</h3><p>{data?.coverage.demoRecordsExcluded
            ? `${data.coverage.demoRecordsExcluded} fictional DEMO publication(s) were excluded. Save real publications from scholarly providers to build a citation network.`
            : 'Save publications from scholarly providers to start a source-backed citation network. No demonstration records are shown.'}</p></div>
        </div>
      )}
      {!loading && data && papers.length > 0 && <>
        <div className="citation-provenance">
          <span className="citation-provenance-mark"/> {data.coverage.note}
          <span className="citation-provenance-source">{data.coverage.provider}</span>
          {data.coverage.demoRecordsExcluded > 0 && <span>{data.coverage.demoRecordsExcluded} DEMO records excluded</span>}
          {data.coverage.retrievedAt && <span>Retrieved {new Date(data.coverage.retrievedAt).toLocaleString()}</span>}
        </div>

        <div className="citation-metrics">
          <article><span>{data.coverage.networkLimitReached ? 'Unique publications loaded' : 'Total publications'}</span><strong>{data.coverage.totalPublications}</strong><small>{data.coverage.networkLimitReached ? `${data.coverage.savedRecords} saved records; graph is capped` : `${data.coverage.savedRecords} saved records · duplicates merged`}</small></article>
          <article><span>Citation relationships</span><strong>{data.coverage.citationRelationships}</strong><small>{data.coverage.networkLimitReached ? 'Verified links among loaded papers' : 'Verified directed links in library'}</small></article>
          <article><span>Reference coverage</span><strong>{data.coverage.papersWithReferenceData}<i> / {data.coverage.networkedPublications}</i></strong><small>Unique graph papers with reference-list metadata</small></article>
          <article><span>Connected communities</span><strong>{clusters.clusters.length}</strong><small>Components with direct citation links</small></article>
        </div>

        <div className="citation-analytics">
          <section className="citation-card citation-timeline">
            <div className="citation-card-head"><div><span className="section-kicker">PUBLICATION TIMELINE</span><h3>Research over time</h3></div><span>{yearCounts.length ? `${papers.filter((paper) => paper.year).length} dated records` : 'No year metadata'}</span></div>
            {yearCounts.length ? <div className="citation-bars" aria-label="Publication-year distribution">
              {yearCounts.map(([year, count]) => <button key={year} title={`${year}: ${count} publications`} aria-label={`Filter to ${year}, ${count} publications`} onClick={() => { setYearFrom(String(year)); setYearTo(String(year)); }}>
                <span style={{ height: `${Math.max(8, count / maxYearCount * 100)}%` }}/><small>{year}</small><b>{count}</b>
              </button>)}
            </div> : <p className="citation-muted">Publication years are unavailable for these records; no timeline values are inferred.</p>}
          </section>
          <section className="citation-card">
            <div className="citation-card-head"><div><span className="section-kicker">PROVIDER METRICS</span><h3>Most cited papers</h3></div></div>
            {mostCited.length ? <ol className="citation-rank-list">{mostCited.map((paper) => <li key={paper.id}>
              <button onClick={() => selectGraphNode(paper.id)}>{paper.title}</button><span>{paper.citationCount?.toLocaleString()} <small>{labelSource(paper.citationCountSource)}</small></span>
            </li>)}</ol> : <p className="citation-muted">Citation counts have not been reported by a supported provider.</p>}
          </section>
          <section className="citation-card">
            <div className="citation-card-head"><div><span className="section-kicker">NETWORK INFLUENCE</span><h3>Influential authors</h3></div></div>
            {influentialAuthors.length ? <ol className="citation-rank-list">{influentialAuthors.map(([name, count]) => <li key={name}><span className="citation-author-name">{name}</span><span>{count}<small>direct library citations</small></span></li>)}</ol> : <p className="citation-muted">Author influence is available when verified in-library citation links exist.</p>}
          </section>
          <section className="citation-card">
            <div className="citation-card-head"><div><span className="section-kicker">RESEARCH AREAS</span><h3>Topic clusters</h3></div></div>
            {topicClusters.length ? <div className="citation-topic-list">{topicClusters.slice(0, 8).map((item) => <button key={item.tag} onClick={() => setTopic(item.tag)}><span>{item.tag}</span><b>{item.count}</b></button>)}</div> : <p className="citation-muted">No shared topic keywords are available. Topic clusters use provider-supplied keywords only.</p>}
          </section>
          <section className="citation-card">
            <div className="citation-card-head"><div><span className="section-kicker">RECENT KEYWORD SIGNALS</span><h3>Emerging directions</h3></div></div>
            {emergingTopics.length
              ? <div className="citation-topic-list">{emergingTopics.map((item) => <button key={item.label} onClick={() => setTopic(item.label)}><span>{item.label}</span><b>{item.count} recent</b></button>)}</div>
              : <p className="citation-muted">Not enough dated, topic-tagged publications across both comparison periods. No emerging direction is inferred.</p>}
            <small className="citation-muted">Signals compare provider keywords in the latest three observed publication years with the preceding three; they describe this library only.</small>
          </section>
        </div>

        <section className="citation-workspace">
          <div className="citation-graph-column">
            <div className="citation-card citation-controls">
              <label className="citation-search"><Search size={15}/><input aria-label="Search publications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a publication"/></label>
              <label>Author<input aria-label="Filter by author" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Any author"/></label>
              <label>From year<select value={yearFrom} onChange={(event) => setYearFrom(event.target.value)}><option value="">Any</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
              <label>To year<select value={yearTo} onChange={(event) => setYearTo(event.target.value)}><option value="">Any</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
              <label>Topic<select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">All topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Type<select value={paperType} onChange={(event) => setPaperType(event.target.value)}><option value="">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Cluster<select value={clusterId} onChange={(event) => setClusterId(event.target.value)}><option value="">All citation clusters</option>{clusters.clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label} ({cluster.ids.length})</option>)}</select></label>
              <label className="citation-checkbox"><input type="checkbox" checked={connectedOnly} onChange={(event) => setConnectedOnly(event.target.checked)}/> Has verified links</label>
              <button className="citation-reset" onClick={resetFilters}><X size={14}/> Reset filters</button>
            </div>
            <div className="citation-legend">
              <span><i className="legend-selected"/> Selected</span><span><i className="legend-citing"/> Citing paper</span><span><i className="legend-cited"/> Cited paper</span><span><i className="legend-cluster"/> Citation community</span><span><i className="legend-external"/> Expanded provider work</span>
              <small>Node size uses provider citation counts when available; unknown counts are shown at a neutral size.</small>
            </div>
            {filteredPapers.length ? <GraphCanvas
              ariaLabel="Directed publication citation network. Arrows point from citing papers to cited papers."
              key={graphResetKey} nodes={graphNodes} edges={graphEdges} selectedId={selectedId} onSelect={selectGraphNode} height={520} draggableNodes degreeSized={false} highContrast
            /> : <div className="citation-empty citation-filter-empty"><Filter size={20}/><p>No publications match the current filters.</p><button className="button secondary" onClick={resetFilters}>Clear filters</button></div>}
            <div className="citation-graph-foot"><span>{filteredPapers.length} of {graphPapers.length} loaded graph papers · {visibleEdges.length} verified links shown</span><span>Drag nodes to arrange; drag the empty canvas to pan.</span><button className="citation-reset" onClick={() => setGraphResetKey((key) => key + 1)}>Reset graph</button></div>
            <section className="citation-card citation-enrichment">
              <div className="citation-card-head"><div><span className="section-kicker">IDENTIFIER RESOLUTION</span><h3>Publication metadata status</h3></div><span>{unresolvedCount} unresolved</span></div>
              <ul>{papers.map((paper) => <li key={paper.id}>
                <button onClick={() => selectGraphNode(paper.id)} title={paper.title}>{paper.title}</button>
                <span className={`citation-status-chip status-${paper.metadataStatus || 'unknown'}`}>{paperMetadataStatus(paper)}</span>
                {(paper.metadataProvider || paper.metadataLastEnrichedAt) && <small>{[paper.metadataProvider, paper.metadataLastEnrichedAt ? `checked ${new Date(paper.metadataLastEnrichedAt).toLocaleString()}` : ''].filter(Boolean).join(' · ')}</small>}
              </li>)}</ul>
            </section>
            {clusters.clusters.length > 0 && <div className="citation-cluster-stats">{clusters.clusters.slice(0, 5).map((cluster) => <button key={cluster.id} onClick={() => setClusterId(cluster.id)}><i style={{ backgroundColor: cluster.color }}/>{cluster.label}<b>{cluster.ids.length}</b></button>)}</div>}
            {data.coverage.refreshLimitReached && <p className="citation-muted">Only the first {data.coverage.refreshLimit} eligible records were refreshed. Filter to a project to refresh a smaller set.</p>}
            {data.coverage.networkLimitReached && <p className="citation-muted">The graph includes the newest {data.coverage.networkLimit} non-DEMO saved records for rendering performance. Duplicate works among those records are merged into unique graph papers.</p>}
          </div>

          <aside className="citation-card citation-details" aria-label="Selected publication details">
            {!selected ? <div className="citation-details-empty"><GitBranch size={20}/><p>Select a node to inspect its verified references and citing works.</p><small>Click a paper node or a ranked publication above.</small></div> : <>
              <div className="section-kicker">{selected.isExternal ? 'EXTERNAL PROVIDER RECORD' : 'PUBLICATION DETAILS'}</div>
              <h3>{selected.title}</h3>
              {!selected.isExternal && <div className={`citation-status-chip status-${selected.metadataStatus || 'unknown'}`}>Metadata · {paperMetadataStatus(selected)}{selected.metadataProvider ? ` · ${selected.metadataProvider}` : ''}</div>}
              {selected.metadataError && <p className="citation-muted">{selected.metadataError}</p>}
              {selected.metadataCandidates?.length ? <div className="citation-detail-list"><h4>{selected.metadataStatus === 'ambiguous' ? 'Possible provider matches' : 'Verified provider record'}</h4>{selected.metadataStatus === 'ambiguous' && <p>Confirm only if the publication details are correct.</p>}<ul>{selected.metadataCandidates.slice(0, 5).map((candidate, index) => <li key={`${candidate.provider}-${candidate.doi || candidate.title}-${index}`}><span>{candidate.title || 'Untitled candidate'}</span><small>{[candidate.provider, candidate.year, candidate.doi].filter(Boolean).join(' · ')}</small>{selected.metadataStatus === 'ambiguous' && <button className="citation-match-confirm" disabled={!candidate.provider || !candidate.providerId || verifyingMatch === `${selected.id}:${candidate.providerId}`} onClick={() => void verifyCandidate(selected, candidate)}>{verifyingMatch === `${selected.id}:${candidate.providerId}` ? 'Confirming…' : 'Confirm this match'}</button>}</li>)}</ul></div> : null}
              <p className="citation-detail-authors">{selected.authors.join(', ') || 'Authors unavailable'}{selected.year ? ` · ${selected.year}` : ' · Year unavailable'}</p>
              <p className="citation-detail-source">{selected.venue || 'Venue unavailable'} · {labelSource(selected.source)}</p>
              <p className="citation-detail-count"><strong>{selectedCitationCount === null || selectedCitationCount === undefined ? 'Not reported' : selectedCitationCount.toLocaleString()}</strong> citations
                {selectedCitationSource && <small>{labelSource(selectedCitationSource)}{explored?.paper.id === selected.id && explored.retrievedAt ? ` · retrieved ${new Date(explored.retrievedAt).toLocaleString()}` : selected.citationCountRetrievedAt ? ` · retrieved ${new Date(selected.citationCountRetrievedAt).toLocaleString()}` : ' · retrieval date not recorded'}</small>}
              </p>
              {selected.doi && <p className="citation-doi">DOI <a href={`https://doi.org/${encodeURIComponent(selected.doi)}`} target="_blank" rel="noreferrer">{selected.doi}<ExternalLink size={12}/></a></p>}
              {selected.abstract && <p className="citation-abstract">{selected.abstract}</p>}
              <div className="citation-detail-actions">
                {selectedLink && <a className="button secondary" href={selectedLink} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a>}
                {!selected.isExternal && <button className="button primary" onClick={exploreSelected} disabled={exploring}>{exploring ? 'Retrieving…' : 'Explore citations'} <ArrowUpRight size={14}/></button>}
              </div>
              {exploreError && <p className="citation-alert" role="alert">{exploreError}</p>}
              <div className="citation-direction-summary">
                <span><ArrowUpRight size={14}/> {selected.referenceCount === null ? 'References not reported' : `${selected.referenceCount} references reported`}</span>
                <span><ArrowDownLeft size={14}/> {selectedCitationCount === null || selectedCitationCount === undefined ? 'Citation count unavailable' : `${selectedCitationCount.toLocaleString()} citations reported`}</span>
              </div>
              {explored && explored.paper.id === selected.id && <>
                <p className="citation-retrieved-note">{explored.note}{explored.retrievedAt ? ` Retrieved ${new Date(explored.retrievedAt).toLocaleString()} from ${explored.provider || 'saved metadata'}.` : ''}</p>
                <div className="citation-detail-list"><h4>References ({explored.references.length})</h4>
                  {explored.references.length ? <ul>{explored.references.slice(0, 12).map((reference) => <li key={reference.id}>
                    {reference.inLibrary ? <button onClick={() => { setSelectedId(reference.id); setExplored(null); }}>{reference.title}</button> : <span>{reference.title}</span>}
                    {!reference.inLibrary && <small>Outside library · provider identifier</small>}
                  </li>)}</ul> : <p>{explored.provider ? 'No reference list returned by the provider.' : 'No supported provider record was found; references are unavailable.'}</p>}
                </div>
                <div className="citation-detail-list"><h4>Citing publications ({explored.citing.length})</h4>
                  {explored.citing.length ? <ul>{explored.citing.slice(0, 12).map((citing) => {
                    const local = paperById.get(citing.id);
                    return <li key={citing.id}>{local ? <button onClick={() => { setSelectedId(local.id); setExplored(null); }}>{citing.title}</button> : safeHref(citing.url) ? <a href={safeHref(citing.url)} target="_blank" rel="noreferrer">{citing.title} <ExternalLink size={11}/></a> : <span>{citing.title}</span>}<small>{[citing.year, citing.source || explored.provider].filter(Boolean).join(' · ')}</small></li>;
                  })}</ul> : <p>{explored.provider ? 'No citing works are exposed by this provider.' : 'Citing works are unavailable because no supported provider record was found.'}</p>}
                </div>
              </>}
              <div className="citation-detail-list"><h4>Backward citations · in this library ({selectedOutgoing.length})</h4>
                {selectedOutgoing.length ? <ul>{selectedOutgoing.slice(0, 8).map((id) => <li key={id}><button onClick={() => setSelectedId(id)}>{paperById.get(id)?.title || id}</button></li>)}</ul> : <p>No direct in-library reference links found.</p>}
              </div>
              <div className="citation-detail-list"><h4>Forward citations · in this library ({selectedIncoming.length})</h4>
                {selectedIncoming.length ? <ul>{selectedIncoming.slice(0, 8).map((id) => <li key={id}><button onClick={() => setSelectedId(id)}>{paperById.get(id)?.title || id}</button></li>)}</ul> : <p>No direct in-library citing links found.</p>}
              </div>
              {relatedByReferences.length > 0 && <div className="citation-detail-list"><h4>Bibliographic coupling · shared references</h4><ul>{relatedByReferences.map(({ paper, shared }) => <li key={paper.id}><button onClick={() => setSelectedId(paper.id)}>{paper.title}</button><small>{shared} shared references · inferred similarity, not a citation</small></li>)}</ul></div>}
              {coCited.length > 0 && <div className="citation-detail-list"><h4>Co-cited in the library</h4><ul>{coCited.map(({ paper, count }) => <li key={paper.id}><button onClick={() => setSelectedId(paper.id)}>{paper.title}</button><small>Co-cited by {count} saved publication(s); similarity, not a direct citation</small></li>)}</ul></div>}
              <div className="citation-path-control"><label>Find directed path to<select value={pathTarget} onChange={(event) => { setPathTarget(event.target.value); setPath([]); }}><option value="">Choose a target paper</option>{papers.filter((paper) => paper.id !== selected.id).map((paper) => <option key={paper.id} value={paper.id}>{paper.title}</option>)}</select></label>
                <button className="button secondary" disabled={!pathTarget} onClick={() => setPath(findCitationPath(selected.id, pathTarget, data.edges))}>Explore path</button>
                {path.length ? <p>{pathPapers.map((paper) => paper.title).join(' → ')}</p> : pathTarget && <p className="citation-muted">No directed path found in the verified library network.</p>}
              </div>
            </>}
          </aside>
        </section>
        <footer className="citation-integrity">Direct citation edges come only from provider reference lists. Shared-reference/co-citation results are similarity signals, not citations. A missing count means unavailable, not zero.</footer>
      </>}
    </section>
  );
}
