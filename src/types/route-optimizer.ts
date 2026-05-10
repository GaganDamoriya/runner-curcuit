import { RouteData } from './route';

export interface WaypointStrategy {
  name: string;
  description: string;
  waypoints: [number, number][];
  reasoning: string;
}

export interface RouteMetrics {
  distanceKm: number;
  targetDistanceKm: number;
  distanceAccuracy: number; // percentage
  turnCount: number;
  surfaceScore: number;
  elevationGain: number;
  scenicScore: number; // 0-100
  heatIndex?: number; // Celsius, calculated from weather data
  waterProximity?: number; // 0-40 penalty for water proximity
  overallScore: number; // 0-100
}

export interface RouteCandidate {
  strategy: WaypointStrategy;
  route: RouteData;
  metrics: RouteMetrics;
}

export interface StartPointSuggestion {
  name: string;
  location: [number, number];
  type: 'park' | 'trail' | 'track' | 'waterfront';
  distance: number; // km from user location
  reason: string;
}

export interface OSMFeature {
  id: string;
  type: 'park' | 'trail' | 'track' | 'waterfront' | 'water' | 'safe-road';
  name: string;
  location: [number, number];
  coordinates?: [number, number][]; // for trails/waterfronts/water bodies
  perimeter?: number; // for parks
  length?: number; // for trails
  shouldAvoid?: boolean; // Flag for features to avoid (e.g., water bodies)
}

export interface OSMOverpassResponse {
  elements: Array<{
    type: string;
    id: number;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
    center?: { lat: number; lon: number };
  }>;
}
