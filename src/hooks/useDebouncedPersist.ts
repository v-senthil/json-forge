/* ===================================================================
 * Debounced persistence hook.
 * Saves value to localStorage after a delay.
 * =================================================================== */

import { useEffect, useRef } from 'react';

export function useDebouncedPersist(key: string, value: string, delay = 1000) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage full - silently fail
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, value, delay]);
}
