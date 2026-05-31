import { ChatOpenAI } from '@langchain/openai';
import { RouteAgentState } from './types';
import { routeGenerationTool } from './tools/route-tool';

/**
 * Route Generation Agent
 * Responsible for generating optimized running routes using ORS
 */
export async function routeAgent(state: RouteAgentState): Promise<Partial<RouteAgentState>> {
  console.log('[Route Agent] Starting route generation...');

  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.2,
  }).bindTools([routeGenerationTool]);

  const systemPrompt = `You are a running route optimization expert. Your job is to generate safe, efficient running routes.

Key responsibilities:
- Generate multiple route candidates based on user requirements
- Consider distance accuracy, surface quality, and elevation
- Avoid water bodies and hazards
- Prioritize well-lit routes for night running
- Include water points for long runs (15km+)

User request: ${state.userQuery}
Distance: ${state.distanceKm}km
Route type: ${state.routeType}
Start: [${state.startCoord.join(', ')}]
Time of day: ${state.timeOfDay !== undefined ? `${state.timeOfDay}:00` : 'Not specified'}

Generate route candidates and explain your choices.`;

  const response = await model.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Generate the best running routes for my request.' },
  ]);

  // Check if tool was called
  const toolCalls = (response as any).tool_calls || [];
  let routes = state.routes || [];

  if (toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      if (toolCall.name === 'generate_route') {
        const resultGen = await routeGenerationTool.func(toolCall.args as any);
        // Handle both string and AsyncGenerator
        const result = typeof resultGen === 'string' ? resultGen : await (async () => {
          let fullResult = '';
          for await (const chunk of resultGen) {
            fullResult += chunk;
          }
          return fullResult;
        })();
        const parsed = JSON.parse(result);
        if (parsed.success && parsed.candidates) {
          routes = parsed.candidates;
        }
      }
    }
  }

  const contentText = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  const message = {
    agent: 'route' as const,
    content: contentText,
    timestamp: new Date().toISOString(),
    metadata: { routesFound: routes.length },
  };

  return {
    routes,
    messages: [...state.messages, message],
    nextStep: routes.length > 0 ? 'safety' : 'error',
  };
}
