import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { analyzeNearbyPOIs } from '@/lib/osm-analyzer';
import { generateWaypointStrategies } from '@/lib/waypoint-generator';
import { refineRoute } from '@/lib/route-refiner';
import { simplifyRoute } from '@/lib/route-simplifier';
import { RouteCandidate } from '../types';

/**
 * LangChain tool for generating running routes via ORS
 */
export const routeGenerationTool = new DynamicStructuredTool({
  name: 'generate_route',
  description:
    'Generates optimized running routes using OpenRouteService. ' +
    'Considers distance, route type (loop/point-to-point), city preference, ' +
    'and avoids water bodies. Returns multiple route candidates with metrics.',
  schema: z.object({
    distanceKm: z
      .number()
      .min(1)
      .max(100)
      .describe('Target distance in kilometers'),
    startCoord: z
      .tuple([z.number(), z.number()])
      .describe('Start coordinate [longitude, latitude]'),
    routeType: z
      .enum(['loop', 'point-to-point'])
      .describe('Type of route to generate'),
    cityPreference: z
      .enum(['stay-in-city', 'can-leave-city'])
      .describe('Whether route can leave city bounds'),
    timeOfDay: z
      .number()
      .min(0)
      .max(23)
      .optional()
      .describe('Hour of day (0-23) for lighting considerations'),
  }),
  func: async ({
    distanceKm,
    startCoord,
    routeType,
    cityPreference,
    timeOfDay,
  }) => {
    try {
      console.log(
        `[Route Tool] Generating ${distanceKm}km ${routeType} from [${startCoord}]`
      );

      // Step 1: Analyze nearby POIs and hazards
      const osmFeatures = await analyzeNearbyPOIs(startCoord, 3);
      const waterFeatures = osmFeatures.filter((f) => f.type === 'water');
      const safeFeatures = osmFeatures.filter((f) => !f.shouldAvoid);

      console.log(
        `[Route Tool] Found ${safeFeatures.length} POIs, ${waterFeatures.length} water bodies`
      );

      // Step 2: Generate waypoint strategies
      const strategies = generateWaypointStrategies(
        startCoord,
        distanceKm,
        safeFeatures,
        { distanceKm, routeType, startCoord, cityPreference }
      );

      console.log(`[Route Tool] Generated ${strategies.length} strategies`);

      // Step 3: Refine routes
      const candidates: RouteCandidate[] = [];

      for (const strategy of strategies) {
        const refined = await refineRoute(
          strategy,
          distanceKm,
          6,
          osmFeatures,
          undefined,
          timeOfDay
        );
        if (refined) {
          // Simplify to reduce turns
          const simplifiedCoords = simplifyRoute(
            refined.route.coordinates,
            0.0005
          );
          refined.route.coordinates = simplifiedCoords;

          candidates.push({
            route: refined.route,
            metrics: refined.metrics,
            strategyUsed: refined.strategy.name,
            waterPoints:
              refined.route.distanceKm >= 15
                ? osmFeatures.filter((f) => f.type === 'fountain')
                : undefined,
          });
        }
      }

      if (candidates.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No suitable routes found',
        });
      }

      console.log(`[Route Tool] Generated ${candidates.length} route candidates`);

      return JSON.stringify({
        success: true,
        candidates,
        totalFound: candidates.length,
      });
    } catch (error) {
      console.error('[Route Tool] Error:', error);
      return JSON.stringify({
        success: false,
        error: String(error),
      });
    }
  },
});
