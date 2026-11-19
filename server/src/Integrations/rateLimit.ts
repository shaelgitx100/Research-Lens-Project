const nextRequestAt = new Map<string, number>();
export async function paceProvider(name: string, minimumIntervalMs: number): Promise<void> {
  const now = Date.now(); const nextAt = nextRequestAt.get(name) || now; const wait = Math.max(0, nextAt - now);
  nextRequestAt.set(name, Math.max(now, nextAt) + minimumIntervalMs);
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}
