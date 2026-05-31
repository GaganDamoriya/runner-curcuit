import { getCached, setCache, cacheKeys, CACHE_TTL } from './cache';

const OPENUV_BASE_URL = 'https://api.openuv.io/api/v1';
const OPENUV_API_KEY = process.env.OPENUV_API_KEY;

export interface UVData {
  uv: number; // Current UV index
  uvMax: number; // Max expected today
  uvMaxTime: string; // When UV peaks (ISO timestamp)
  safeExposureTime: number; // Minutes until sunburn (for skin type 3)
  ozone: number; // Ozone level (Dobson Units)
}

/**
 * Fetch UV index data from OpenUV
 * Critical for Indian summers where UV regularly exceeds 10
 * FREE tier: 1000 requests/day (50 requests/hour)
 */
export async function fetchUV(lat: number, lng: number): Promise<UVData | null> {
  if (!OPENUV_API_KEY) {
    console.warn('[OpenUV] API key not configured, estimating UV from time');
    return estimateUVFromTime(lat, lng);
  }

  // Check cache first (Phase 4)
  const cacheKey = cacheKeys.uv(lat, lng);
  const cached = getCached<UVData>(cacheKey);
  if (cached) {
    console.log(`[OpenUV] Cache hit for [${lat}, ${lng}]`);
    return cached;
  }

  try {
    const response = await fetch(
      `${OPENUV_BASE_URL}/uv?lat=${lat}&lng=${lng}`,
      {
        headers: {
          'x-access-token': OPENUV_API_KEY,
        },
        next: { revalidate: 3600 }, // Cache for 1 hour (UV changes gradually)
      }
    );

    if (!response.ok) {
      // Rate limit (429) or other errors
      if (response.status === 429) {
        console.warn('[OpenUV] Rate limit hit, falling back to estimation');
        return estimateUVFromTime(lat, lng);
      }
      console.error('[OpenUV] API error:', response.status);
      return null;
    }

    const data = await response.json();
    const result = data.result;

    const uvResult = {
      uv: result.uv,
      uvMax: result.uv_max,
      uvMaxTime: result.uv_max_time,
      safeExposureTime: result.safe_exposure_time?.st3 || 0, // Skin type 3 (medium)
      ozone: result.ozone || 0,
    };

    // Cache the result (Phase 4)
    setCache(cacheKey, uvResult, CACHE_TTL.UV);

    return uvResult;
  } catch (error) {
    console.error('[OpenUV] Fetch failed:', error);
    return estimateUVFromTime(lat, lng);
  }
}

/**
 * Fallback: Estimate UV index from time of day and latitude
 * Used when API is unavailable or rate-limited
 */
function estimateUVFromTime(lat: number, lng: number): UVData | null {
  const now = new Date();
  const hour = now.getHours();

  // UV peaks at solar noon (around 12-2 PM)
  // Rough estimation based on time of day
  let estimatedUV = 0;

  if (hour >= 10 && hour <= 14) {
    // Peak UV hours
    estimatedUV = Math.abs(lat) < 23.5 ? 11 : 8; // Higher UV near equator
  } else if (hour >= 8 && hour < 10) {
    estimatedUV = 5; // Morning
  } else if (hour > 14 && hour <= 16) {
    estimatedUV = 6; // Afternoon
  } else if (hour > 16 && hour <= 18) {
    estimatedUV = 3; // Late afternoon
  } else {
    estimatedUV = 0; // Dawn/dusk/night
  }

  console.log(`[OpenUV] Using estimated UV: ${estimatedUV} (hour: ${hour})`);

  return {
    uv: estimatedUV,
    uvMax: estimatedUV,
    uvMaxTime: new Date(now.setHours(12, 0, 0, 0)).toISOString(),
    safeExposureTime: estimatedUV > 0 ? Math.floor(200 / estimatedUV) : 999,
    ozone: 300, // Default ozone value
  };
}

/**
 * Calculate UV penalty for route scoring
 */
export function calculateUVPenalty(uv: number): number {
  if (uv < 3) return 0; // Low
  if (uv <= 5) return 5; // Moderate
  if (uv <= 7) return 10; // High
  if (uv <= 10) return 20; // Very High
  return 30; // Extreme (11+)
}

/**
 * Get UV category and recommendations
 */
export function getUVCategory(uv: number): {
  label: string;
  color: string;
  recommendation: string;
} {
  if (uv < 3)
    return {
      label: 'Low',
      color: 'green',
      recommendation: 'No protection needed',
    };
  if (uv <= 5)
    return {
      label: 'Moderate',
      color: 'yellow',
      recommendation: 'Wear sunscreen if outside for 30+ minutes',
    };
  if (uv <= 7)
    return {
      label: 'High',
      color: 'orange',
      recommendation: 'Apply SPF 30+ sunscreen, wear a hat',
    };
  if (uv <= 10)
    return {
      label: 'Very High',
      color: 'red',
      recommendation: 'Apply SPF 50+ sunscreen, seek shade during midday',
    };
  return {
    label: 'Extreme',
    color: 'purple',
    recommendation: 'Avoid outdoor activity between 10 AM - 4 PM, full sun protection required',
  };
}
