# Multi-API Integration Plan: Enhanced Route Safety & India-Specific Features (Zero Cost)

## Context

Runner Circuit currently uses ORS for routing, OpenWeatherMap for basic weather, and Overpass for limited POI data (parks, trails, water). The user wants to dramatically enhance route intelligence by integrating multiple free APIs to provide:

**Safety features**: Water fountains, street lighting, emergency facilities, traffic safety
**Environmental awareness**: Better AQI (India-specific via WAQI), UV index, wind direction, green cover
**India-specific optimizations**: Heat islands, post-rain warnings, school/worship timing, water point planning

**Constraint**: Keep it 100% free. No paid API tiers.

**Current architecture**:
- API clients in `src/lib/` (ors.ts, weather.ts, osm-analyzer.ts)
- Route handlers in `src/app/api/` (route/generate/, weather/advice/)
- Scoring formula: Distance (35%), Turns (30%), Surface (20%), Scenic (15%), minus heat/water penalties
- No caching layer exists

**Strategy**: Maximize Overpass API (OSM) as the data powerhouse, supplement with specialized free APIs (WAQI, OpenUV, Windy, OpenTopoData).

---

## Phase 1: Extend Overpass Queries (Biggest Impact, Zero New APIs)

**Goal**: Extract 10x more safety & infrastructure data from OSM via smarter compound queries.

### New OSM Feature Types to Query

**Safety infrastructure**:
- `amenity=drinking_water` → Water fountains
- `lit=yes` OR `highway=street_lamp` → Street lighting
- `amenity=hospital` → Emergency medical
- `amenity=police` → Police stations
- `amenity=toilets` → Public restrooms

**Hazard awareness**:
- `landuse=construction` → Construction zones
- `highway=traffic_signals` → Traffic signals
- `highway=crossing` → Pedestrian crossings
- `amenity=school` → School zones (for rush hour awareness)
- `amenity=place_of_worship` → Religious sites (for crowd timing)

**Environmental quality**:
- `landuse=forest` → Tree cover
- `natural=tree_row` → Street trees
- `leisure=garden` → Gardens

### Implementation

**File**: `/src/lib/osm-analyzer.ts`

**Modify `analyzeNearbyPOIs()` query** (line 15):
- Current: Single query for 6 feature types
- New: Compound query for 20+ feature types in one request (stays within Overpass rate limit)
- Timeout: Increase from 25s → 30s
- Keep 3km radius default, use 5km for routes >15km

**Extend `parseOSMFeatures()` function** (line 36):
- Add parsing for node elements (fountains, lamps, hospitals are nodes, not ways)
- Determine new feature types: 'fountain', 'lighting', 'hospital', 'police', 'toilet', 'construction', 'school', 'worship', 'green-cover'
- Extract metadata: `isLit` for roads, `greenCoverDensity` for areas

**Type updates**: `/src/types/route-optimizer.ts`

```typescript
export interface OSMFeature {
  id: string;
  type: 'park' | 'trail' | 'track' | 'waterfront' | 'water' | 'safe-road' 
    | 'fountain' | 'lighting' | 'hospital' | 'police' | 'toilet' 
    | 'construction' | 'school' | 'worship' | 'green-cover';
  name: string;
  location: [number, number];
  coordinates?: [number, number][];
  perimeter?: number;
  length?: number;
  shouldAvoid?: boolean;
  isLit?: boolean;
  greenCoverDensity?: number;
}

export interface SafetyMetrics {
  waterAccessScore: number; // 0-100: proximity to drinking water
  lightingScore: number; // 0-100: % of route with street lighting
  emergencyAccessScore: number; // 0-100: proximity to hospitals/police
  greenCoverScore: number; // 0-100: % of route with tree canopy
  hazardPenalty: number; // 0-50: construction zones, traffic
}
```

**New scoring logic**: `/src/lib/route-metrics.ts`

