import { getCached, setCache, cacheKeys, CACHE_TTL } from './cache';

const WINDY_API_KEY = process.env.WINDY_API_KEY;

export interface WindData {
  speed: number; // m/s
  direction: number; // degrees (0-360, 0=North, 90=East, 180=South, 270=West)
  gusts: number; // m/s
  timestamp: string;
}

/**
 * Fetch wind forecast from Windy API
 * Wind direction matters for runners - headwind on return is brutal
 * FREE tier: 500 requests/day
 */
export async function fetchWind(lat: number, lng: number): Promise<WindData | null> {
  if (!WINDY_API_KEY) {
    console.warn('[Windy] API key not configured, skipping wind fetch');
    return null;
  }

  // Check cache first (Phase 4)
  const cacheKey = cacheKeys.wind(lat, lng);
  const cached = getCached<WindData>(cacheKey);
  if (cached) {
    console.log(`[Windy] Cache hit for [${lat}, ${lng}]`);
    return cached;
  }

  try {
    // Windy Point Forecast API
    const response = await fetch(
      `https://api.windy.com/api/point-forecast/v2`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat,
          lon: lng,
          model: 'gfs', // Global Forecast System
          parameters: ['wind', 'gust'],
          levels: ['surface'],
          key: WINDY_API_KEY,
        }),
        next: { revalidate: 1800 }, // Cache for 30 minutes
      }
    );

    if (!response.ok) {
      console.error('[Windy] API error:', response.status);
      return null;
    }

    const data = await response.json();

    // Get current hour's forecast (first data point)
    const windU = data['wind_u-surface']?.[0] || 0; // U component (east-west)
    const windV = data['wind_v-surface']?.[0] || 0; // V component (north-south)
    const gust = data['gust-surface']?.[0] || 0;

    // Calculate wind speed and direction from U/V components
    const speed = Math.sqrt(windU * windU + windV * windV);
    const direction = (Math.atan2(windU, windV) * 180) / Math.PI;
    const normalizedDirection = (direction + 360) % 360; // Normalize to 0-360

    const windResult = {
      speed,
      direction: normalizedDirection,
      gusts: gust,
      timestamp: new Date(data.ts?.[0] || Date.now()).toISOString(),
    };

    // Cache the result (Phase 4)
    setCache(cacheKey, windResult, CACHE_TTL.WIND);

    return windResult;
  } catch (error) {
    console.error('[Windy] Fetch failed:', error);
    return null; // Non-critical failure
  }
}

/**
 * Calculate wind penalty/bonus for route based on wind direction
 * Compares wind direction to route bearing
 */
export function calculateWindEffect(
  windDirection: number,
  routeBearing: number
): {
  type: 'headwind' | 'tailwind' | 'crosswind';
  penalty: number;
} {
  // Calculate angle difference between wind and route
  let angleDiff = Math.abs(windDirection - routeBearing);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  // Headwind: wind coming from ahead (within 45° of route bearing)
  if (angleDiff < 45) {
    return { type: 'headwind', penalty: 10 };
  }

  // Tailwind: wind from behind (within 45° of opposite bearing)
  if (angleDiff > 135) {
    return { type: 'tailwind', penalty: -5 }; // Bonus!
  }

  // Crosswind: perpendicular
  return { type: 'crosswind', penalty: 0 };
}

/**
 * Get wind direction as compass bearing
 */
export function getWindDirectionLabel(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Get wind speed category (Beaufort scale)
 */
export function getWindCategory(speedMS: number): {
  label: string;
  description: string;
  color: string;
} {
  if (speedMS < 0.5)
    return {
      label: 'Calm',
      description: 'Smoke rises vertically',
      color: 'gray',
    };
  if (speedMS < 1.6)
    return {
      label: 'Light Air',
      description: 'Direction shown by smoke drift',
      color: 'blue',
    };
  if (speedMS < 3.4)
    return {
      label: 'Light Breeze',
      description: 'Wind felt on face',
      color: 'green',
    };
  if (speedMS < 5.5)
    return {
      label: 'Gentle Breeze',
      description: 'Leaves rustle',
      color: 'green',
    };
  if (speedMS < 8.0)
    return {
      label: 'Moderate Breeze',
      description: 'Small branches move',
      color: 'yellow',
    };
  if (speedMS < 10.8)
    return {
      label: 'Fresh Breeze',
      description: 'Small trees sway',
      color: 'orange',
    };
  if (speedMS < 13.9)
    return {
      label: 'Strong Breeze',
      description: 'Large branches move',
      color: 'orange',
    };
  return {
    label: 'Near Gale',
    description: 'Whole trees in motion - difficult to run',
    color: 'red',
  };
}
