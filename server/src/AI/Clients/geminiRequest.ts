import { env } from '../../Config/env.js';
import { retryWithBackoff } from '../Utils/retryHandler.js';

type ModelHealth = {
  requests: number;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  cooldownUntil?: number;
};

export type GeminiModelHealth = Omit<ModelHealth, 'cooldownUntil'> & {
  model: string;
  available: boolean;
  failureRate: number;
};

const health = new Map<string, ModelHealth>();
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

export function geminiErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { status?: unknown; response?: { status?: unknown } };
  const status = Number(value.status ?? value.response?.status);
  return Number.isFinite(status) && status > 0 ? status : undefined;
}

function stateFor(model: string): ModelHealth {
  let state = health.get(model);
  if (!state) {
    state = { requests: 0, successes: 0, failures: 0, consecutiveFailures: 0 };
    health.set(model, state);
  }
  return state;
}

function modelOrder(priority = env.geminiModels): string[] {
  const configured = [...new Set(priority)];
  const now = Date.now();
  const available = configured.filter((model) => (health.get(model)?.cooldownUntil ?? 0) <= now);
  // Always retain a route if every model has a cooldown, using configured priority order.
  return [...available, ...configured.filter((model) => !available.includes(model))];
}

/** Retry transient provider errors with exponential backoff, then fail over by configured priority. */
export async function generateWithGeminiFallback<T>(
  request: (model: string) => Promise<T>,
  options: { retryAttempts?: number; baseDelayMs?: number; cooldownMs?: number; modelPriority?: string[] } = {},
): Promise<{ result: T; model: string }> {
  const attempts = options.retryAttempts ?? env.geminiRetryAttempts;
  const baseDelayMs = options.baseDelayMs ?? env.geminiRetryBaseDelayMs;
  const cooldownMs = options.cooldownMs ?? env.geminiModelCooldownMs;
  const models = modelOrder(options.modelPriority);
  if (!models.length) throw new Error('No Gemini models are configured. Set GEMINI_MODELS or GEMINI_MODEL.');

  let lastError: unknown;
  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const state = stateFor(model);
    if (model !== models[0]) console.warn('Gemini model fallback selected.', { from: models[0], to: model });

    let modelAttempt = 0;
    try {
      const result = await retryWithBackoff(() => {
        modelAttempt += 1;
        state.requests += 1;
        console.info('Gemini model selected.', { model, attempt: modelAttempt, priority: modelIndex + 1 });
        return request(model);
      }, {
        attempts,
        baseDelayMs,
        shouldRetry: (error) => retryableStatuses.has(geminiErrorStatus(error) ?? 0),
        onFailure: (error) => {
          state.failures += 1;
          state.consecutiveFailures += 1;
          state.lastFailureAt = new Date().toISOString();
          console.error('Gemini model request failed.', { model, status: geminiErrorStatus(error) ?? 'unknown' });
        },
        onRetry: (error, nextAttempt, delayMs) => console.warn('Retrying Gemini model request.', {
          model, nextAttempt, status: geminiErrorStatus(error) ?? 'unknown', delayMs,
        }),
      });
      state.successes += 1;
      state.consecutiveFailures = 0;
      state.cooldownUntil = undefined;
      state.lastSuccessAt = new Date().toISOString();
      return { result, model };
    } catch (error) {
      lastError = error;
      const status = geminiErrorStatus(error);
      if (!retryableStatuses.has(status ?? 0)) throw error;
      state.cooldownUntil = Date.now() + cooldownMs;
      console.warn('Gemini model temporarily marked unavailable; switching models.', {
        model, status, cooldownMs, failureRate: Number((state.failures / state.requests).toFixed(3)),
      });
    }
  }
  throw lastError;
}

/** In-process monitoring snapshot; availability recovers automatically when cooldowns expire. */
export function getGeminiModelHealth(): GeminiModelHealth[] {
  const now = Date.now();
  const configured = [...new Set([...env.geminiModels, ...health.keys()])];
  return configured.map((model) => {
    const state = stateFor(model);
    return {
      model,
      requests: state.requests,
      successes: state.successes,
      failures: state.failures,
      consecutiveFailures: state.consecutiveFailures,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: state.lastSuccessAt,
      available: (state.cooldownUntil ?? 0) <= now,
      failureRate: state.requests ? Number((state.failures / state.requests).toFixed(3)) : 0,
    };
  });
}
