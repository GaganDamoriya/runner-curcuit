import { RouteData } from './route';
import { RouteMetrics, OSMFeature } from './route-optimizer';
import { WeatherAdviceResponse } from './weather';

export interface GenerateRouteRequest {
  distanceKm: number;
  routeType: 'loop' | 'point-to-point';
  startCoord: [number, number];
  cityPreference: 'stay-in-city' | 'can-leave-city';
  timeOfDay?: number; // NEW: 0-23 hour for lighting importance
}

export interface GenerateRouteResponse {
  success: true;
  data: RouteData;
  metrics?: RouteMetrics;
  strategyUsed?: string;
  waterPoints?: OSMFeature[]; // NEW (Phase 4): For 15km+ routes
}

export interface GenerateRouteError {
  success: false;
  error: string;
  code?: 'RATE_LIMIT' | 'NO_ROUTE_FOUND' | 'INVALID_REQUEST' | 'SERVER_ERROR' | 'NO_ACCURATE_ROUTE';
}

// Weather API types
export interface WeatherAdviceRequest {
  lat: number;
  lng: number;
  timeRangeHours?: number; // Default: 48
}

export interface WeatherAdviceSuccessResponse {
  success: true;
  data: WeatherAdviceResponse;
}

export interface WeatherAdviceError {
  success: false;
  error: string;
  code?: 'RATE_LIMIT' | 'INVALID_REQUEST' | 'SERVER_ERROR' | 'API_KEY_MISSING';
}
