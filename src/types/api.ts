import { RouteData } from './route';
import { RouteMetrics } from './route-optimizer';

export interface GenerateRouteRequest {
  distanceKm: number;
  routeType: 'loop' | 'point-to-point';
  startCoord: [number, number];
  cityPreference: 'stay-in-city' | 'can-leave-city';
}

export interface GenerateRouteResponse {
  success: true;
  data: RouteData;
  metrics?: RouteMetrics;
  strategyUsed?: string;
}

export interface GenerateRouteError {
  success: false;
  error: string;
  code?: 'RATE_LIMIT' | 'NO_ROUTE_FOUND' | 'INVALID_REQUEST' | 'SERVER_ERROR' | 'NO_ACCURATE_ROUTE';
}
