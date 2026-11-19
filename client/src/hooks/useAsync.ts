import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(load: () => Promise<T>, dependencies: unknown[] = [], enabled = true) {
  const [data, setData] = useState<T>(); const [loading, setLoading] = useState(enabled); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await load()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); }
    finally { setLoading(false); }
  // Caller controls reload dependencies for this request hook.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => {
    if (enabled) void refresh();
    else setLoading(false);
  }, [enabled, refresh]);
  return { data, loading, error, refresh, reload: refresh, setData };
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
