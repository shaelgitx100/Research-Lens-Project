import type { Paper } from '../model/index.js';

type PaperRecord = Pick<InstanceType<typeof Paper>, 'title' | 'authors' | 'publicationYear' | 'venue' | 'doi' | 'publicationUrl'>;

export interface CitationGraphPaper {
  id: string;
  title: string;
  externalId?: string;
  doi?: string;
  referencedWorks?: string[];
}

export interface CitationGraphEdge {
  sourcePaperId: string;
  targetPaperId: string;
  sourceTitle: string;
  targetTitle: string;
}

/** Build citation links only when both papers are present in the supplied collection. */
export function buildCitationGraph(papers: CitationGraphPaper[]): { edges: CitationGraphEdge[] } {
  const byIdentifier = new Map<string, CitationGraphPaper>();
  for (const paper of papers) {
    for (const identifier of [paper.id, paper.externalId, paper.doi].filter((value): value is string => Boolean(value))) {
      byIdentifier.set(identifier.trim().toLowerCase(), paper);
    }
  }

  const edges: CitationGraphEdge[] = [];
  const seen = new Set<string>();
  for (const paper of papers) {
    for (const reference of paper.referencedWorks || []) {
      const target = byIdentifier.get(reference.trim().toLowerCase());
      if (!target || target.id === paper.id) continue;
      const key = `${paper.id}->${target.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ sourcePaperId: paper.id, targetPaperId: target.id, sourceTitle: paper.title, targetTitle: target.title });
    }
  }
  return { edges };
}

export function formatCitation(paper: PaperRecord, style: 'APA' | 'MLA' | 'Chicago' = 'APA'): string {
  const authors = paper.authors?.length ? paper.authors.join(', ') : 'Unknown author';
  const year = paper.publicationYear ?? 'n.d.'; const venue = paper.venue ?? '';
  const link = paper.doi ? `https://doi.org/${paper.doi.replace(/^https?:\/\/doi\.org\//, '')}` : paper.publicationUrl ?? '';
  if (style === 'MLA') return `${authors}. “${paper.title}.” ${venue}, ${year}. ${link}`.trim();
  if (style === 'Chicago') return `${authors}. “${paper.title}.” ${venue} (${year}). ${link}`.trim();
  return `${authors} (${year}). ${paper.title}. ${venue}. ${link}`.trim();
}
