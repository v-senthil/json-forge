/* ===================================================================
 * Keyboard shortcuts hook.
 * Registers global keyboard handlers for common operations.
 * =================================================================== */

import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Register keyboard shortcuts.
 * Key format: "mod+key" where mod = Cmd on Mac, Ctrl elsewhere.
 * Example: "mod+enter", "mod+f", "mod+shift+m"
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');

    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const parts: string[] = ['mod'];
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());

      const combo = parts.join('+');

      if (shortcuts[combo]) {
        e.preventDefault();
        e.stopPropagation();
        shortcuts[combo]();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
