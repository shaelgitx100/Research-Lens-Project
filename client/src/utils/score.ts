import { Dimension } from '../types';

export const DEFAULT_WEIGHTS: Record<string, number> = { evidenceStrength: 1, novelty: 1, relevance: 1, feasibility: 1, dataAvailability: 1, scope: 1 };
export const FORMULA = 'Composite = 100 x (sum of weight_i x score_i) / (sum of weight_i). Each score_i lies between 0 and 1 and comes from a documented heuristic over the analyzed papers. Default weights are equal. Changing weights recomputes the composite with the same formula. The composite is a prioritization aid only and does not prove novelty or importance.';

export function composite(dims: Dimension[] = [], w: Record<string, number> = DEFAULT_WEIGHTS): number {
  let n = 0, d = 0;
  for (const x of dims) { const wt = w[x.key] ?? 1; n += wt * x.score; d += wt; }
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}
export const loadWeights = (): Record<string, number> => { try { return { ...DEFAULT_WEIGHTS, ...JSON.parse(localStorage.getItem('rlWeights') || '{}') }; } catch { return DEFAULT_WEIGHTS; } };
