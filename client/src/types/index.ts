export interface AuthUser { id: string; name: string; email: string }
export interface AuthSession { token: string; user: AuthUser }
export interface Project {
  _id: string; id: string; title: string; topic: string; description?: string; objectives: string[];
  keywords: string[]; domain: string; status: string; createdAt: string; isDemo: boolean;
  stats: { papers: number; analyzed: number; progress: number };
}
export interface Paper {
  _id: string; id: string; title: string; authors: string[]; abstract?: string; publicationYear?: number;
  venue?: string; doi?: string; DOI?: string; source?: string; paperType?: string; keywords: string[]; publicationUrl?: string;
  openAccess?: boolean; citationCount?: number; referenceCount?: number; referencedWorks?: string[]; isPreprint?: boolean;
  projectId?: string; externalId?: string; notes: string; tags: string[]; collections: string[]; read: boolean; analyzed: boolean;
  inLibrary?: boolean; isDemo: boolean; hasFullText: boolean; fullTextLength: number; createdAt?: string;
}
export interface PaperRecord {
  title: string; authors: string[]; abstract: string; publicationYear?: number; venue: string; paperType: 'journal' | 'conference' | 'preprint' | 'book' | 'other';
  DOI?: string; source: string; externalId?: string; keywords: string[]; publicationUrl: string; openAccess: boolean; citationCount: number | null; referenceCount?: number | null;
  referencedWorks: string[]; institutions?: string[]; domain?: string; isPreprint?: boolean; inLibrary?: boolean;
}
export interface ApiError { error: string; details?: unknown }

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  institution?: string;
  bio?: string;
  preferences: {
    theme: string;
    notifications: Record<string, boolean>;
    research: { defaultProvider: string; defaultDomain: string; minPapersForGaps: number };
  };
}

export interface Pagination { page: number; pages: number; total: number; limit: number }
export interface Evidence { text: string; section?: string; page?: number; origin?: 'source' | 'userEdited' }
export const ANALYSIS_FIELDS = ['researchObjective', 'methodology', 'findings', 'limitations', 'futureWork'] as const;
export type AnalysisField = typeof ANALYSIS_FIELDS[number];
export interface Analysis extends Record<AnalysisField, Evidence[]> {
  textBasis?: 'fullText' | 'abstract';
}

export interface Dimension { key: string; label: string; score: number; explanation: string }
export interface GapEvidence { paperId: string; excerpt: string; kind: string; section?: string; page?: number }
export interface Gap {
  id: string; projectId: string; title: string; description: string; category: string;
  classification: string; domain?: string; reasoning: string; isDemo?: boolean; reviewerNote?: string;
  authorLimitations: string[]; futureRecommendations: string[]; relatedMethodologies: string[];
  suggestedDirections: string[]; supportingEvidence: GapEvidence[];
  evidenceStrength: { label: string; supportCount: number; totalAnalyzed: number; coverage: number };
  scorecard?: { dimensions: Dimension[] };
  composite?: number;
}

export interface Question {
  id: string; projectId: string; gapId?: string; relatedGapId?: string; gap?: { title: string };
  question: string; motivation: string; proposedMethodology: string; requiredDataset: string;
  evaluationMetrics: string[]; expectedContribution: string; feasibility: { level: string; explanation: string };
  supportingPaperIds: string[]; notes: string; origin: 'generated' | 'user'; status: string;
  createdAt?: string; isDemo?: boolean;
}
export interface GNode {
  id: string; type: string; label: string; description?: string; isManual?: boolean; relatedEntityId?: string;
}
export interface GEdge {
  id: string; source: string; target: string; relationshipType: string; description?: string; isManual?: boolean;
}
export interface Notice { id: string; title: string; message: string; link?: string; read: boolean; createdAt: string }
export interface Theme { id: string; name: string; description?: string; paperIds: string[] }
