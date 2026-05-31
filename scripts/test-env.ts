/**
 * Quick environment variable test
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

console.log('🔍 Checking Environment Variables...\n');

const requiredKeys = {
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
  'WEATHER_API_KEY': process.env.WEATHER_API_KEY,
  'ORS_API_KEY': process.env.ORS_API_KEY,
  'WAQI_API_TOKEN': process.env.WAQI_API_TOKEN,
  'NEXT_PUBLIC_MAPBOX_TOKEN': process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
};

const optionalKeys = {
  'OPENUV_API_KEY': process.env.OPENUV_API_KEY,
  'WINDY_API_KEY': process.env.WINDY_API_KEY,
};

console.log('Required Keys:');
for (const [key, value] of Object.entries(requiredKeys)) {
  const status = value && value.length > 10 ? '✅' : '❌';
  const preview = value ? `${value.substring(0, 20)}...` : 'NOT SET';
  console.log(`  ${status} ${key}: ${preview}`);
}

console.log('\nOptional Keys:');
for (const [key, value] of Object.entries(optionalKeys)) {
  const status = value && value.length > 10 ? '✅' : '⚠️';
  const preview = value ? `${value.substring(0, 20)}...` : 'NOT SET';
  console.log(`  ${status} ${key}: ${preview}`);
}

console.log('\n✅ Environment check complete!\n');
