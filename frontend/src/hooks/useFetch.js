/**
 * @file useFetch.js
 * Generic async fetch hook with loading, error states, and manual refetch capability.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @param {Function} fetchFn - Async function returning { ok, data, error }
 * @param {Array} deps - Dependency array triggering automatic refetch
 * @param {object} options - { immediate: boolean, initialData: any }
 */
export function useFetch(fetchFn, deps = [], options = {}) {
  const { immediate = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn(...args);
      if (mountedRef.current) {
        if (res && typeof res === 'object' && 'ok' in res) {
          if (!res.ok) throw new Error(res.error || 'Fetch operation failed');
          setData(res.data);
          setLoading(false);
          return res.data;
        } else {
          setData(res);
          setLoading(false);
          return res;
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Request failed');
        setLoading(false);
      }
    }
  }, [fetchFn]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, deps);

  return {
    data,
    loading,
    error,
    refetch: execute,
    setData,
  };
}

export default useFetch;
