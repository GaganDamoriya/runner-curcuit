import { distance as turfDistance } from '@turf/distance';
import { point } from '@turf/helpers';
import { OSMFeature, OSMOverpassResponse } from '@/types/route-optimizer';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

export async function analyzeNearbyPOIs(
  startCoord: [number, number],
  radiusKm: number = 3
): Promise<OSMFeature[]> {
  const [lng, lat] = startCoord;
  const radiusMeters = radiusKm * 1000;

  // Overpass QL query for running-friendly POIs + water bodies to avoid
  const query = `[out:json][timeout:25];(way["leisure"="park"](around:${radiusMeters},${lat},${lng});way["highway"~"path|footway|track|cycleway"](around:${radiusMeters},${lat},${lng});way["natural"="water"](around:${radiusMeters},${lat},${lng});way["waterway"](around:${radiusMeters},${lat},${lng});relation["natural"="water"](around:${radiusMeters},${lat},${lng});way["highway"~"residential|pedestrian|living_street"]["motor_vehicle"!="yes"](around:${radiusMeters},${lat},${lng}););out geom;`;

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
    return parseOSMFeatures(data);
  } catch (error) {
    console.error('OSM query failed:', error);
    return []; // Graceful fallback - will use geometric patterns
  }
}

function parseOSMFeatures(data: OSMOverpassResponse): OSMFeature[] {
  const features: OSMFeature[] = [];

  for (const element of data.elements) {
    if (!element.geometry || element.geometry.length < 3) continue;

    const coords: [number, number][] = element.geometry.map((g) => [
      g.lon,
      g.lat,
    ]);

    const name = element.tags?.name || 'Unnamed';
    const center =
      element.center || {
        lat: coords[0][1],
        lon: coords[0][0],
      };

    const location: [number, number] = [center.lon, center.lat];

    // Determine feature type and calculate relevant metrics
    let type: OSMFeature['type'] = 'trail';
    let perimeter: number | undefined;
    let length: number | undefined;
    let shouldAvoid = false;

    if (element.tags?.leisure === 'park') {
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
    } else if (
      element.tags?.highway &&
      ['residential', 'pedestrian', 'living_street'].includes(
        element.tags.highway
      ) &&
      element.tags?.motor_vehicle !== 'yes'
    ) {
      type = 'safe-road';
      length = calculateLength(coords);
    } else {
      type = 'trail';
      length = calculateLength(coords);
    }

    features.push({
      id: `osm-${element.id}`,
      type,
      name,
      location,
      coordinates: coords,
      perimeter,
      length,
      shouldAvoid,
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
