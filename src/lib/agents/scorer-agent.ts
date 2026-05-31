import { ChatOpenAI } from '@langchain/openai';
import { RouteAgentState, RouteRecommendation } from './types';

/**
 * Route Scoring & Recommendation Agent
 * Combines route quality and safety data to make final recommendation
 */
export async function scorerAgent(state: RouteAgentState): Promise<Partial<RouteAgentState>> {
  console.log('[Scorer Agent] Evaluating routes and making recommendation...');

  if (!state.routes || state.routes.length === 0 || !state.safetyScore) {
    return {
      ...state,
      nextStep: 'error',
    };
  }

  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.3,
  });

  // Combine route metrics with safety assessment
  const routeAnalysis = state.routes.map((candidate) => {
    const routeScore = candidate.metrics?.overallScore || 0;
    const safetyScore = state.safetyScore?.overallScore || 0;
    const surfaceScore = candidate.route.surfaceScore || 50;

    // Weighted combined score: 40% route quality, 40% safety, 20% surface
    const combinedScore = routeScore * 0.4 + safetyScore * 0.4 + surfaceScore * 0.2;

    return {
      ...candidate,
      combinedScore: Math.round(combinedScore),
    };
  });

  // Sort by combined score
  routeAnalysis.sort((a, b) => b.combinedScore - a.combinedScore);
  const bestRoute = routeAnalysis[0];

  const systemPrompt = `You are a running route advisor. Explain the selected route in a friendly, conversational way.

SELECTED ROUTE:
- Strategy: ${bestRoute.strategyUsed}
- Distance: ${bestRoute.route.distanceKm.toFixed(2)}km
- Surface Score: ${bestRoute.route.surfaceScore}/100
- Elevation Gain: ${bestRoute.route.elevationGain}m
- Combined Score: ${bestRoute.combinedScore}/100

SAFETY CONDITIONS:
- Overall Safety: ${state.safetyScore!.overallScore}/100
- Heat Risk: ${state.safetyScore!.heatRisk}/100
- AQI Risk: ${state.safetyScore!.aqiRisk}/100
- UV Risk: ${state.safetyScore!.uvRisk}/100
- Best Start Time: ${state.safetyScore!.bestStartTime || 'Flexible'}

WARNINGS: ${state.safetyScore!.warnings.join(', ') || 'None'}

WEATHER DATA: ${JSON.stringify(state.weatherData?.current || {})}

Your task:
1. Explain why this route was chosen (distance accuracy, surface quality, safety)
2. Highlight key safety considerations (heat, AQI, UV)
3. Provide 3-5 actionable tips for the runner
4. Keep it conversational and encouraging

DO NOT just list data - tell a story about this route and why it's the best choice for the user.`;

  const response = await model.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Explain this route recommendation in a friendly, helpful way. Focus on what matters most: ${state.userQuery}`,
    },
  ]);

  // Extract advice into bullet points
  const explanation = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);
  const userFriendlyAdvice = state.safetyScore!.recommendations;

  const recommendation: RouteRecommendation = {
    selectedRoute: bestRoute.route,
    metrics: bestRoute.metrics,
    safety: {
      ...state.safetyScore!,
      surfaceQuality: bestRoute.route.surfaceScore || 50,
    },
    explanation,
    userFriendlyAdvice,
    waterPoints: bestRoute.waterPoints,
  };

  const message = {
    agent: 'scorer' as const,
    content: explanation,
    timestamp: new Date().toISOString(),
    metadata: {
      selectedRoute: bestRoute.strategyUsed,
      combinedScore: bestRoute.combinedScore,
    },
  };

  return {
    finalRecommendation: recommendation,
    messages: [...state.messages, message],
    nextStep: 'complete',
  };
}
