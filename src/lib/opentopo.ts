const OPENTOPO_BASE_URL = 'https://api.opentopodata.org/v1/mapzen';

/**
 * Fetch elevation profile for a set of coordinates
 * OpenTopoData is FREE with no API key required and no rate limits (reasonable usage)
 * Used as fallback when ORS elevation data is missing
 */
export async function fetchElevationProfile(
  coordinates: [number, number][]
): Promise<number[]> {
  if (coordinates.length === 0) {
    console.warn('[OpenTopoData] No coordinates provided');
    return [];
  }

  try {
    // OpenTopoData accepts batches of up to 100 locations
    const maxBatchSize = 100;
    const sampleRate = Math.ceil(coordinates.length / maxBatchSize);
    const sampledCoords = coordinates.filter((_, i) => i % sampleRate === 0);

    console.log(
      `[OpenTopoData] Fetching elevation for ${sampledCoords.length} points (sampled from ${coordinates.length})`
    );

    // Format: lat,lng|lat,lng|...
    const locations = sampledCoords
      .map(([lng, lat]) => `${lat},${lng}`)
      .join('|');

    const response = await fetch(
      `${OPENTOPO_BASE_URL}?locations=${locations}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours (elevation doesn't change)
    );

    if (!response.ok) {
      console.error('[OpenTopoData] API error:', response.status);
      return [];
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results) {
      console.error('[OpenTopoData] Invalid response:', data);
      return [];
    }

    const elevations = data.results.map((r: any) => r.elevation || 0);
    console.log(
      `[OpenTopoData] Success: elevation range ${Math.min(...elevations)}m - ${Math.max(...elevations)}m`
    );

    return elevations;
  } catch (error) {
    console.error('[OpenTopoData] Fetch failed:', error);
    return [];
  }
}

/**
 * Calculate hilliness score from elevation profile
 * Returns 0-100 where 100 = very hilly
 */
export function calculateHillinessScore(elevations: number[]): number {
  if (elevations.length < 2) return 0;

  // Sum of absolute elevation changes
  let totalChange = 0;
  for (let i = 1; i < elevations.length; i++) {
    totalChange += Math.abs(elevations[i] - elevations[i - 1]);
  }

  // Normalize to 0-100 (assuming 1000m total change = very hilly)
  const hilliness = Math.min(100, (totalChange / 1000) * 100);

  return Math.round(hilliness);
}

/**
 * Calculate elevation gain from elevation profile
 */
export function calculateElevationGain(elevations: number[]): number {
  if (elevations.length < 2) return 0;

  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) {
      gain += diff;
    }
  }

  return Math.round(gain);
}

/**
 * Get elevation statistics
 */
export function getElevationStats(elevations: number[]): {
  min: number;
  max: number;
  gain: number;
  hilliness: number;
} {
  if (elevations.length === 0) {
    return { min: 0, max: 0, gain: 0, hilliness: 0 };
  }

  return {
    min: Math.round(Math.min(...elevations)),
    max: Math.round(Math.max(...elevations)),
    gain: calculateElevationGain(elevations),
    hilliness: calculateHillinessScore(elevations),
  };
}
