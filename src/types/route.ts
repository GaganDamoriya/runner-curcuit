import { LineString } from 'geojson';

export interface RouteData {
  geojson: LineString;
  distanceKm: number;
  durationMin: number;
  surfaceScore: number;
  coordinates: [number, number][];
}

export interface RoutePreferences {
  distanceKm: number;
  routeType: 'loop' | 'point-to-point';
  startCoord: [number, number];
  cityPreference: 'stay-in-city' | 'can-leave-city';
}

export type SurfaceType =
  | 'paved'
  | 'asphalt'
  | 'concrete'
  | 'compacted'
  | 'gravel'
  | 'unpaved'
  | 'dirt'
  | 'path'
  | 'grass'
  | 'sand';
