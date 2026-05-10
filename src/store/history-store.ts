import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RouteData } from '@/types/route';

interface RouteHistory {
  id: string;
  timestamp: number;
  route: RouteData;
  preferences: {
    distanceKm: number;
    routeType: 'loop' | 'point-to-point';
    startCoord: [number, number];
    cityPreference: 'stay-in-city' | 'can-leave-city';
  };
  isFavorite?: boolean;
}

interface HistoryStore {
  history: RouteHistory[];
  addToHistory: (route: RouteData, preferences: RouteHistory['preferences']) => void;
  removeFromHistory: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
  getHistory: () => RouteHistory[];
  getFavorites: () => RouteHistory[];
}

const MAX_HISTORY_ITEMS = 20;
const MAX_AGE_DAYS = 30;

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      history: [],

      addToHistory: (route, preferences) => {
        const now = Date.now();
        const cutoffTime = now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

        set((state) => {
          // Filter out old routes
          const recentHistory = state.history.filter(
            (item) => item.timestamp > cutoffTime
          );

          // Add new route
          const newHistory = [
            {
              id: crypto.randomUUID(),
              timestamp: now,
              route,
              preferences,
              isFavorite: false,
            },
            ...recentHistory,
          ];

          // Keep only the most recent MAX_HISTORY_ITEMS
          return {
            history: newHistory.slice(0, MAX_HISTORY_ITEMS),
          };
        });
      },

      removeFromHistory: (id) => {
        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        }));
      },

      toggleFavorite: (id) => {
        set((state) => ({
          history: state.history.map((item) =>
            item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
          ),
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },

      getHistory: () => {
        return get().history;
      },

      getFavorites: () => {
        return get().history.filter((item) => item.isFavorite);
      },
    }),
    {
      name: 'runner-circuit-history',
    }
  )
);
