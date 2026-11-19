import type { SynthesisEvidence } from '../components/literatureSynthesisTypes';

export type EvidenceSource = {
  _id?: string;
  title: string;
  authors?: string[];
  publicationYear?: number;
  doi?: string;
  fileName?: string;
  abstract?: string;
  extractedText?: string;
};

export type CandidateEvidence = {
  claim: string;
  quote: string;
  sourceLocation: string;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export function verifyLiteratureEvidence(
  evidence: CandidateEvidence[],
  papers: EvidenceSource[],
): { evidence: SynthesisEvidence[]; unmatched: CandidateEvidence[] } {
  const verified: SynthesisEvidence[] = [];
  const unmatched: CandidateEvidence[] = [];
  for (const item of evidence) {
    const quote = normalizeText(item.quote);
    const source = papers.find((paper) => {
      const sourceText = normalizeText(`${paper.extractedText || ''} ${paper.abstract || ''}`);
      return quote.length > 0 && sourceText.includes(quote);
    });
    if (!source?._id) {
      unmatched.push(item);
      continue;
    }
    verified.push({
      ...item,
      sourceLocation: 'Not explicitly stated in the source',
      paperId: String(source._id),
      paperTitle: source.title,
      authors: source.authors || [],
      year: source.publicationYear && source.publicationYear >= 1500 && source.publicationYear <= 2100
        ? source.publicationYear
        : undefined,
      doi: source.doi || undefined,
      sourceDocument: source.fileName || undefined,
    });
  }
  return { evidence: verified, unmatched };
}
