export interface PaperAnalysisInput {
  title: string;
  authors: string[];
  abstract?: string;
  publicationYear?: number;
  venue?: string;
  sourceText: string;
}