**Add `calculateSafetyMetrics()` function**:
```typescript
function calculateSafetyMetrics(
  route: RouteData,
  osmFeatures: OSMFeature[],
  timeOfDay?: number // 0-23 for lighting importance
): SafetyMetrics {
  // Sample every 10th route point for performance
  
  // Lighting: Check if within 50m of lit road or street lamp
  // Time-of-day multiplier: 2x weight if 18-22 or 5-7 (dawn/dusk)
  
  // Water access: For routes >10km, require fountain every 5km
  // Score = 100 - (gaps > 5km × 20 penalty)
  
  // Emergency access: Bonus if hospital/police within 1km of any segment
  
  // Green cover: Segments within 30m of forest/garden/tree_row
  
  // Hazards: Penalty for construction zones, missing traffic signals at crossings
}
```

**Update `calculateRouteMetrics()` signature** (line 6):
- Add `osmFeatures: OSMFeature[]` parameter
- Add `timeOfDay?: number` parameter
- Call `calculateSafetyMetrics()`

**Rebalance scoring weights**:
```typescript
const overallScore =
  0.25 * distanceScore +           // Reduced from 35%
  0.20 * turnScore +               // Reduced from 30%
  0.15 * surfaceScore +            // Reduced from 20%
  0.10 * scenicScore +             // Reduced from 15%
  0.15 * safetyMetrics.lightingScore +      // NEW
  0.10 * safetyMetrics.waterAccessScore +   // NEW
  0.05 * safetyMetrics.greenCoverScore +    // NEW
  - (heatPenalty * 0.15) -         // Reduced from 0.2
  - (waterPenalty * 0.4) -         // Reduced from 0.5
  - (safetyMetrics.hazardPenalty * 0.3); // NEW
```

**Update route handler**: `/src/app/api/route/generate/route.ts`
- Pass `osmFeatures` to `calculateRouteMetrics()` (currently only passes water features)
- Pass `timeOfDay` from request (add to `GenerateRouteRequest` type)

**Update types**: `/src/types/api.ts`
```typescript
export interface GenerateRouteRequest {
  distanceKm: number;
  routeType: 'loop' | 'point-to-point';
  startCoord: [number, number];
  cityPreference: 'stay-in-city' | 'can-leave-city';
  timeOfDay?: number; // NEW: 0-23 hour for lighting importance
}

export interface GenerateRouteResponse {
  success: true;
  data: RouteData;
  metrics: RouteMetrics & { safetyMetrics: SafetyMetrics }; // NEW
  strategyUsed: string;
}
```

**Frontend**: `/src/components/RouteStats.tsx`
- Add "Safety Score" card displaying lighting, water access, green cover
- Add badges with icons: 💡 Lighting, 💧 Water, 🌳 Green Cover
- Show warnings if hazardPenalty > 10

### Error Handling
- Overpass query fails → return empty array, routes still generate with neutral safety scores (50)
- Timeout → log warning, continue with existing data
- Rate limit (180/hr) → mitigated by Phase 4 caching

---

## Phase 2: Add WAQI (AQI) + OpenUV (UV) + Windy (Wind Direction)

**Goal**: Add India-specific environmental data via free APIs.

### 2.1 WAQI Integration (World Air Quality Index)

**API**: `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${TOKEN}`
**Cost**: FREE, unlimited (public API)
**Why**: Uses CPCB (India official) data, more accurate than OpenWeatherMap for NCR

**New file**: `/src/lib/waqi.ts`

```typescript
const WAQI_BASE_URL = 'https://api.waqi.info';
const WAQI_TOKEN = process.env.WAQI_API_TOKEN!;

export interface WAQIData {
  aqi: number; // 0-500 (US EPA scale)
  dominantPollutant: string;
  pm25: number;
  pm10: number;
  station: string;
  timestamp: string;
}

export async function fetchWAQI(lat: number, lng: number): Promise<WAQIData | null> {
  // Fetch, parse, return null on failure (non-critical)
}
```

**Scoring logic**:
- 0-50: Good (no penalty)
- 51-100: Moderate (-10)
- 101-150: Unhealthy for sensitive (-20)
- 151-200: Unhealthy (-30)
- 201+: Very Unhealthy (-50 + suggest indoor workout)

**Integration**: `/src/lib/weather.ts`
- Replace `fetchAQI()` with `fetchWAQI()` for India locations (check `isNCRLocation()`)
- Keep OpenWeatherMap AQI as fallback for non-India

### 2.2 OpenUV Integration

**API**: `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lng}`
**Cost**: FREE tier - 1000 req/day (50 req/hr)
**Why**: Critical for Indian summers (UV regularly >10)

