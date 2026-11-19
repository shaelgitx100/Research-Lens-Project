import { AiFeatureResult, Paper } from '../../model/index.js';
import { AppError } from '../../Utils/AppError.js';
import { generateFeatureResult } from './featureGeneration.service.js';

const MAX_SOURCE_CHARS_PER_PAPER = 6500;

export async function compareSavedPapers(paperIds: string[], ownerId: string, workspaceId: string) {
  const papers = await Paper.find({ _id: { $in: paperIds }, ownerId, workspaceId })
    .select('title authors abstract publicationYear venue doi publicationUrl source fileName extractedText projectId')
    .lean().exec() as any[];

  const byId = new Map(papers.map((paper) => [String(paper._id), paper]));
  const ordered = paperIds.map((id) => byId.get(id)).filter(Boolean);
  if (ordered.length !== paperIds.length) throw new AppError(404, 'One or more selected publications were not found in your library.');

  const sources = ordered.map((paper, index) => {
    const extractedText = String(paper.extractedText || '').trim();
    const text = extractedText || String(paper.abstract || '').trim();
    return { paper, label: `Paper ${String.fromCharCode(65 + index)}`, text, sourceType: extractedText ? 'extracted PDF text' : 'provider or saved abstract' };
  });
  const insufficient = sources.filter(({ text }) => text.length < 80).map(({ paper }) => paper.title);
  if (insufficient.length) {
    throw new AppError(422, `Add an abstract or upload/analyze source text for each selected paper before comparing. Source text is missing or too short for: ${insufficient.join('; ')}`);
  }

  const context = [
    'Task: Produce an evidence-based comparison of the publications below.',
    'Use these section headings: Comparison matrix; Similarities; Differences and conflicting findings; Potential research gaps; Evidence and limitations.',
    'In the comparison matrix, compare research problem/objective, method/design, data or sample, findings, limitations, and future work. For each missing field, write "Not reported in the supplied text."',
    'Name papers as Paper A, Paper B, etc. in every comparison. Treat possible contradictions as apparent conflicts unless the source directly establishes a contradiction. Potential gaps are suggestions, never claims of novelty.',
    'Only use the text and metadata inside each labeled paper block. Evidence quotes must be exact source-text excerpts and identify the paper label. Do not treat metadata or the act of extraction as study evidence.',
    ...sources.map(({ paper, label, text, sourceType }) => {
      const metadata = {
        title: paper.title,
        authors: paper.authors || [],
        year: paper.publicationYear || null,
        venue: paper.venue || null,
        doi: paper.doi || null,
        source: paper.source || null,
        sourceType,
        sourceUrl: paper.publicationUrl || null,
      };
      return `${label}\nMetadata: ${JSON.stringify(metadata)}\nSupplied source text:\n${text.slice(0, MAX_SOURCE_CHARS_PER_PAPER)}`;
    }),
  ].join('\n\n');

  const generated = await generateFeatureResult('literature-comparison', context);
  const verifiedEvidence = generated.result.evidence.flatMap((evidence) => {
    const matches = sources.filter(({ text }) => text.includes(evidence.quote.trim()));
    return matches.length === 1
      ? [{ ...evidence, sourceLocation: `${matches[0].label} · exact source-text match` }]
      : [];
  });
  const removedEvidenceCount = generated.result.evidence.length - verifiedEvidence.length;
  const analysis = {
    ...generated.result,
    evidence: verifiedEvidence,
    limitations: removedEvidenceCount
      ? [...generated.result.limitations, `${removedEvidenceCount} quotation(s) were omitted because the source paper could not be uniquely verified.`].slice(0, 10)
      : generated.result.limitations,
  };
  const projectIds = new Set(sources.map(({ paper }) => paper.projectId ? String(paper.projectId) : ''));
  const projectId = projectIds.size === 1 ? [...projectIds][0] || undefined : undefined;
  const saved = await AiFeatureResult.create({
    feature: 'literature-comparison',
    paperIds: ordered.map((paper) => paper._id),
    ...(projectId ? { projectId } : {}),
    workspaceId,
    ownerId,
    result: analysis,
    aiModel: generated.model,
  });

  return {
    comparisonId: String(saved._id),
    model: generated.model,
    generatedAt: saved.createdAt,
    papers: sources.map(({ paper, label, text, sourceType }) => ({
      id: String(paper._id),
      label,
      title: paper.title,
      year: paper.publicationYear || null,
      sourceType: sourceType === 'extracted PDF text' ? sourceType : 'saved abstract',
      sourceCharacters: Math.min(text.length, MAX_SOURCE_CHARS_PER_PAPER),
    })),
    analysis,
  };
}
