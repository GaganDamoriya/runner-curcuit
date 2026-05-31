import { distance as turfDistance } from '@turf/distance';
import { point } from '@turf/helpers';
import { OSMFeature, OSMOverpassResponse } from '@/types/route-optimizer';
import { getCached, setCache, cacheKeys, CACHE_TTL } from './cache';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

export async function analyzeNearbyPOIs(
  startCoord: [number, number],
  radiusKm: number = 3
): Promise<OSMFeature[]> {
  const [lng, lat] = startCoord;
  const radiusMeters = radiusKm * 1000;

  // Check cache first (Phase 4)
  const cacheKey = cacheKeys.osm(lat, lng, radiusKm);
  const cached = getCached<OSMFeature[]>(cacheKey);
  if (cached) {
    console.log(`[OSM] Cache hit for [${lat}, ${lng}], ${radiusKm}km radius`);
    return cached;
  }

  // Overpass QL query for running-friendly POIs + water bodies to avoid + safety infrastructure
  const query = `[out:json][timeout:30];(
    way["leisure"="park"](around:${radiusMeters},${lat},${lng});
    way["highway"~"path|footway|track|cycleway"](around:${radiusMeters},${lat},${lng});
    way["natural"="water"](around:${radiusMeters},${lat},${lng});
    way["waterway"](around:${radiusMeters},${lat},${lng});
    relation["natural"="water"](around:${radiusMeters},${lat},${lng});
    way["highway"~"residential|pedestrian|living_street"]["motor_vehicle"!="yes"](around:${radiusMeters},${lat},${lng});
    node["amenity"="drinking_water"](around:${radiusMeters},${lat},${lng});
    way["lit"="yes"](around:${radiusMeters},${lat},${lng});
    node["highway"="street_lamp"](around:${radiusMeters},${lat},${lng});
    node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
    node["amenity"="police"](around:${radiusMeters},${lat},${lng});
    node["amenity"="toilets"](around:${radiusMeters},${lat},${lng});
    way["landuse"="construction"](around:${radiusMeters},${lat},${lng});
    node["highway"="traffic_signals"](around:${radiusMeters},${lat},${lng});
    node["highway"="crossing"](around:${radiusMeters},${lat},${lng});
    node["amenity"="school"](around:${radiusMeters},${lat},${lng});
    node["amenity"="place_of_worship"](around:${radiusMeters},${lat},${lng});
    way["landuse"="forest"](around:${radiusMeters},${lat},${lng});
    way["natural"="tree_row"](around:${radiusMeters},${lat},${lng});
    way["leisure"="garden"](around:${radiusMeters},${lat},${lng});
  );out geom;`;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      body: query,
    });

    if (!response.ok) {
      console.error('Overpass API error:', response.status, await response.text());
      return [];
    }

    const data: OSMOverpassResponse = await response.json();
    const features = parseOSMFeatures(data);

    // Cache the result (Phase 4)
    setCache(cacheKey, features, CACHE_TTL.OSM);

    return features;
  } catch (error) {
    console.error('OSM query failed:', error);
    return []; // Graceful fallback - will use geometric patterns
  }
}

function parseOSMFeatures(data: OSMOverpassResponse): OSMFeature[] {
  const features: OSMFeature[] = [];

  for (const element of data.elements) {
    if (!element.geometry || element.geometry.length === 0) continue;

    const isNode = element.type === 'node' || element.geometry.length === 1;

    // Handle both nodes (single point) and ways (multiple points)
    const coords: [number, number][] = element.geometry.map((g) => [
      g.lon,
      g.lat,
    ]);

    const name = element.tags?.name || 'Unnamed';
    const center = isNode
      ? { lat: element.geometry[0].lat, lon: element.geometry[0].lon }
      : element.center || {
          lat: coords[0][1],
          lon: coords[0][0],
        };

    const location: [number, number] = [center.lon, center.lat];

    // Determine feature type and calculate relevant metrics
    let type: OSMFeature['type'] = 'trail';
    let perimeter: number | undefined;
    let length: number | undefined;
    let shouldAvoid = false;
    let isLit: boolean | undefined;
    let greenCoverDensity: number | undefined;

    // Safety infrastructure (nodes)
    if (element.tags?.amenity === 'drinking_water') {
      type = 'fountain';
    } else if (element.tags?.highway === 'street_lamp') {
      type = 'lighting';
    } else if (element.tags?.amenity === 'hospital') {
      type = 'hospital';
    } else if (element.tags?.amenity === 'police') {
      type = 'police';
    } else if (element.tags?.amenity === 'toilets') {
      type = 'toilet';
    } else if (element.tags?.amenity === 'school') {
      type = 'school';
    } else if (element.tags?.amenity === 'place_of_worship') {
      type = 'worship';
    } else if (element.tags?.highway === 'traffic_signals') {
      type = 'safe-road'; // Traffic signals indicate safer crossings
    } else if (element.tags?.highway === 'crossing') {
      type = 'safe-road'; // Pedestrian crossings
    }
    // Existing park/trail/water logic (ways)
    else if (element.tags?.leisure === 'park') {
      type = 'park';
      perimeter = calculatePerimeter(coords);
    } else if (element.tags?.sport === 'running') {
      type = 'track';
      length = calculateLength(coords);
    } else if (
      element.tags?.natural === 'water' ||
      element.tags?.waterway ||
      (element.type === 'relation' && element.tags?.natural === 'water')
    ) {
      type = 'water';
      perimeter = calculatePerimeter(coords);
      shouldAvoid = true; // Mark water bodies for avoidance
    } else if (element.tags?.landuse === 'construction') {
      type = 'construction';
      perimeter = calculatePerimeter(coords);
      shouldAvoid = true; // Avoid construction zones
    }
    // Green cover (ways)
    else if (
      element.tags?.landuse === 'forest' ||
      element.tags?.natural === 'tree_row' ||
      element.tags?.leisure === 'garden'
    ) {
      type = 'green-cover';
      length = calculateLength(coords);
      greenCoverDensity = 100; // Full green coverage
    }
    // Lit roads (ways)
    else if (element.tags?.lit === 'yes') {
      type = 'safe-road';
      length = calculateLength(coords);
      isLit = true;
    } else if (
      element.tags?.highway &&
      ['residential', 'pedestrian', 'living_street'].includes(
        element.tags.highway
      ) &&
      element.tags?.motor_vehicle !== 'yes'
    ) {
      type = 'safe-road';
      length = calculateLength(coords);
      isLit = element.tags?.lit === 'yes';
    } else if (
      element.tags?.highway &&
      ['path', 'footway', 'track', 'cycleway'].includes(element.tags.highway)
    ) {
      type = 'trail';
      length = calculateLength(coords);
    }

    features.push({
      id: `osm-${element.id}`,
      type,
      name,
      location,
      coordinates: isNode ? undefined : coords,
      perimeter,
      length,
      shouldAvoid,
      isLit,
      greenCoverDensity,
    });
  }

  return features;
}

function calculatePerimeter(coords: [number, number][]): number {
  let perimeter = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    perimeter += turfDistance(point(coords[i]), point(coords[i + 1]), {
      units: 'kilometers',
    });
  }
  // Close the loop
  perimeter += turfDistance(
    point(coords[coords.length - 1]),
    point(coords[0]),
    { units: 'kilometers' }
  );
  return perimeter;
}

function calculateLength(coords: [number, number][]): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    length += turfDistance(point(coords[i]), point(coords[i + 1]), {
      units: 'kilometers',
    });
  }
  return length;
}
