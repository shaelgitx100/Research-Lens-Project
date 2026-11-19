import { extractDatasetNames, matchFamilies, REAL_WORLD_CUES } from '../analysis/taxonomy';
import { GapEvidence, GapPaper } from './types';

export const SCORE_DIMENSIONS = [
  { key: 'evidenceStrength', label: 'Evidence strength' },
  { key: 'novelty', label: 'Research novelty potential' },
  { key: 'relevance', label: 'Practical relevance' },
  { key: 'feasibility', label: 'Methodological feasibility' },
  { key: 'dataAvailability', label: 'Dataset availability' },
  { key: 'scope', label: 'Research scope' },
] as const;

export const SCORECARD_FORMULA =
  'Composite = 100 x (sum of weight_i x score_i) / (sum of weight_i). Each score_i lies between 0 and 1 and is computed by a documented heuristic from the analyzed papers. Default weights are equal. Weights can be changed in the scorecard and the composite is recomputed with the same formula. The composite is a prioritization aid only. It does not prove novelty or importance.';

export interface Dimension { key: string; label: string; score: number; explanation: string }
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ScoreInput {
  category: string; supportingPaperIds: string[]; supportingEvidence: GapEvidence[]; matcher?: RegExp;
}

export function scoreDimensions(gap: ScoreInput, analyzed: GapPaper[]): Dimension[] {
  const N = Math.max(1, analyzed.length);
  const support = gap.supportingPaperIds.length;
  const supPapers = analyzed.filter((p) => gap.supportingPaperIds.includes(p.id));
  const cov = support / N;

  const evidence = clamp(0.6 * Math.min(1, support / 4) + 0.4 * Math.min(1, cov * 2));

  let addressing = 0;
  if (gap.matcher) {
    addressing = analyzed.filter((p) => {
      const t = [...(p.analysis?.findings || []), ...(p.analysis?.methodology || [])].map((e) => e.text).join(' ');
      return gap.matcher!.test(t);
    }).length;
  }
  const novelty = clamp(1 - addressing / N, 0.1, 0.95);

  const withCue = gap.supportingEvidence.filter((e) => REAL_WORLD_CUES.test(e.excerpt)).length;
  const frac = gap.supportingEvidence.length ? withCue / gap.supportingEvidence.length : 0;
  const relevance = clamp(0.3 + 0.7 * Math.min(1, frac * 2.5));

  const names = new Set<string>();
  let papersWithData = 0;
  let methodFamilies = 0;
  for (const p of supPapers) {
    const dsText = (p.analysis?.datasets || []).map((e) => e.text).join(' ');
    const found = extractDatasetNames(dsText);
    if (found.length) papersWithData++;
    found.forEach((f) => names.add(f));
    methodFamilies += matchFamilies((p.analysis?.methodology || []).map((e) => e.text).join(' ')).length ? 1 : 0;
  }
  const costly = gap.supportingEvidence.some((e) => /computational(ly)? (cost|expens)|does not scale|scalab/i.test(e.excerpt));
  const feasibility = clamp(0.45 + (names.size ? 0.25 : 0) + (methodFamilies ? 0.2 : 0) - (costly ? 0.2 : 0));

  const dataShare = support ? papersWithData / support : 0;
  const dataAvailability = clamp(0.2 + 0.8 * dataShare);

  const scope = clamp(0.75 - (gap.category === 'contradiction' ? 0.2 : 0) - (support >= 6 ? 0.1 : 0));

  return [
    { key: 'evidenceStrength', label: 'Evidence strength', score: r2(evidence), explanation: `${support} supporting papers, ${Math.round(cov * 100)}% of the ${N} analyzed papers.` },
    { key: 'novelty', label: 'Research novelty potential', score: r2(novelty), explanation: `${addressing} of ${N} analyzed papers address this directly in their methods or findings. This is relative to the collection only and does not prove novelty.` },
    { key: 'relevance', label: 'Practical relevance', score: r2(relevance), explanation: `${withCue} of ${gap.supportingEvidence.length} evidence excerpts mention applied or deployment contexts.` },
    { key: 'feasibility', label: 'Methodological feasibility', score: r2(feasibility), explanation: `${methodFamilies} supporting papers describe a recognizable method family${names.size ? ' and name datasets' : ''}${costly ? '; computational cost is reported as a barrier' : ''}.` },
    { key: 'dataAvailability', label: 'Dataset availability', score: r2(dataAvailability), explanation: names.size ? `Datasets named in supporting papers: ${[...names].slice(0, 4).join(', ')}.` : 'No datasets are named in the supporting papers.' },
    { key: 'scope', label: 'Research scope', score: r2(scope), explanation: 'Narrower, better bounded gaps score higher. Contradictions and very broad gaps score lower.' },
  ];
}

export function composite(dims: { key: string; score: number }[], weights: Record<string, number> = {}): number {
  let num = 0, den = 0;
  for (const d of dims) {
    const w = weights[d.key] ?? 1;
    num += w * d.score;
    den += w;
  }
  return den ? Math.round((num / den) * 1000) / 10 : 0;
}
