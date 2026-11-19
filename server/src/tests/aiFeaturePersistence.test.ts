import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateLiteratureReview } = vi.hoisted(() => ({
  generateLiteratureReview: vi.fn(),
}));

vi.mock('../AI/Services/literatureReview.service.js', () => ({ generateLiteratureReview }));

import { AiFeatureResult } from '../model/index.js';
import { runAiFeature } from '../AI/Services/aiFeatureOrchestrator.service.js';

describe('AI feature result persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a review suggestion without persisting it before researcher approval', async () => {
    const result = { title: 'Candidate synthesis', summary: 'A proposed synthesis.' };
    generateLiteratureReview.mockResolvedValue({ result, model: 'test-model' });
    const create = vi.spyOn(AiFeatureResult, 'create');

    await expect(runAiFeature(
      'literature-review',
      { topic: 'Research methods', question: 'Compare the supplied evidence.' },
      'owner-id',
      'workspace-id',
      { persistResult: false },
    )).resolves.toEqual({ result, aiModel: 'test-model', persisted: false });

    expect(create).not.toHaveBeenCalled();
  });

  it('continues saving AI results by default for existing features', async () => {
    const result = { title: 'Saved review', summary: 'A generated review.' };
    generateLiteratureReview.mockResolvedValue({ result, model: 'test-model' });
    const savedResult = { _id: 'saved-result', result };
    const create = vi.spyOn(AiFeatureResult, 'create').mockResolvedValue(savedResult as never);

    await expect(runAiFeature(
      'literature-review',
      { topic: 'Research methods' },
      'owner-id',
      'workspace-id',
    )).resolves.toBe(savedResult);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'literature-review',
      result,
      aiModel: 'test-model',
    }));
  });
});
