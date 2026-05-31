import { END, StateGraph } from '@langchain/langgraph';
import { RouteAgentState } from './types';
import { routeAgent } from './route-agent';
import { safetyAgent } from './safety-agent';
import { scorerAgent } from './scorer-agent';

/**
 * LangGraph State Machine for Route Planning
 *
 * Flow:
 * START → Route Agent → Safety Agent → Scorer Agent → END
 *
 * Each agent has access to shared state and can update it
 */
export function createRouteGraph() {
  // Simple state graph with any type to avoid version-specific API issues
  const workflow = new StateGraph<RouteAgentState>({
    channels: {
      userQuery: { value: (x: string, y?: string) => y ?? x },
      distanceKm: { value: (x: number, y?: number) => y ?? x },
      startCoord: { value: (x: [number, number], y?: [number, number]) => y ?? x },
      routeType: { value: (x: any, y?: any) => y ?? x },
      cityPreference: { value: (x: any, y?: any) => y ?? x },
      timeOfDay: { value: (x?: number, y?: number) => y ?? x },
      routes: { value: (x?: any[], y?: any[]) => y ?? x },
      weatherData: { value: (x?: any, y?: any) => y ?? x },
      safetyScore: { value: (x?: any, y?: any) => y ?? x },
      finalRecommendation: { value: (x?: any, y?: any) => y ?? x },
      messages: { value: (x: any[], y?: any[]) => (y ? [...x, ...y] : x) },
      nextStep: { value: (x?: string, y?: string) => y ?? x },
    },
  });

  // Define nodes (agents)
  (workflow as any).addNode('route', routeAgent);
  (workflow as any).addNode('safety', safetyAgent);
  (workflow as any).addNode('scorer', scorerAgent);

  // Define edges (flow between agents)
  (workflow as any).setEntryPoint('route');

  // Route -> Safety or END
  (workflow as any).addConditionalEdges('route', (state: any) => {
    if (state.nextStep === 'error') return END;
    return 'safety';
  });

  // Safety -> Scorer or END
  (workflow as any).addConditionalEdges('safety', (state: any) => {
    if (state.nextStep === 'error') return END;
    return 'scorer';
  });

  // Scorer -> END
  (workflow as any).addEdge('scorer', END);

  return workflow.compile();
}

/**
 * Execute the route planning workflow
 */
export async function executeRouteWorkflow(input: {
  userQuery: string;
  distanceKm: number;
  startCoord: [number, number];
  routeType: 'loop' | 'point-to-point';
  cityPreference: 'stay-in-city' | 'can-leave-city';
  timeOfDay?: number;
}) {
  const graph = createRouteGraph();

  const initialState: any = {
    ...input,
    messages: [
      {
        agent: 'user',
        content: input.userQuery,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  console.log('[LangGraph] Starting workflow execution...');
  const startTime = Date.now();

  const result = await graph.invoke(initialState);

  const duration = Date.now() - startTime;
  console.log(`[LangGraph] Workflow completed in ${duration}ms`);

  return result;
}
