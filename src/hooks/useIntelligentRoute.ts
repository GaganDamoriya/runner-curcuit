import { useMutation } from '@tanstack/react-query';
import {
  IntelligentRouteRequest,
  IntelligentRouteResponse,
  IntelligentRouteError,
} from '@/types/intelligent-route';

/**
 * React Query hook for intelligent route generation
 * Uses LangGraph multi-agent system for conversational recommendations
 */
export function useIntelligentRoute() {
  return useMutation<
    IntelligentRouteResponse,
    Error,
    IntelligentRouteRequest
  >({
    mutationFn: async (request: IntelligentRouteRequest) => {
      const response = await fetch('/api/route/intelligent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error: IntelligentRouteError = await response.json();
        throw new Error(error.error || 'Failed to generate intelligent route');
      }

      return response.json();
    },
    retry: 1,
    retryDelay: 1000,
  });
}

/**
 * Example usage:
 *
 * const { mutate, data, isPending, error } = useIntelligentRoute();
 *
 * // Generate route
 * mutate({
 *   distanceKm: 10,
 *   startCoord: [77.2090, 28.6139],
 *   routeType: 'loop',
 *   cityPreference: 'stay-in-city',
 *   timeOfDay: 6,
 *   userQuery: 'Safe morning run, need to avoid pollution'
 * });
 *
 * // Access results
 * if (data?.success) {
 *   console.log(data.explanation);  // Natural language explanation
 *   console.log(data.advice);       // Array of tips
 *   console.log(data.data.route);   // GeoJSON route
 *   console.log(data.data.safety);  // Safety scores
 * }
 */