**New file**: `/src/lib/openuv.ts`

```typescript
const OPENUV_BASE_URL = 'https://api.openuv.io/api/v1';
const OPENUV_API_KEY = process.env.OPENUV_API_KEY!;

export interface UVData {
  uv: number; // Current UV index
  uvMax: number; // Max expected today
  uvMaxTime: string; // When UV peaks
  safeExposureTime: number; // Minutes until sunburn
}

export async function fetchUV(lat: number, lng: number): Promise<UVData | null> {
  // Fetch with x-access-token header
}
```

**Scoring logic**:
- UV <3: No penalty
- UV 3-5: -5
- UV 6-7: -10
- UV 8-10: -20
- UV 11+: -30 + warning "Apply sunscreen, avoid midday"

**Rate limit handling**:
- Cache UV for 1 hour (Phase 4)
- If 429, fallback: Estimate UV from time of day (peak at solar noon)

### 2.3 Windy API Integration

**API**: `https://api.windy.com/api/point-forecast/v2`
**Cost**: FREE tier available (500 req/day)
**Why**: Wind direction matters for runners (headwind on return is brutal)

**New file**: `/src/lib/windy.ts`

```typescript
const WINDY_API_KEY = process.env.WINDY_API_KEY!;

export interface WindData {
  speed: number; // m/s
  direction: number; // degrees (0-360)
  gusts: number; // m/s
  timestamp: string;
}

export async function fetchWind(lat: number, lng: number): Promise<WindData | null> {
  // Fetch hourly wind forecast
}
```

**Integration**:
- Add to weather advice API: `/src/app/api/weather/advice/route.ts`
- Calculate wind score for route: Compare wind direction to route bearing
  - Headwind (180° opposite): -10 score
  - Tailwind (same direction): +5 score
  - Crosswind: 0 penalty
- Show wind direction arrow on map overlay (frontend)

**Rate limit**: 500/day → Cache for 30 minutes

### Integration into Weather Advice

**Modify**: `/src/app/api/weather/advice/route.ts`

```typescript
const [current, hourlyForecast, aqiData, uvData, windData] = await Promise.all([
  fetchCurrentWeather(lat, lng),
  fetchHourlyForecast(lat, lng, timeRangeHours),
  isNCRLocation(lat, lng) ? fetchWAQI(lat, lng) : fetchAQI(lat, lng), // NEW
  fetchUV(lat, lng), // NEW
  fetchWind(lat, lng), // NEW
]);

const recommendations = generateStartTimeRecommendations(
  enrichedHourly,
  isNCR,
  uvData, // NEW
  windData // NEW
);
```

### Environment Setup

**Update**: `.env.example`
```bash
WAQI_API_TOKEN=your_waqi_token_here  # Get from: https://aqicn.org/api/
OPENUV_API_KEY=your_openuv_key_here # Get from: https://www.openuv.io/
WINDY_API_KEY=your_windy_key_here   # Get from: https://api.windy.com/
```

### Frontend Updates

**Component**: `/src/components/WeatherAdvice.tsx`
- Add UV Index card with sunburn warning
- Add Wind Direction indicator (arrow showing headwind/tailwind)
- Update AQI display to show PM2.5/PM10 breakdown (from WAQI)

### Error Handling
- WAQI fails → Fall back to OpenWeatherMap AQI
- OpenUV fails → Estimate UV from time (solar noon = peak)
- Windy fails → Skip wind scoring, still show route
- All failures → Weather advice still works, just less detailed

---

## Phase 3: Elevation via OpenTopoData (Backup for ORS)

**Goal**: Add free elevation API as fallback when ORS elevation data is missing.

**API**: `https://api.opentopodata.org/v1/mapzen?locations=${lat},${lng}`
**Cost**: FREE, unlimited, no API key
**Why**: ORS sometimes lacks elevation in India; OpenTopoData fills gaps

**New file**: `/src/lib/opentopo.ts`

