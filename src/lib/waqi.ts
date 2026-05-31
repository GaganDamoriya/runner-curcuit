import { getCached, setCache, cacheKeys, CACHE_TTL } from './cache';

const WAQI_BASE_URL = 'https://api.waqi.info';
const WAQI_TOKEN = process.env.WAQI_API_TOKEN;

export interface WAQIData {
  aqi: number; // 0-500 (US EPA scale)
  dominantPollutant: string;
  pm25: number;
  pm10: number;
  station: string;
  timestamp: string;
}

/**
 * Fetch AQI data from World Air Quality Index (WAQI)
 * Uses CPCB (India official) data - more accurate than OpenWeatherMap for India
 */
export async function fetchWAQI(
  lat: number,
  lng: number
): Promise<WAQIData | null> {
  if (!WAQI_TOKEN) {
    console.warn('[WAQI] API token not configured, skipping AQI fetch');
    return null;
  }

  // Check cache first (Phase 4)
  const cacheKey = cacheKeys.waqi(lat, lng);
  const cached = getCached<WAQIData>(cacheKey);
  if (cached) {
    console.log(`[WAQI] Cache hit for [${lat}, ${lng}]`);
    return cached;
  }

  try {
    const response = await fetch(
      `${WAQI_BASE_URL}/feed/geo:${lat};${lng}/?token=${WAQI_TOKEN}`,
      { next: { revalidate: 1800 } } // Cache for 30 minutes
    );

    if (!response.ok) {
      console.error('[WAQI] API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'ok' || !data.data) {
      console.error('[WAQI] Invalid response:', data);
      return null;
    }

    const result = {
      aqi: data.data.aqi,
      dominantPollutant: data.data.dominantpol || 'unknown',
      pm25: data.data.iaqi?.pm25?.v || 0,
      pm10: data.data.iaqi?.pm10?.v || 0,
      station: data.data.city?.name || 'Unknown Station',
      timestamp: data.data.time?.iso || new Date().toISOString(),
    };

    // Cache the result (Phase 4)
    setCache(cacheKey, result, CACHE_TTL.WAQI);

    return result;
  } catch (error) {
    console.error('[WAQI] Fetch failed:', error);
    return null; // Non-critical failure
  }
}

/**
 * Calculate AQI penalty for route scoring
 */
export function calculateAQIPenalty(aqi: number): number {
  if (aqi <= 50) return 0; // Good
  if (aqi <= 100) return 10; // Moderate
  if (aqi <= 150) return 20; // Unhealthy for sensitive groups
  if (aqi <= 200) return 30; // Unhealthy
  return 50; // Very Unhealthy / Hazardous
}

/**
 * Get AQI category label and description
 */
export function getAQICategory(aqi: number): {
  label: string;
  description: string;
  color: string;
} {
  if (aqi <= 50)
    return {
      label: 'Good',
      description: 'Air quality is satisfactory',
      color: 'green',
    };
  if (aqi <= 100)
    return {
      label: 'Moderate',
      description: 'Acceptable for most people',
      color: 'yellow',
    };
  if (aqi <= 150)
    return {
      label: 'Unhealthy for Sensitive Groups',
      description: 'Sensitive individuals should limit prolonged outdoor exertion',
      color: 'orange',
    };
  if (aqi <= 200)
    return {
      label: 'Unhealthy',
      description: 'Everyone may begin to experience health effects',
      color: 'red',
    };
  if (aqi <= 300)
    return {
      label: 'Very Unhealthy',
      description: 'Health alert: everyone may experience serious effects',
      color: 'purple',
    };
  return {
    label: 'Hazardous',
    description: 'Health warnings of emergency conditions - avoid outdoor activity',
    color: 'maroon',
  };
}
