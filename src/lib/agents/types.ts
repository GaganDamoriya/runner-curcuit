import { RouteData } from '@/types/route';
import { RouteMetrics, OSMFeature } from '@/types/route-optimizer';
import { WeatherAdviceResponse } from '@/types/weather';

/**
 * LangGraph State: shared state across all agents
 */
export interface RouteAgentState {
  // Input from user
  userQuery: string;
  distanceKm: number;
  startCoord: [number, number];
  routeType: 'loop' | 'point-to-point';
  cityPreference: 'stay-in-city' | 'can-leave-city';
  timeOfDay?: number;

  // Agent outputs
  routes?: RouteCandidate[];
  weatherData?: WeatherAdviceResponse;
  safetyScore?: SafetyAssessment;
  finalRecommendation?: RouteRecommendation;

  // Conversation
  messages: AgentMessage[];
  nextStep?: string;
}

export interface RouteCandidate {
  route: RouteData;
  metrics?: RouteMetrics;
  strategyUsed?: string;
  waterPoints?: OSMFeature[];
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

export interface RouteRecommendation {
  selectedRoute: RouteData;
  metrics?: RouteMetrics;
  safety: SafetyAssessment;
  explanation: string; // Natural language explanation
  userFriendlyAdvice: string[];
  waterPoints?: OSMFeature[];
}

export interface AgentMessage {
  agent: 'user' | 'route' | 'safety' | 'scorer' | 'orchestrator';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
