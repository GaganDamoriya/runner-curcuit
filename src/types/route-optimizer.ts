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
  safetyMetrics?: SafetyMetrics; // NEW: Safety scoring metrics
  overallScore: number; // 0-100
  hilliness?: number; // NEW (Phase 3): 0-100, from OpenTopoData
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
  type:
    | 'park'
    | 'trail'
    | 'track'
    | 'waterfront'
    | 'water'
    | 'safe-road'
    | 'fountain'
    | 'lighting'
    | 'hospital'
    | 'police'
    | 'toilet'
    | 'construction'
    | 'school'
    | 'worship'
    | 'green-cover';
  name: string;
  location: [number, number];
  coordinates?: [number, number][]; // for trails/waterfronts/water bodies (undefined for nodes)
  perimeter?: number; // for parks
  length?: number; // for trails
  shouldAvoid?: boolean; // Flag for features to avoid (e.g., water bodies, construction)
  isLit?: boolean; // For roads/paths with street lighting
  greenCoverDensity?: number; // 0-100 for areas with tree canopy
}

export interface SafetyMetrics {
  waterAccessScore: number; // 0-100: proximity to drinking water
  lightingScore: number; // 0-100: % of route with street lighting
  emergencyAccessScore: number; // 0-100: proximity to hospitals/police
  greenCoverScore: number; // 0-100: % of route with tree canopy
  hazardPenalty: number; // 0-50: construction zones, traffic
  parkRatio: number; // 0-1: ratio of route through parks (Phase 4.4)
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
