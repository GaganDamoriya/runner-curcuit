interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

// In-memory cache (server-side only, resets on restart)
const cache = new Map<string, CacheEntry<any>>();

/**
 * Get cached data if not expired
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    // Expired, remove from cache
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set data in cache with TTL
 */
export function setCache<T>(key: string, data: T, ttlMinutes: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMinutes * 60 * 1000,
  });
}

/**
 * Clear specific cache entry
 */
export function clearCache(key: string): void {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

/**
 * Cache key generators for different APIs
 * Using consistent naming and rounding for better cache hits
 */
export const cacheKeys = {
  osm: (lat: number, lng: number, radius: number) =>
    `osm_${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`,

  waqi: (lat: number, lng: number) =>
    `waqi_${lat.toFixed(3)}_${lng.toFixed(3)}`,

  uv: (lat: number, lng: number) =>
    `uv_${lat.toFixed(3)}_${lng.toFixed(3)}`,

  wind: (lat: number, lng: number) =>
    `wind_${lat.toFixed(3)}_${lng.toFixed(3)}`,

  weather: (lat: number, lng: number) =>
    `weather_${lat.toFixed(3)}_${lng.toFixed(3)}`,

  elevation: (coords: string) =>
    `elevation_${coords.substring(0, 50)}`, // Hash-like substring for route coords
};

/**
 * TTL constants (in minutes)
 */
export const CACHE_TTL = {
  OSM: 1440, // 24 hours - infrastructure doesn't change daily
  WAQI: 30, // 30 minutes - AQI updates frequently
  UV: 60, // 1 hour - UV changes gradually
  WIND: 30, // 30 minutes - weather pattern
  WEATHER: 10, // 10 minutes - real-time weather
  ELEVATION: 1440, // 24 hours - elevation never changes
};
