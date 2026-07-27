import { useCallback, useEffect, useRef, useState } from "react";

interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Poll an async fetcher on an interval. Refetches immediately when deps change
 * (clearing stale data), guards against overlapping requests and unmounted state.
 */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  intervalMs: number,
): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ data: null, error: null, loading: true });
  const busy = useRef(false);
  const alive = useRef(true);

  const tick = useCallback(async (reset: boolean) => {
    if (busy.current) return;
    busy.current = true;
    if (reset) setState({ data: null, error: null, loading: true });
    try {
      const data = await fetcher();
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (err) {
      if (alive.current)
        setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err), loading: false }));
    } finally {
      busy.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    void tick(true);
    const id = setInterval(() => void tick(false), intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [tick, intervalMs]);

  return state;
}
