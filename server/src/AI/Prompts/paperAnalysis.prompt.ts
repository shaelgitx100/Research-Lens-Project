import type { PaperAnalysisInput } from '../Types/paper.types.js';
import { truncateToTokenBudget } from '../Utils/tokenCounter.js';

export function buildPaperAnalysisPrompt(paper: PaperAnalysisInput): string {
  return [
    'Analyze the following saved academic paper and return the requested structured fields.',
    'For fields absent from the source, use "Not reported in the supplied text."',
    'Every evidence quote must be copied exactly from the supplied source text.',
    'Do not use external knowledge to fill gaps.',
    '',
    `Paper metadata: ${JSON.stringify({ title: paper.title, authors: paper.authors, publicationYear: paper.publicationYear, venue: paper.venue, abstract: paper.abstract })}`,
    'Source text begins:',
    truncateToTokenBudget(paper.sourceText, 22_000),
    'Source text ends.',
  ].join('\n');
}
