import { RouteData } from './route';
import { RouteMetrics, OSMFeature } from './route-optimizer';
import { WeatherAdviceResponse } from './weather';

/**
 * Intelligent Route API Types (LangGraph-powered)
 */

export interface IntelligentRouteRequest {
  distanceKm: number;
  startCoord: [number, number];
  routeType: 'loop' | 'point-to-point';
  cityPreference: 'stay-in-city' | 'can-leave-city';
  timeOfDay?: number; // 0-23 hour
  userQuery?: string; // Natural language query
}

export interface SafetyAssessment {
  overallScore: number; // 0-100
  heatRisk: number; // 0-100
  aqiRisk: number; // 0-100
  uvRisk: number; // 0-100
  windRisk: number; // 0-100
  surfaceQuality: number; // 0-100
  bestStartTime?: string;
  warnings: string[];
  recommendations: string[];
}

export interface AgentMessage {
  agent: 'user' | 'route' | 'safety' | 'scorer' | 'orchestrator';
  content: string;
  timestamp: string;
}

export interface IntelligentRouteResponse {
  success: true;
  data: {
    route: RouteData;
    metrics?: RouteMetrics;
    safety: SafetyAssessment;
    weather?: WeatherAdviceResponse;
    waterPoints?: OSMFeature[];
  };
  explanation: string; // Natural language explanation
  advice: string[]; // User-friendly tips
  conversation: AgentMessage[]; // Full agent conversation
}

export interface IntelligentRouteError {
  success: false;
  error: string;
  code?:
    | 'RATE_LIMIT'
    | 'NO_ROUTE_FOUND'
    | 'INVALID_REQUEST'
    | 'SERVER_ERROR'
    | 'API_KEY_MISSING';
  details?: string;
}
