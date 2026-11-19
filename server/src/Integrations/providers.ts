import { searchCrossref } from './crossref';
import { searchOpenAlex } from './openAlex';
import { searchSemanticScholar } from './semanticScholar';
import { SearchParams, SearchResult } from './types';
import { searchArxiv } from './arxiv';
import { searchCore } from './core';
import { searchPubMed } from './pubmed';
import { searchDoaj } from './doaj';
import { AppError } from '../Utils/AppError';

export type Provider = 'openalex' | 'crossref' | 'semanticscholar' | 'arxiv' | 'core' | 'pubmed' | 'doaj';

export async function searchProvider(provider: Provider, params: SearchParams): Promise<SearchResult> {
  if (provider === 'crossref') return searchCrossref(params);
  if (provider === 'semanticscholar') {
    try {
      return await searchSemanticScholar(params);
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 429) throw error;
      const fallback = await searchOpenAlex(params);
      return {
        ...fallback,
        provider: 'openalex',
        notes: ['Semantic Scholar rate limited this search; results below are from OpenAlex instead.', ...fallback.notes],
      };
    }
  }
  if (provider === 'arxiv') return searchArxiv(params);
  if (provider === 'core') return searchCore(params);
  if (provider === 'pubmed') return searchPubMed(params);
  if (provider === 'doaj') return searchDoaj(params);
  return searchOpenAlex(params);
}