```typescript
const OPENTOPO_BASE_URL = 'https://api.opentopodata.org/v1/mapzen';

export async function fetchElevationProfile(
  coordinates: [number, number][]
): Promise<number[]> {
  // OpenTopoData accepts batches of up to 100 locations
  const sampleRate = Math.ceil(coordinates.length / 100);
  const sampledCoords = coordinates.filter((_, i) => i % sampleRate === 0);
  
  const locations = sampledCoords.map(([lng, lat]) => `${lat},${lng}`).join('|');
  
  const response = await fetch(`${OPENTOPO_BASE_URL}?locations=${locations}`);
  const data = await response.json();
  return data.results.map((r: any) => r.elevation);
}

export function calculateHillinessScore(elevations: number[]): number {
  // Sum of absolute elevation changes
  let totalChange = 0;
  for (let i = 1; i < elevations.length; i++) {
    totalChange += Math.abs(elevations[i] - elevations[i - 1]);
  }
  // Normalize to 0-100 (100 = very hilly)
  return Math.min(100, totalChange / 10);
}
```

**Integration**: `/src/app/api/route/generate/route.ts`
- After ORS call, check if `route.elevationGain === 0` (missing data)
- If missing, call `fetchElevationProfile()` as fallback
- Calculate elevation gain from OpenTopoData result
- Add `hilliness` score to RouteMetrics

**Type update**: `/src/types/route-optimizer.ts`
```typescript
export interface RouteMetrics {
  // ...existing fields
  hilliness?: number; // NEW: 0-100, from OpenTopoData
}
```

**Frontend**: Display hilliness badge if available (🏔️ icon)

---

## Phase 4: Advanced India-Specific Features + Performance

**Goal**: Optimize performance via caching, add unique India-aware features.

### 4.1 Caching Layer (Critical for Performance)

**Problem**: Multiple API calls per route = slow, rate-limit prone

**Solution**: In-memory cache with TTL

**New file**: `/src/lib/cache.ts`

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMinutes: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMinutes * 60 * 1000,
  });
}

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
};
```

**TTL Strategy**:
- OSM data: 24 hours (infrastructure doesn't change daily)
- WAQI: 30 minutes (AQI updates frequently)
- UV: 1 hour (changes gradually)
- Wind: 30 minutes (weather pattern)
- Weather: 10 minutes (existing pattern)

**Apply caching**:
- Wrap all API fetch functions with `getCached()` / `setCache()`
- Expected cache hit rate: >70% after warmup
- Expected performance: Route generation <3 seconds (down from 5s)

### 4.2 Post-Rain Surface Warnings

**Logic**:
- Check OpenWeatherMap for rainfall in past 24 hours
- If `rain.1h > 2mm` OR `rain.3h > 5mm`:
  - Penalize unpaved surfaces (gravel, dirt, grass) by -20 score
  - Add warning: "Recent rainfall - unpaved paths may be muddy"

**Implementation**: `/src/lib/route-metrics.ts`
- Add `recentRain?: number` parameter to `calculateRouteMetrics()`
- Apply penalty if rain detected AND route.surfaceScore < 70 (unpaved)

**Update**: `/src/lib/weather.ts`
- Extend `fetchCurrentWeather()` to include `rain` field (already in API, just parse it)

### 4.3 Heat Island Detection (Park Routes vs Concrete)

**Logic**:
- Compare route segments: `landuse=residential` vs `landuse=forest/park`
- Urban heat island effect: Residential areas are 2-5°C hotter
- If heatIndex > 35°C:
  - Boost score for routes through parks by +10
  - Add badge: "Route optimized for shade"

**Implementation**: `/src/lib/route-metrics.ts`
- In `calculateSafetyMetrics()`, calculate park ratio: `parkSegments / totalSegments`
- If heat index >35 AND parkRatio >0.5: Apply +10 bonus
- Add to RouteData: `isHeatOptimized?: boolean`

### 4.4 School/Worship Timing Awareness

**Logic**:
- OSM data already has schools and places of worship (Phase 1)
- If route passes within 200m of school:
  - Check if `timeOfDay` is 7-9 AM or 1-4 PM (rush hours)
  - Apply -15 penalty (traffic congestion)
- If route passes within 100m of worship place:
  - Check if Friday 12-2 PM (mosque), Sunday 9-11 AM (church), Tuesday/Saturday evening (temple)
  - Apply -10 penalty (crowd surge)

**Implementation**: `/src/lib/route-metrics.ts`
- In `calculateSafetyMetrics()`, add `timingPenalty` calculation
- Check proximity to schools/worship + time-of-day logic
- Add to hazardPenalty

### 4.5 Water Point Planner (Long Runs 15km+)

**Logic**:
- For routes >15km, show all drinking fountains on map
- Calculate expected water needs: `distanceKm × 150ml` (conservative for heat)
- If no fountain within 5km segment, show warning

**Frontend**: New component `/src/components/WaterPointMap.tsx`
- Display mini-map with fountain markers along route
- Show distance to next fountain
- Integrate into RouteStats component

**Backend**: `/src/app/api/route/generate/route.ts`
- Filter `osmFeatures` for type='fountain'
- Return as separate array in response: `waterPoints: OSMFeature[]`

**Type update**: `/src/types/api.ts`
```typescript
export interface GenerateRouteResponse {
  success: true;
  data: RouteData;
  metrics: RouteMetrics;
  strategyUsed: string;
  waterPoints?: OSMFeature[]; // NEW: For 15km+ routes
}
```

---

## Final Scoring Formula Evolution

### Current (Before Implementation)
```
Score = 0.35×Distance + 0.30×Turns + 0.20×Surface + 0.15×Scenic 
        - 0.2×Heat - 0.5×WaterHazard
