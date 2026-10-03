/**
 * @file useFlowPolling.js
 * Fetch + poll + socket-triggered refresh for Flow Intelligence screens.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { socketClient } from '../api/socket.js';
import { liveEmitter } from '../api/mock/liveEmitter.js';
import { HOSPITAL_CHANGED } from '../api/mock/hospitalSync.js';

export function errorText(err, fallback = 'Request failed') {
  const m = err && err.message;
  if (!m || m === '[object Object]') return fallback;
  return m;
}

/**
 * @param {() => Promise<any>} fetcher
 * @param {{ intervalMs?: number, refreshOn?: string[], deps?: any[], toastOnError?: boolean }} options
 */
export function useFlowPolling(fetcher, { intervalMs = 0, refreshOn = [], deps = [], toastOnError = true, live = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  const toastRef = useRef(toastOnError);
  const lastToast = useRef(0);
  fetcherRef.current = fetcher;
  toastRef.current = toastOnError;

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
      return result;
    } catch (err) {
      if (mounted.current) {
        setError(errorText(err));
        // Avoid toast storms while polling
        if (toastRef.current && Date.now() - lastToast.current > 15000) {
          lastToast.current = Date.now();
          toast.error(errorText(err, 'Could not load flow data'));
        }
      }
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    let timer = null;
    if (intervalMs > 0) timer = setInterval(() => refresh({ silent: true }), intervalMs);
    return () => {
      mounted.current = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refreshKey = refreshOn.join('|');
  useEffect(() => {
    if (!refreshOn.length) return undefined;
    let pending = null;
    const handler = () => {
      // Coalesce bursts of events into one refresh
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        refresh({ silent: true });
      }, 400);
    };
    const unsubs = refreshOn.map((ev) => socketClient.on(ev, handler));
    return () => {
      if (pending) clearTimeout(pending);
      unsubs.forEach((u) => u && u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Live: any change to the shared hospital (this tab or another) refreshes the data
  useEffect(() => {
    if (!live) return undefined;
    let pending = null;
    const off = liveEmitter.on(HOSPITAL_CHANGED, () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        refresh({ silent: true });
      }, 250);
    });
    return () => {
      if (pending) clearTimeout(pending);
      off();
    };
  }, [live, refresh]);

  return { data, loading, error, refresh, setData };
}

export default useFlowPolling;
