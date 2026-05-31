/**
 * Simple API integration test
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

console.log('🧪 Testing API Integrations...\n');

// Test OpenWeatherMap
async function testWeather() {
  console.log('1️⃣ Testing OpenWeatherMap API...');
  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey) {
    console.log('   ❌ WEATHER_API_KEY not found');
    return;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=28.6139&lon=77.209&units=metric&appid=${apiKey}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Weather API working: ${data.main.temp}°C in ${data.name}`);
    } else {
      console.log(`   ❌ Weather API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Weather API failed:', (error as Error).message);
  }
}

// Test OpenAI
async function testOpenAI() {
  console.log('\n2️⃣ Testing OpenAI API...');
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log('   ❌ OPENAI_API_KEY not found');
    return;
  }

  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      maxTokens: 50,
    });

    const response = await model.invoke('Say "API is working" in 3 words');
    console.log(`   ✅ OpenAI API working: ${response.content}`);
  } catch (error) {
    console.log('   ❌ OpenAI API failed:', (error as Error).message);
  }
}

// Test ORS
async function testORS() {
  console.log('\n3️⃣ Testing OpenRouteService API...');
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    console.log('   ❌ ORS_API_KEY not found');
    return;
  }

  try {
    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
      {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [[77.209, 28.6139], [77.215, 28.620]],
          preference: 'recommended',
          units: 'km',
          language: 'en',
          instructions: false,
          elevation: false,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const distance = data.features[0].properties.summary.distance;
      console.log(`   ✅ ORS API working: ${distance.toFixed(2)}km route generated`);
    } else {
      console.log(`   ❌ ORS API error: ${response.status}`);
    }
  } catch (error) {
    console.log('   ❌ ORS API failed:', (error as Error).message);
  }
}

// Run all tests
async function runTests() {
  await testWeather();
  await testOpenAI();
  await testORS();

  console.log('\n✅ API integration tests complete!\n');
}

runTests().catch(console.error);
