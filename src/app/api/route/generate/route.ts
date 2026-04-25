import { NextRequest, NextResponse } from 'next/server';
import {
  generateLoop,
  generatePointToPoint,
  calculateSurfaceScore,
} from '@/lib/ors';
import {
  GenerateRouteRequest,
  GenerateRouteResponse,
  GenerateRouteError,
} from '@/types/api';
import { RouteData } from '@/types/route';

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

    const orsResponse =
      body.routeType === 'loop'
        ? await generateLoop(body.startCoord, body.distanceKm)
        : await generatePointToPoint(body.startCoord, body.distanceKm);

    const feature = orsResponse.features[0];
    const { distance, duration } = feature.properties.summary;
    const surfaceData = feature.properties.extras?.surface;

    const routeData: RouteData = {
      geojson: feature.geometry,
      distanceKm: distance,
      durationMin: duration / 60,
      surfaceScore: calculateSurfaceScore(surfaceData),
      coordinates: feature.geometry.coordinates as [number, number][],
    };

    return NextResponse.json<GenerateRouteResponse>({
      success: true,
      data: routeData,
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

    if (err.message?.includes('no route')) {
      return NextResponse.json<GenerateRouteError>(
        {
          success: false,
          error: 'No route found for these coordinates',
          code: 'NO_ROUTE_FOUND',
        },
        { status: 404 }
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
