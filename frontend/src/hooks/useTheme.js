/**
 * @file useTheme.js
 * Hook for toggling and querying light/dark mode with HTML element class synchronization.
 */

import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore.js';

export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  // Synchronize on mount
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}

export default useTheme;
