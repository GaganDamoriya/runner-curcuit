import { create } from 'zustand';
import { RouteData } from '@/types/route';

interface RouteStore {
  route: RouteData | null;
  setRoute: (route: RouteData) => void;
  clearRoute: () => void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  route: null,
  setRoute: (route) => set({ route }),
  clearRoute: () => set({ route: null }),
}));
