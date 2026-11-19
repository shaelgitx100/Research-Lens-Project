export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  onFailure?: (error: unknown, attempt: number) => void;
  onRetry?: (error: unknown, nextAttempt: number, delayMs: number) => void;
}

export function retryDelayMs(baseDelayMs: number, failedAttempt: number): number {
  return Math.max(0, baseDelayMs) * (2 ** Math.max(0, failedAttempt - 1));
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      options.onFailure?.(error, attempt);
      if (!options.shouldRetry(error) || attempt === attempts) throw error;
      const delayMs = retryDelayMs(options.baseDelayMs, attempt);
      options.onRetry?.(error, attempt + 1, delayMs);
      if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
