import { ChatOpenAI } from '@langchain/openai';
import { RouteAgentState, SafetyAssessment } from './types';
import { weatherAnalysisTool } from './tools/weather-tool';

/**
 * Safety & Weather Analysis Agent
 * Evaluates environmental conditions and safety factors
 */
export async function safetyAgent(state: RouteAgentState): Promise<Partial<RouteAgentState>> {
  console.log('[Safety Agent] Analyzing weather and safety conditions...');

  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.1,
  }).bindTools([weatherAnalysisTool]);

  const systemPrompt = `You are a running safety expert specializing in India-specific weather conditions.

Your responsibilities:
- Analyze current weather, AQI (critical for NCR region), UV index, and wind
- Identify heat risks (India summer: avoid 11 AM - 4 PM)
- Assess air quality for outdoor exercise
- Recommend best start times based on conditions
- Generate actionable safety warnings

Location: [${state.startCoord.join(', ')}]
Distance: ${state.distanceKm}km (${state.distanceKm >= 15 ? 'Long run - hydration critical' : 'Standard run'})
Time preference: ${state.timeOfDay !== undefined ? `${state.timeOfDay}:00` : 'Flexible'}

Analyze conditions and provide a comprehensive safety assessment with specific recommendations.`;

  const response = await model.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Analyze weather and safety conditions for this run.' },
  ]);

  // Execute weather tool
  const toolCalls = (response as any).tool_calls || [];
  let weatherData = state.weatherData;
  let safetyScore: SafetyAssessment | undefined;

  if (toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      if (toolCall.name === 'analyze_weather') {
        const resultGen = await weatherAnalysisTool.func(toolCall.args as any);
        // Handle both string and AsyncGenerator
        const result = typeof resultGen === 'string' ? resultGen : await (async () => {
          let fullResult = '';
          for await (const chunk of resultGen) {
            fullResult += chunk;
          }
          return fullResult;
        })();
        const parsed = JSON.parse(result);
        if (parsed.success) {
          weatherData = parsed;

          // Calculate comprehensive safety score
          safetyScore = calculateSafetyScore(parsed, state.distanceKm);
        }
      }
    }
  }

  const contentText = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  const message = {
    agent: 'safety' as const,
    content: contentText,
    timestamp: new Date().toISOString(),
    metadata: {
      safetyScore: safetyScore?.overallScore,
      alertCount: weatherData?.alerts?.length || 0,
    },
  };

  return {
    weatherData,
    safetyScore,
    messages: [...state.messages, message],
    nextStep: 'scorer',
  };
}

/**
 * Calculate comprehensive safety score from weather data
 */
function calculateSafetyScore(weatherData: any, distanceKm: number): SafetyAssessment {
  const { current, recommendations, alerts } = weatherData;

  // Heat risk (0-100, higher = worse)
  let heatRisk = 0;
  if (current.temp > 40) heatRisk = 90;
  else if (current.temp > 38) heatRisk = 70;
  else if (current.temp > 35) heatRisk = 50;
  else if (current.temp > 30) heatRisk = 30;
  else if (current.temp > 25) heatRisk = 10;

  // AQI risk
  let aqiRisk = 0;
  if (current.aqi) {
    const aqiValue = current.aqi.aqi;
    if (aqiValue > 300) aqiRisk = 100;
    else if (aqiValue > 200) aqiRisk = 80;
    else if (aqiValue > 150) aqiRisk = 60;
    else if (aqiValue > 100) aqiRisk = 40;
    else if (aqiValue > 50) aqiRisk = 20;
  }

  // UV risk
  let uvRisk = 0;
  if (current.uv) {
    const uvValue = current.uv.uv;
    if (uvValue >= 11) uvRisk = 90;
    else if (uvValue >= 8) uvRisk = 70;
    else if (uvValue >= 6) uvRisk = 50;
    else if (uvValue >= 3) uvRisk = 20;
  }

  // Wind risk
  let windRisk = 0;
  if (current.wind) {
    const windSpeed = current.wind.speed;
    if (windSpeed > 15) windRisk = 80;
    else if (windSpeed > 10) windRisk = 50;
    else if (windSpeed > 7) windRisk = 20;
  }

  // Overall score (100 - average risk)
  const avgRisk = (heatRisk + aqiRisk + uvRisk + windRisk) / 4;
  const overallScore = Math.max(0, 100 - avgRisk);

  // Generate recommendations
  const safetyRecommendations: string[] = [];

  if (heatRisk > 50) {
    safetyRecommendations.push('💧 Bring extra water - high heat risk');
    safetyRecommendations.push('🧢 Wear light-colored, breathable clothing');
  }

  if (aqiRisk > 50) {
    safetyRecommendations.push('😷 Consider wearing N95 mask or running indoors');
  }

  if (uvRisk > 50) {
    safetyRecommendations.push('🧴 Apply SPF 50+ sunscreen before running');
    safetyRecommendations.push('😎 Wear UV-blocking sunglasses');
  }

  if (windRisk > 50) {
    safetyRecommendations.push('💨 Plan route to avoid headwinds on the return');
  }

  if (distanceKm >= 15) {
    safetyRecommendations.push('💧 Long run detected - plan water stops every 5km');
  }

  return {
    overallScore: Math.round(overallScore),
    heatRisk: Math.round(heatRisk),
    aqiRisk: Math.round(aqiRisk),
    uvRisk: Math.round(uvRisk),
    windRisk: Math.round(windRisk),
    surfaceQuality: 70, // Will be updated by route metrics
    bestStartTime: recommendations[0]?.timeLabel,
    warnings: alerts || [],
    recommendations: safetyRecommendations,
  };
}
