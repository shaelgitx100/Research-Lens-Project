import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../Integrations/http';
import { getOpenAlexTrends } from '../Integrations/openAlex';

vi.mock('../Integrations/http', () => ({ getJson: vi.fn() }));

describe('OpenAlex live trends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns exact year-group totals and cited papers for the requested topic range', async () => {
    vi.mocked(getJson)
      .mockResolvedValueOnce({
        group_by: [
          { key: '2021', count: 15 },
          { key: '2020', count: 9 },
          { key: '2019', count: 100 },
        ],
      })
      .mockResolvedValueOnce({
        meta: { count: 24 },
        results: [{
          id: 'https://openalex.org/W1',
          title: 'Paper title',
          publication_year: 2021,
          cited_by_count: 42,
          authorships: [{ author: { display_name: 'Researcher One' } }],
          keywords: [{ display_name: 'Data mining' }],
        }],
      });

    const result = await getOpenAlexTrends('secure data mining', 2020, 2021);

    expect(vi.mocked(getJson)).toHaveBeenCalledTimes(2);
    const groupedUrl = new URL(vi.mocked(getJson).mock.calls[0][0]);
    const papersUrl = new URL(vi.mocked(getJson).mock.calls[1][0]);
    expect(groupedUrl.searchParams.get('filter')).toContain('title_and_abstract.search:secure data mining');
    expect(groupedUrl.searchParams.get('filter')).toContain('from_publication_date:2020-01-01');
    expect(groupedUrl.searchParams.get('filter')).toContain('to_publication_date:2021-12-31');
    expect(groupedUrl.searchParams.has('search')).toBe(false);
    expect(groupedUrl.searchParams.get('group_by')).toBe('publication_year');
    expect(papersUrl.searchParams.get('sort')).toBe('cited_by_count:desc');
    expect(result.yearlyCounts).toEqual([{ year: 2020, count: 9 }, { year: 2021, count: 15 }]);
    expect(result.total).toBe(24);
    expect(result).toMatchObject({ query: 'secure data mining', yearFrom: 2020, yearTo: 2021 });
    expect(result.papers[0]).toMatchObject({
      title: 'Paper title',
      source: 'openalex',
      citationCount: 42,
      publicationYear: 2021,
    });
  });
});
