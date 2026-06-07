import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * useOverlayStack — Manages a stack of open overlay panels.
 * Integrates with browser history (pushState/popstate) so mobile back navigation closes overlays.
 *
 * Uses a counter ref (pendingPops) instead of a boolean flag so that clear() correctly
 * absorbs all N simultaneous history.back() calls without any leaking to the user-pop handler.
 */
export function useOverlayStack() {
  const [stack, setStack] = useState([]);
  // Counter: incremented before each programmatic history.back() call.
  // The popstate handler decrements it and returns early — only reaching the setStack
  // call when the counter is 0 (i.e. a real user back-press).
  const pendingPops = useRef(0);

  const push = useCallback((key) => {
    setStack((prev) => {
      if (prev.includes(key)) return prev;
      window.history.pushState({ overlay: key }, '', '');
      return [...prev, key];
    });
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
    pendingPops.current += 1;
    window.history.back();
  }, []);

  const clear = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const len = prev.length;
      pendingPops.current += len;   // absorb all N back events
      for (let i = 0; i < len; i++) {
        window.history.back();
      }
      return [];
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (pendingPops.current > 0) {
        pendingPops.current -= 1;
        return; // programmatic pop — already handled by pop()/clear()
      }
      // User-initiated back press — close the top overlay
      setStack((prev) => {
        if (prev.length === 0) return prev;
        return prev.slice(0, -1);
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const isOpen = useCallback((key) => stack.includes(key), [stack]);
  const top = stack[stack.length - 1] || null;

  return { stack, push, pop, clear, isOpen, top };
}
