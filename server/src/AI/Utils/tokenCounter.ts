const DEFAULT_CHARS_PER_TOKEN = 4;

/** Conservative, dependency-free token estimate for budgeting model input. */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / DEFAULT_CHARS_PER_TOKEN);
}

/** Truncate input to a target estimate while preserving a clear truncation marker. */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  if (!Number.isFinite(maxTokens) || maxTokens < 1) throw new RangeError('maxTokens must be a positive finite number.');
  if (estimateTokenCount(text) <= maxTokens) return text;
  const marker = '\n[Input truncated to fit the configured model context budget.]';
  const characterBudget = Math.max(0, maxTokens * DEFAULT_CHARS_PER_TOKEN - marker.length);
  return `${text.slice(0, characterBudget)}${marker}`;
}
