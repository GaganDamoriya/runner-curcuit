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

    // Step 1: Analyze nearby running-friendly POIs (parks, trails, etc.)
    console.log('[Route Optimizer] Step 1: Analyzing nearby POIs via OSM...');
    const osmFeatures = await analyzeNearbyPOIs(body.startCoord, 3);
    console.log(`[Route Optimizer] Found ${osmFeatures.length} nearby POIs`);

    // Step 2: Generate smart waypoint strategies based on POIs
    console.log('[Route Optimizer] Step 2: Generating waypoint strategies...');
    const strategies = generateWaypointStrategies(
      body.startCoord,
      body.distanceKm,
      osmFeatures,
      body
    );
    console.log(`[Route Optimizer] Generated ${strategies.length} strategies: ${strategies.map(s => s.name).join(', ')}`);

    // Step 3: Refine each strategy iteratively (max 3 attempts per strategy)
    console.log('[Route Optimizer] Step 3: Refining routes (iterative distance adjustment)...');
    const candidates: RouteCandidate[] = [];

    for (const strategy of strategies) {
      console.log(`[Route Optimizer] Testing strategy: ${strategy.name}`);
      const refined = await refineRoute(strategy, body.distanceKm, 3);
      if (refined) {
        console.log(`[Route Optimizer] ✓ ${strategy.name}: ${refined.route.distanceKm.toFixed(2)}km (${refined.metrics.distanceAccuracy.toFixed(1)}% error, ${refined.metrics.turnCount} turns)`);
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
        const orsResponse = await generateLoop(body.startCoord, body.distanceKm);
        const feature = orsResponse.features[0];
        const { distance, duration } = feature.properties.summary;
        const surfaceData = feature.properties.extras?.surface;
        const { calculateSurfaceScore } = await import('@/lib/ors');

        const fallbackRoute = {
          geojson: feature.geometry,
          distanceKm: distance,
          durationMin: duration / 60,
          surfaceScore: calculateSurfaceScore(surfaceData),
          coordinates: feature.geometry.coordinates as [number, number][],
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

    // Step 5: Simplify route to reduce micro-turns
    console.log('[Route Optimizer] Step 5: Simplifying route...');
    const originalCoordCount = bestRoute.route.coordinates.length;
    const simplifiedCoords = simplifyRoute(bestRoute.route.coordinates, 0.0001);
    bestRoute.route.coordinates = simplifiedCoords;
    console.log(`[Route Optimizer] Simplified: ${originalCoordCount} → ${simplifiedCoords.length} points`);

    return NextResponse.json<GenerateRouteResponse>({
      success: true,
      data: bestRoute.route,
      metrics: bestRoute.metrics,
      strategyUsed: bestRoute.strategy.name,
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
