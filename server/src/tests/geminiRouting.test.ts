import { describe, expect, it, vi } from 'vitest';
import { generateWithGeminiFallback, getGeminiModelHealth } from '../AI/Clients/geminiRequest.js';

const transientFailure = (status: number) => Object.assign(new Error('temporary provider error'), { status });

describe('Gemini model fallback', () => {
  it('backs off and retries a model before switching, then returns the fallback response', async () => {
    const models = ['routing-primary-test', 'routing-fallback-test'];
    const calls: string[] = [];
    const wait = vi.spyOn(globalThis, 'setTimeout');
    const routed = await generateWithGeminiFallback(async (model) => {
      calls.push(model);
      if (model === models[0]) throw transientFailure(503);
      return 'successful response';
    }, { modelPriority: models, retryAttempts: 3, baseDelayMs: 1, cooldownMs: 60_000 });

    expect(calls).toEqual([models[0], models[0], models[0], models[1]]);
    expect(routed).toEqual({ result: 'successful response', model: models[1] });
    expect(wait).toHaveBeenCalledTimes(2);
    const [primary, fallback] = getGeminiModelHealth().filter((model) => models.includes(model.model));
    expect(primary).toMatchObject({ requests: 3, failures: 3, available: false, failureRate: 1 });
    expect(fallback).toMatchObject({ requests: 1, successes: 1, failures: 0, available: true });
    wait.mockRestore();
  });

  it('retries 429 then fails over, but never switches for invalid credentials or malformed requests', async () => {
    const models = ['routing-rate-test', 'routing-rate-fallback-test'];
    const rateCalls: string[] = [];
    const rateResult = await generateWithGeminiFallback(async (model) => {
      rateCalls.push(model);
      if (model === models[0]) throw transientFailure(429);
      return 'fallback';
    }, { modelPriority: models, retryAttempts: 2, baseDelayMs: 0 });
    expect(rateCalls).toEqual([models[0], models[0], models[1]]);
    expect(rateResult.model).toBe(models[1]);

    for (const status of [400, 401, 403]) {
      const request = vi.fn(async () => { throw transientFailure(status); });
      await expect(generateWithGeminiFallback(request, {
        modelPriority: [`routing-terminal-${status}`, `routing-never-${status}`], retryAttempts: 3, baseDelayMs: 0,
      })).rejects.toMatchObject({ status });
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
});
