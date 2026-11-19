export interface Ev { text: string; section?: string; page?: number }
export interface AnalysisLite {
  methodology: Ev[]; datasets: Ev[]; findings: Ev[]; limitations: Ev[]; futureWork: Ev[];
}
export interface GapPaper { id: string; title: string; year?: number; keywords: string[]; analysis?: AnalysisLite }
export type GapCategory = 'limitation' | 'methodology' | 'dataset' | 'model' | 'contradiction' | 'futureWork';
export type EvidenceLabel = 'Evidence supported gap' | 'Potential research opportunity' | 'Emerging research direction' | 'Insufficient evidence';

export interface GapEvidence { paperId: string; excerpt: string; section?: string; page?: number; kind: 'limitation' | 'futureWork' | 'methodology' | 'finding' | 'dataset' }

export interface GapDraft {
  title: string; description: string; category: GapCategory;
  supportingPaperIds: string[]; supportingEvidence: GapEvidence[];
  reasoning: string;
  evidenceStrength: { label: EvidenceLabel; supportCount: number; totalAnalyzed: number; coverage: number };
  relatedMethodologies: string[]; authorLimitations: string[]; futureRecommendations: string[]; suggestedDirections: string[];
  meta: Record<string, string>; signature: string;
  /** Used only for scoring, never persisted. */
  matcher: RegExp;
}
