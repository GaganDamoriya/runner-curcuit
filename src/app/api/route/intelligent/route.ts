import { NextRequest, NextResponse } from 'next/server';
import { executeRouteWorkflow } from '@/lib/agents/graph';

/**
 * Intelligent Route API - Uses LangGraph multi-agent system
 *
 * POST /api/route/intelligent
 *
 * This endpoint provides a more conversational and comprehensive route recommendation
 * compared to the basic /api/route/generate endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.distanceKm || body.distanceKm < 1 || body.distanceKm > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Distance must be between 1-100km',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    if (!body.startCoord || !Array.isArray(body.startCoord)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid start coordinate',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            'OpenAI API key not configured. Set OPENAI_API_KEY in your environment.',
          code: 'API_KEY_MISSING',
        },
        { status: 500 }
      );
    }

    console.log(
      `[Intelligent Route] Processing request: ${body.distanceKm}km ${body.routeType || 'loop'} from [${body.startCoord}]`
    );

    // Build user query
    const userQuery =
      body.userQuery ||
      `Generate a ${body.distanceKm}km ${body.routeType || 'loop'} running route${
        body.timeOfDay !== undefined ? ` for ${body.timeOfDay}:00` : ''
      }`;

    // Execute LangGraph workflow
    const result: any = await executeRouteWorkflow({
      userQuery,
      distanceKm: body.distanceKm,
      startCoord: body.startCoord,
      routeType: body.routeType || 'loop',
      cityPreference: body.cityPreference || 'stay-in-city',
      timeOfDay: body.timeOfDay,
    });

    // Check if workflow succeeded
    if (!result.finalRecommendation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not generate route recommendation',
          code: 'NO_ROUTE_FOUND',
        },
        { status: 404 }
      );
    }

    const { finalRecommendation, weatherData, messages } = result;

    return NextResponse.json({
      success: true,
      data: {
        route: finalRecommendation.selectedRoute,
        metrics: finalRecommendation.metrics,
        safety: finalRecommendation.safety,
        weather: weatherData,
        waterPoints: finalRecommendation.waterPoints,
      },
      explanation: finalRecommendation.explanation,
      advice: finalRecommendation.userFriendlyAdvice,
      conversation: (messages || []).map((m: any) => ({
        agent: m.agent,
        content: m.content,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    const err = error as Error & { status?: number };

    console.error('[Intelligent Route] Error:', err);

    if (err.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate intelligent route recommendation',
        code: 'SERVER_ERROR',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
