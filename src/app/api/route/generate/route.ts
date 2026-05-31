import { NextRequest, NextResponse } from 'next/server';
import {
  GenerateRouteRequest,
  GenerateRouteResponse,
  GenerateRouteError,
} from '@/types/api';
import { RouteCandidate } from '@/types/route-optimizer';
import { analyzeNearbyPOIs } from '@/lib/osm-analyzer';
import { generateWaypointStrategies } from '@/lib/waypoint-generator';
import { refineRoute } from '@/lib/route-refiner';
import { simplifyRoute } from '@/lib/route-simplifier';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRouteRequest = await request.json();

    if (!body.distanceKm || body.distanceKm < 1 || body.distanceKm > 100) {
      return NextResponse.json<GenerateRouteError>(
        {
          success: false,
          error: 'Distance must be between 1-100km',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    console.log(`[Route Optimizer] Generating ${body.distanceKm}km ${body.routeType} from [${body.startCoord}]`);

    // Step 1: Analyze nearby POIs AND water bodies
    console.log('[Route Optimizer] Step 1: Analyzing nearby POIs and hazards...');
    const osmFeatures = await analyzeNearbyPOIs(body.startCoord, 3);

    // Separate hazards from safe features
    const waterFeatures = osmFeatures.filter((f) => f.type === 'water');
    const safeFeatures = osmFeatures.filter((f) => !f.shouldAvoid);

    console.log(`[Route Optimizer] Found ${safeFeatures.length} POIs, ${waterFeatures.length} water bodies, ${osmFeatures.length} total OSM features`);

    // Step 2: Generate smart waypoint strategies (using safe features only)
    console.log('[Route Optimizer] Step 2: Generating waypoint strategies...');
    const strategies = generateWaypointStrategies(
      body.startCoord,
      body.distanceKm,
      safeFeatures,
      body
    );
    console.log(`[Route Optimizer] Generated ${strategies.length} strategies: ${strategies.map(s => s.name).join(', ')}`);

    // Step 3: Refine each strategy iteratively (max 6 attempts per strategy)
    console.log('[Route Optimizer] Step 3: Refining routes (iterative distance adjustment)...');
    const candidates: RouteCandidate[] = [];

    for (const strategy of strategies) {
      console.log(`[Route Optimizer] Testing strategy: ${strategy.name}`);
      const refined = await refineRoute(strategy, body.distanceKm, 6, osmFeatures, undefined, body.timeOfDay);
      if (refined) {
        const waterInfo = refined.metrics.waterProximity ? `, water penalty: ${refined.metrics.waterProximity}` : '';
        console.log(`[Route Optimizer] ✓ ${strategy.name}: ${refined.route.distanceKm.toFixed(2)}km (${refined.metrics.distanceAccuracy.toFixed(1)}% error, ${refined.metrics.turnCount} turns${waterInfo})`);
        candidates.push(refined);
      } else {
        console.log(`[Route Optimizer] ✗ ${strategy.name}: Failed to converge`);
      }
    }

    if (candidates.length === 0) {
      // Fallback to simple geometric pattern if optimizer fails
      console.log('[Route Optimizer] All strategies failed, using fallback geometric pattern...');

      const { generateLoop } = await import('@/lib/ors');
      try {
        // Convert water features to avoidance polygons
        const avoidPolygons = waterFeatures
          .filter((f) => f.coordinates && f.coordinates.length >= 3)
          .map((f) => f.coordinates!);

        const orsResponse = await generateLoop(body.startCoord, body.distanceKm, avoidPolygons);
        const feature = orsResponse.features[0];
        const { distance, duration } = feature.properties.summary;
        const surfaceData = feature.properties.extras?.surface;
        const elevationData = feature.properties.extras?.elevation;
        const { calculateSurfaceScore, calculateElevationMetrics } = await import('@/lib/ors');

        const elevationMetrics = calculateElevationMetrics(elevationData);
        const fallbackRoute = {
          geojson: feature.geometry,
          distanceKm: distance,
          durationMin: duration / 60,
          surfaceScore: calculateSurfaceScore(surfaceData),
          coordinates: feature.geometry.coordinates as [number, number][],
          elevationGain: elevationMetrics.elevationGain,
          maxElevation: elevationMetrics.maxElevation,
          minElevation: elevationMetrics.minElevation,
        };

        console.log('[Route Optimizer] Fallback route generated:', distance.toFixed(2), 'km');

        return NextResponse.json<GenerateRouteResponse>({
          success: true,
          data: fallbackRoute,
          strategyUsed: 'Geometric Fallback',
        });
      } catch (fallbackError) {
        console.error('[Route Optimizer] Fallback also failed:', fallbackError);
        return NextResponse.json<GenerateRouteError>(
          {
            success: false,
            error: 'Could not generate route. Please check your API keys and try again.',
            code: 'NO_ACCURATE_ROUTE',
          },
          { status: 404 }
        );
      }
    }

    // Step 4: Select best route (highest overall score)
    const bestRoute = candidates.reduce((best, current) => {
      return current.metrics.overallScore > best.metrics.overallScore ? current : best;
    });

    console.log(`[Route Optimizer] Step 4: Best route selected: ${bestRoute.strategy.name} (score: ${bestRoute.metrics.overallScore})`);

    // Step 5: Aggressively simplify route to reduce turns
    console.log('[Route Optimizer] Step 5: Simplifying route (aggressive turn reduction)...');
    const originalCoordCount = bestRoute.route.coordinates.length;
    const simplifiedCoords = simplifyRoute(bestRoute.route.coordinates, 0.0005); // Higher tolerance = fewer turns
    bestRoute.route.coordinates = simplifiedCoords;
    console.log(`[Route Optimizer] Simplified: ${originalCoordCount} → ${simplifiedCoords.length} points (-${Math.round((1 - simplifiedCoords.length/originalCoordCount) * 100)}%)`);

    // Phase 4.6: Extract water points for long runs (15km+)
    const waterPoints = bestRoute.route.distanceKm >= 15
      ? osmFeatures.filter((f) => f.type === 'fountain')
      : undefined;

    if (waterPoints && waterPoints.length > 0) {
      console.log(`[Route Optimizer] Long run detected (${bestRoute.route.distanceKm.toFixed(1)}km) - including ${waterPoints.length} water points`);
    }

    return NextResponse.json<GenerateRouteResponse>({
      success: true,
      data: bestRoute.route,
      metrics: bestRoute.metrics,
      strategyUsed: bestRoute.strategy.name,
      waterPoints, // Phase 4.6
    });
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.status === 429) {
      return NextResponse.json<GenerateRouteError>(
        {
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
        },
        { status: 429 }
      );
    }

    console.error('Route generation error:', err);
    return NextResponse.json<GenerateRouteError>(
      {
        success: false,
        error: 'Failed to generate route',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
