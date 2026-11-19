export type SynthesisTheme = {
  id: string;
  title: string;
  description: string;
  paperIds: string[];
};

export type SynthesisEvidence = {
  claim: string;
  quote: string;
  sourceLocation: string;
  paperId: string;
  paperTitle: string;
  authors: string[];
  year?: number;
  doi?: string;
  sourceDocument?: string;
};

export type SynthesisAnalysis = {
  id: string;
  kind: string;
  feature: string;
  themeId: string | null;
  title: string;
  summary: string;
  sections: { heading: string; content: string }[];
  recommendations: string[];
  evidence: SynthesisEvidence[];
  limitations: string[];
  confidence: 'low' | 'medium' | 'high';
  sourcePaperIds: string[];
  createdAt: string;
};

export type LiteratureSynthesisHandoff = {
  id: string;
  projectId: string;
  projectTitle: string;
  themes: SynthesisTheme[];
  analyses: SynthesisAnalysis[];
  notes: string;
  sources: {
    id: string;
    title: string;
    authors: string[];
    year?: number;
    doi?: string;
    publicationUrl?: string;
    sourceDocument?: string;
  }[];
};
