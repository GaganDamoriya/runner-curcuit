import { create } from 'zustand';
import { RouteData } from '@/types/route';

interface RouteStore {
  route: RouteData | null;
  startCoord: [number, number];
  setRoute: (route: RouteData) => void;
  setStartCoord: (coord: [number, number]) => void;
  clearRoute: () => void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  route: null,
  startCoord: [77.209, 28.6139], // Default to Delhi
  setRoute: (route) => set({ route }),
  setStartCoord: (coord) => set({ startCoord: coord }),
  clearRoute: () => set({ route: null }),
}));
