import { useCallback, useEffect, useRef, useState } from 'react';

export function useFetch(fetcher, depsOrOpts, maybeOpts) {
  const deps = Array.isArray(depsOrOpts) ? depsOrOpts : undefined;
  const opts = Array.isArray(depsOrOpts) ? maybeOpts : depsOrOpts;
  const { initialLoading = true } = opts ?? {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const callIdRef = useRef(0);
  const abortRef = useRef(null);

  const run = useCallback(async (...args) => {
    const id = ++callIdRef.current;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current(...args, {
        signal: controller.signal,
      });
      if (id === callIdRef.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (id === callIdRef.current && err.name !== 'AbortError') {
        setError(err.message);
        setLoading(false);
      }
      return undefined;
    }
  }, []);

  const initialLoadingRef = useRef(initialLoading);
  initialLoadingRef.current = initialLoading;

  const latestDepsRef = useRef(deps);
  latestDepsRef.current = deps;
  const committedRef = useRef({ deps, version: 0 });
  const depsVersion = sameDeps(committedRef.current.deps, deps)
    ? committedRef.current.version
    : committedRef.current.version + 1;

  useEffect(() => {
    committedRef.current = { deps: latestDepsRef.current, version: depsVersion };
    if (initialLoadingRef.current) run();
    return () => abortRef.current?.abort();
  }, [depsVersion, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { data: data ?? undefined, loading, error, run, setData };
}

function sameDeps(a = [], b = []) {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}
