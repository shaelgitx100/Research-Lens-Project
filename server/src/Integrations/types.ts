export interface PaperRecord {
  title: string; authors: string[]; abstract: string; publicationYear?: number; venue: string;
  paperType: 'journal' | 'conference' | 'preprint' | 'book' | 'other';
  DOI?: string; source: 'openalex' | 'crossref' | 'semanticscholar' | 'arxiv' | 'core' | 'pubmed' | 'doaj'; externalId: string;
  keywords: string[]; publicationUrl: string; openAccess: boolean; citationCount: number | null;
  referencedWorks: string[]; institutions?: string[]; domain?: string; isPreprint?: boolean; referenceCount?: number | null;
}
export interface SearchParams {
  q: string; author?: string; keywords?: string; domain?: string; venue?: string; yearFrom?: number; yearTo?: number; openAccess?: boolean;
  paperType?: string; page: number; perPage: number;
}
export interface SearchResult { results: PaperRecord[]; total: number; notes: string[]; page?: number; provider?: string }
