import { useEffect, useRef, useCallback } from 'react';
import useNotificationStore from '../store/notificationStore';

const POLL_INTERVAL = 30 * 1000; // 30 seconds

export function useNotificationPolling(isAuthenticated) {
  const refresh = useNotificationStore((s) => s.refresh);
  const intervalRef = useRef(null);
  const isVisibleRef = useRef(!document.hidden);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        refresh();
      }
    }, POLL_INTERVAL);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasHidden = !isVisibleRef.current;
      isVisibleRef.current = !document.hidden;

      if (document.hidden) {
        // Tab became hidden - stop polling
        stopPolling();
      } else if (wasHidden && isAuthenticated) {
        // Tab became visible - refresh immediately and restart polling
        refresh();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, refresh, startPolling, stopPolling]);

  // Start/stop polling based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      // Initial fetch
      refresh();
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isAuthenticated, refresh, startPolling, stopPolling]);

  return { refresh };
}

export default useNotificationPolling;
