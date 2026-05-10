import { useState, useEffect } from 'react';
import { useHistoryStore } from '@/store/history-store';

export function useRouteHistory() {
  const [isHydrated, setIsHydrated] = useState(false);

  const history = useHistoryStore((state) => state.history);
  const addToHistory = useHistoryStore((state) => state.addToHistory);
  const removeFromHistory = useHistoryStore((state) => state.removeFromHistory);
  const toggleFavorite = useHistoryStore((state) => state.toggleFavorite);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const getHistory = useHistoryStore((state) => state.getHistory);
  const getFavorites = useHistoryStore((state) => state.getFavorites);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Return empty state until hydrated to prevent SSR mismatch
  if (!isHydrated) {
    return {
      history: [],
      addToHistory,
      removeFromHistory,
      toggleFavorite,
      clearHistory,
      getHistory: () => [],
      getFavorites: () => [],
      isHydrated: false,
    };
  }

  return {
    history,
    addToHistory,
    removeFromHistory,
    toggleFavorite,
    clearHistory,
    getHistory,
    getFavorites,
    isHydrated: true,
  };
}
