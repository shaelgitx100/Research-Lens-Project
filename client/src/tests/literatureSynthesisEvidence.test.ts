import { describe, expect, it } from 'vitest';
import { verifyLiteratureEvidence } from '../utils/literatureSynthesisEvidence';

describe('literature synthesis evidence verification', () => {
  const sources = [{
    _id: 'paper-1',
    title: 'Source paper',
    abstract: 'This study reports a measurable improvement across the evaluated sample.',
  }];

  it('links an exact source passage to its saved publication', () => {
    const result = verifyLiteratureEvidence([{
      claim: 'The study reports an improvement.',
      quote: 'measurable improvement across the evaluated sample.',
      sourceLocation: '',
    }], sources);

    expect(result.unmatched).toHaveLength(0);
    expect(result.evidence[0]).toMatchObject({
      paperId: 'paper-1',
      paperTitle: 'Source paper',
      sourceLocation: 'Not explicitly stated in the source',
    });
  });

  it('does not attach a generated passage that is absent from the source', () => {
    const result = verifyLiteratureEvidence([{
      claim: 'An unsupported claim.',
      quote: 'The method conclusively eliminates all bias.',
      sourceLocation: 'Page 42',
    }], sources);

    expect(result.evidence).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it('matches case-insensitive text while not trusting unsupported page or section labels', () => {
    const result = verifyLiteratureEvidence([{
      claim: 'A source-supported claim.',
      quote: 'THIS STUDY reports a measurable\n improvement',
      sourceLocation: 'Abstract',
    }], sources);

    expect(result.evidence).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.evidence[0].sourceLocation).toBe('Not explicitly stated in the source');
  });
});
