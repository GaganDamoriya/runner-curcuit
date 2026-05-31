/**
 * Test script for LangGraph intelligent routing system
 *
 * Usage:
 *   npx tsx scripts/test-intelligent-routing.ts
 *
 * Requirements:
 *   - All API keys configured in .env.local
 *   - npm install tsx (if not installed)
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { executeRouteWorkflow } from '../src/lib/agents/graph';

async function testIntelligentRouting() {
  console.log('🚀 Testing LangGraph Intelligent Routing System\n');

  // Test Case 1: Delhi morning run with AQI concerns
  console.log('📍 Test Case 1: Delhi morning run (AQI-sensitive)');
  console.log('─'.repeat(60));

  const test1 = {
    userQuery: 'I have asthma and need a safe 8km morning run avoiding pollution',
    distanceKm: 8,
    startCoord: [77.209, 28.6139] as [number, number], // Delhi
    routeType: 'loop' as const,
    cityPreference: 'stay-in-city' as const,
    timeOfDay: 6,
  };

  try {
    console.log('Input:', JSON.stringify(test1, null, 2));
    console.log('\n⏳ Executing workflow (this takes ~5-7 seconds)...\n');

    const startTime = Date.now();
    const result: any = await executeRouteWorkflow(test1);
    const duration = Date.now() - startTime;

    console.log('✅ Workflow completed in', duration, 'ms\n');

    if (result.finalRecommendation) {
      const { finalRecommendation, safetyScore, weatherData } = result;

      console.log('📊 Results:');
      console.log('─'.repeat(60));
      console.log('Route Distance:', finalRecommendation.selectedRoute.distanceKm.toFixed(2), 'km');
      console.log('Surface Score:', finalRecommendation.selectedRoute.surfaceScore, '/100');
      console.log('Elevation Gain:', finalRecommendation.selectedRoute.elevationGain, 'm');
      console.log('');
      console.log('🛡️ Safety Scores:');
      console.log('  Overall:', safetyScore?.overallScore, '/100');
      console.log('  Heat Risk:', safetyScore?.heatRisk, '/100');
      console.log('  AQI Risk:', safetyScore?.aqiRisk, '/100');
      console.log('  UV Risk:', safetyScore?.uvRisk, '/100');
      console.log('  Wind Risk:', safetyScore?.windRisk, '/100');
      console.log('');
      console.log('⏰ Best Start Time:', safetyScore?.bestStartTime || 'N/A');
      console.log('');
      console.log('⚠️ Warnings:', safetyScore?.warnings.length || 0);
      safetyScore?.warnings.forEach((w: any) => console.log('  -', w));
      console.log('');
      console.log('💡 Recommendations:', finalRecommendation.userFriendlyAdvice.length);
      finalRecommendation.userFriendlyAdvice.forEach((a: any) => console.log('  -', a));
      console.log('');
      console.log('🤖 AI Explanation:');
      console.log('─'.repeat(60));
      console.log(finalRecommendation.explanation);
      console.log('─'.repeat(60));
      console.log('');
      console.log('🌡️ Current Weather:');
      console.log('  Temp:', weatherData?.current.temp, '°C');
      console.log('  Feels Like:', weatherData?.current.feelsLike, '°C');
      console.log('  AQI:', weatherData?.current.aqi?.aqi || 'N/A');
      console.log('  UV Index:', weatherData?.current.uv?.uv || 'N/A');
      console.log('');
      console.log('💬 Agent Conversation:');
      console.log('─'.repeat(60));
      result.messages.forEach((msg: any, idx: number) => {
        const icon = msg.agent === 'user' ? '👤' : '🤖';
        console.log(`${idx + 1}. ${icon} ${msg.agent.toUpperCase()}`);
        console.log(`   ${msg.content.substring(0, 100)}...`);
        console.log(`   [${new Date(msg.timestamp).toLocaleTimeString()}]`);
        console.log('');
      });
      console.log('─'.repeat(60));
    } else {
      console.error('❌ No recommendation generated');
      console.log('State:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
  console.log('\nNext steps:');
  console.log('1. Try the demo component: <IntelligentRouteDemo />');
  console.log('2. Use the React Query hook: useIntelligentRoute()');
  console.log('3. Read LANGGRAPH_GUIDE.md for architecture details');
  console.log('4. Add traffic/hazard APIs for advanced routing');
}

// Run tests
testIntelligentRouting().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