```

### After Phase 1 (Safety Focus)
```
Score = 0.25×Distance + 0.20×Turns + 0.15×Surface + 0.10×Scenic 
        + 0.15×Lighting + 0.10×WaterAccess + 0.05×GreenCover
        - 0.15×Heat - 0.4×WaterHazard - 0.3×Hazards
```

### After Phase 2 (Environment Aware)
```
Score = [Phase 1 formula]
        - 0.1×AQI - 0.05×UV - 0.05×HeadwindPenalty
```

### Final (Phase 4 - India Optimized)
```
Score = [Phase 2 formula]
        + 0.05×HeatIslandBonus - 0.1×PostRainPenalty - 0.1×TimingPenalty
```

---

## Critical Files to Modify

### Phase 1
1. [src/lib/osm-analyzer.ts](src/lib/osm-analyzer.ts) - Extend query, parse new types
2. [src/types/route-optimizer.ts](src/types/route-optimizer.ts) - Add SafetyMetrics, extend OSMFeature
3. [src/lib/route-metrics.ts](src/lib/route-metrics.ts) - Add calculateSafetyMetrics(), rebalance weights
4. [src/app/api/route/generate/route.ts](src/app/api/route/generate/route.ts) - Pass osmFeatures to metrics
5. [src/types/api.ts](src/types/api.ts) - Add timeOfDay to GenerateRouteRequest
6. [src/components/RouteStats.tsx](src/components/RouteStats.tsx) - Display safety scores

### Phase 2
1. **NEW** [src/lib/waqi.ts](src/lib/waqi.ts) - WAQI API client
2. **NEW** [src/lib/openuv.ts](src/lib/openuv.ts) - OpenUV API client
3. **NEW** [src/lib/windy.ts](src/lib/windy.ts) - Windy API client
4. [src/lib/weather.ts](src/lib/weather.ts) - Integrate WAQI, UV, wind
5. [src/app/api/weather/advice/route.ts](src/app/api/weather/advice/route.ts) - Orchestrate new APIs
6. [src/types/weather.ts](src/types/weather.ts) - Add UV, Wind types
7. [src/components/WeatherAdvice.tsx](src/components/WeatherAdvice.tsx) - Display UV, wind
8. [.env.example](.env.example) - Add new API keys

### Phase 3
1. **NEW** [src/lib/opentopo.ts](src/lib/opentopo.ts) - OpenTopoData client
2. [src/lib/route-metrics.ts](src/lib/route-metrics.ts) - Calculate hilliness
3. [src/app/api/route/generate/route.ts](src/app/api/route/generate/route.ts) - Fallback elevation

### Phase 4
1. **NEW** [src/lib/cache.ts](src/lib/cache.ts) - In-memory caching
2. [src/lib/osm-analyzer.ts](src/lib/osm-analyzer.ts) - Apply caching
3. [src/lib/waqi.ts](src/lib/waqi.ts) - Apply caching
4. [src/lib/openuv.ts](src/lib/openuv.ts) - Apply caching
5. [src/lib/windy.ts](src/lib/windy.ts) - Apply caching
6. [src/lib/weather.ts](src/lib/weather.ts) - Post-rain logic, apply caching
7. [src/lib/route-metrics.ts](src/lib/route-metrics.ts) - Heat island, timing penalties
8. **NEW** [src/components/WaterPointMap.tsx](src/components/WaterPointMap.tsx) - Water fountain UI

---

## Verification Strategy

### Phase 1 Testing
- Generate route in Delhi NCR at 8 PM (lighting should be high priority)
- Verify safety scores appear in RouteStats component
- Check OSM query returns fountains, lighting, hospitals
- Confirm scoring weights rebalanced (lighting gets 15%)

### Phase 2 Testing
- Test WAQI in Delhi winter (high AQI scenario)
- Verify UV warning appears when UV >8
- Check wind direction arrow on map
- Confirm fallback to OpenWeatherMap AQI if WAQI fails

### Phase 3 Testing
- Generate route in hilly area (Shimla, Ooty)
- Verify hilliness score appears if ORS elevation missing
- Test OpenTopoData fallback logic

### Phase 4 Testing
- Generate same route twice, verify cache hit on second request
- Test post-rain warning with simulated rainfall data
- Generate 15km route, verify water point map displays
- Check school timing penalty applies during 8 AM request

### End-to-End Scenarios
1. **Delhi NCR, Summer, 10km Loop, 7 AM**
   - Expected: High lighting score, water points, AQI warning, UV caution, school timing penalty
   
2. **Bangalore, Monsoon, 5km Trail**
   - Expected: Post-rain warnings, high green cover score, lower UV

3. **Mumbai, Evening, 15km Coastal**
   - Expected: UV bonus (evening), water point map, wind direction (sea breeze)

4. **Night Run (10 PM)**
   - Expected: Lighting score weighted 2x, prefer lit roads, no UV/AQI penalties

### Performance Benchmarks
- Route generation: <3 seconds (target with caching)
- Overpass query: <3 seconds
- WAQI/UV/Wind combined: <1 second
- Cache hit rate: >70% after warmup

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Overpass rate limit (180/hr) | Cache OSM data for 24h, use 3km radius default |
| OpenUV daily limit (1000) | Cache for 1h, fallback to time-based UV estimate |
| Windy rate limit (500/day) | Cache for 30min, skip wind if limit hit (non-critical) |
| WAQI API changes | Keep OWM AQI as fallback, fail silently |
| Too many API calls = slow | Implement Phase 4 caching early |
| User confusion with metrics | Add tooltips, clear labeling in UI |

---

## Implementation Sequence

### Week 1: Phase 1 (Overpass Extension)
- Day 1-2: Update OSM query, extend parser
- Day 3-4: Add calculateSafetyMetrics(), rebalance scoring
- Day 5: Frontend safety score cards
- Day 6-7: Testing with Delhi/Bangalore data

### Week 2: Phase 2 (WAQI + UV + Wind)
- Day 1-2: Create waqi.ts, openuv.ts, windy.ts clients
- Day 3-4: Integrate into weather.ts and weather/advice route
- Day 5-6: Frontend UV/wind display
- Day 7: Get API keys, test with real data

### Week 3: Phase 3 (Elevation)
- Day 1-2: Create opentopo.ts, add fallback logic
- Day 3: Test with hilly routes
- Day 4-7: Start Phase 4 (caching implementation)

### Week 4: Phase 4 (Advanced Features)
- Day 1-3: Implement cache.ts, apply to all APIs
- Day 4-5: Post-rain, heat island, timing awareness logic
- Day 6: Water point map component
- Day 7: End-to-end testing, performance benchmarking

---

## Success Criteria

**Quantitative**:
- Route generation time: <3s with caching (currently ~5s)
- Safety score coverage: >80% of routes have lighting/water data
- Cache hit rate: >70% after warmup
- AQI accuracy: WAQI within ±10 of CPCB stations

**Qualitative**:
- Users feel safer with lit routes (future feedback loop)
- Reduced heat-related incidents via heat island optimization
- Positive sentiment around India-specific features (school/worship timing)
