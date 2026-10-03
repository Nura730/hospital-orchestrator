/**
 * @file useLiveData.js
 * Subscribes to real-time socket events and pipes granular updates into liveStore.
 * Manages socket lifecycle and exposes connection health state.
 */

import { useEffect } from 'react';
import { socketClient } from '../api/socket.js';
import { useLiveStore } from '../store/liveStore.js';
import { useAuthStore } from '../store/authStore.js';
import { SOCKET_EVENTS } from '../utils/constants.js';

export function useLiveData() {
  const token = useAuthStore((s) => s.token);
  const isInitialized = useLiveStore((s) => s.isInitialized);
  const isLoading = useLiveStore((s) => s.isLoading);
  const isConnected = useLiveStore((s) => s.isConnected);
  const lastEventTimestamp = useLiveStore((s) => s.lastEventTimestamp);
  const fetchInitialData = useLiveStore((s) => s.fetchInitialData);
  const setConnectionStatus = useLiveStore((s) => s.setConnectionStatus);
  const applyEvent = useLiveStore((s) => s.applyEvent);

  // Initialize dataset on mount
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      fetchInitialData();
    }
  }, [isInitialized, isLoading, fetchInitialData]);

  // Connect socket and register listeners
  useEffect(() => {
    const unsubStatus = socketClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    socketClient.connect(token);

    // Register all event listeners
    const unsubs = Object.values(SOCKET_EVENTS).map((event) =>
      socketClient.on(event, (payload) => {
        applyEvent(event, payload);
      })
    );

    return () => {
      unsubStatus();
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [token, setConnectionStatus, applyEvent]);

  return {
    isConnected,
    isInitialized,
    isLoading,
    lastEventTimestamp,
  };
}

export default useLiveData;
