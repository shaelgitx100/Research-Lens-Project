import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../Utils/AppError';
import type { SearchParams, SearchResult } from '../Integrations/types';
import { searchOpenAlex } from '../Integrations/openAlex';
import { searchSemanticScholar } from '../Integrations/semanticScholar';
import { searchProvider } from '../Integrations/providers';

vi.mock('../Integrations/openAlex', () => ({ searchOpenAlex: vi.fn() }));
vi.mock('../Integrations/semanticScholar', () => ({ searchSemanticScholar: vi.fn() }));

const params = { q: 'virus', page: 1, perPage: 20 } as SearchParams;
const openAlexResult = { results: [], total: 0, page: 1, notes: ['OpenAlex metadata note.'] } as SearchResult;

describe('Semantic Scholar rate-limit fallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses OpenAlex and identifies the actual source when Semantic Scholar returns 429', async () => {
    vi.mocked(searchSemanticScholar).mockRejectedValue(new AppError(429, 'rate limited'));
    vi.mocked(searchOpenAlex).mockResolvedValue(openAlexResult);

    const result = await searchProvider('semanticscholar', params);

    expect(searchOpenAlex).toHaveBeenCalledWith(params);
    expect(result.provider).toBe('openalex');
    expect(result.notes[0]).toContain('from OpenAlex instead');
  });

  it('does not mask non-rate-limit failures', async () => {
    const failure = new AppError(502, 'provider unavailable');
    vi.mocked(searchSemanticScholar).mockRejectedValue(failure);

    await expect(searchProvider('semanticscholar', params)).rejects.toBe(failure);
    expect(searchOpenAlex).not.toHaveBeenCalled();
  });
});
