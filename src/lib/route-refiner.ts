import { distance as turfDistance, bearing as turfBearing, destination } from '@turf/turf';
import { point } from '@turf/helpers';
import { WaypointStrategy, RouteCandidate, OSMFeature } from '@/types/route-optimizer';
import { calculateSurfaceScore, calculateElevationMetrics } from './ors';
import { calculateRouteMetrics } from './route-metrics';
import { RouteData } from '@/types/route';

export async function refineRoute(
  strategy: WaypointStrategy,
  targetDistanceKm: number,
  maxAttempts: number = 6,
  waterFeatures: OSMFeature[] = []
): Promise<RouteCandidate | null> {
  let currentWaypoints = strategy.waypoints;
  let attempt = 0;

  // Create avoidance polygons from water bodies
  const avoidPolygons = createAvoidPolygons(waterFeatures);

  while (attempt < maxAttempts) {
    try {
      // Test current waypoints with ORS (with water avoidance)
      console.log(`  Attempt ${attempt + 1}: Testing ${currentWaypoints.length} waypoints...`);
      const orsResponse = await callORSWithWaypoints(currentWaypoints, avoidPolygons);

      if (!orsResponse) {
        console.log(`  Attempt ${attempt + 1}: ORS call failed, retrying...`);
        attempt++;
        continue;
      }

      const feature = orsResponse.features[0];
      const actualDistance = feature.properties.summary.distance;
      const duration = feature.properties.summary.duration;
      const surfaceData = feature.properties.extras?.surface;
      const elevationData = feature.properties.extras?.elevation;

      // Check if within acceptable range (±15% tolerance)
      const distanceError = Math.abs(actualDistance - targetDistanceKm) / targetDistanceKm;
      console.log(`  Attempt ${attempt + 1}: Got ${actualDistance.toFixed(2)}km (target: ${targetDistanceKm}km, error: ${(distanceError * 100).toFixed(1)}%)`);

      if (distanceError <= 0.15) {
        console.log(`  ✓ Success! Within ±10% tolerance`);

        // SUCCESS! Build route candidate
        const elevationMetrics = calculateElevationMetrics(elevationData);
        const route: RouteData = {
          geojson: feature.geometry,
          distanceKm: actualDistance,
          durationMin: duration / 60,
          surfaceScore: calculateSurfaceScore(surfaceData),
          coordinates: feature.geometry.coordinates as [number, number][],
          elevationGain: elevationMetrics.elevationGain,
          maxElevation: elevationMetrics.maxElevation,
          minElevation: elevationMetrics.minElevation,
        };

        const metrics = calculateRouteMetrics(route, targetDistanceKm, undefined, waterFeatures);

        return {
          strategy: {
            ...strategy,
            waypoints: currentWaypoints,
          },
          route,
          metrics,
        };
      }

      // Adjust waypoints based on distance error
      const scaleFactor = targetDistanceKm / actualDistance;
      console.log(`  Adjusting waypoints: scale factor ${scaleFactor.toFixed(2)}x`);
      currentWaypoints = scaleWaypoints(currentWaypoints, scaleFactor);

      attempt++;
    } catch (err) {
      console.error(`  Refinement attempt ${attempt + 1} failed:`, err);
      attempt++;
    }
  }

  console.log(`  ✗ Failed to converge after ${maxAttempts} attempts`);
  return null; // Failed to converge
}

function scaleWaypoints(
  waypoints: [number, number][],
  scaleFactor: number
): [number, number][] {
  if (waypoints.length < 2) return waypoints;

  const start = waypoints[0];
  const scaled: [number, number][] = [start];

  // Scale all waypoints relative to start point
  for (let i = 1; i < waypoints.length - 1; i++) {
    const wp = waypoints[i];

    // Calculate distance and bearing from start
    const dist = turfDistance(point(start), point(wp), { units: 'kilometers' });
    const angle = turfBearing(point(start), point(wp));

    // Scale the distance
    const newDist = dist * scaleFactor;

    // Calculate new waypoint at scaled distance
    const newWp = destination(point(start), newDist, angle).geometry.coordinates as [number, number];
    scaled.push(newWp);
  }

  // Last waypoint should return to start for loops
  if (waypoints[waypoints.length - 1][0] === start[0] &&
      waypoints[waypoints.length - 1][1] === start[1]) {
    scaled.push(start);
  } else {
    // For point-to-point, scale the endpoint too
    const lastWp = waypoints[waypoints.length - 1];
    const dist = turfDistance(point(start), point(lastWp), { units: 'kilometers' });
    const angle = turfBearing(point(start), point(lastWp));
    const newDist = dist * scaleFactor;
    const newWp = destination(point(start), newDist, angle).geometry.coordinates as [number, number];
    scaled.push(newWp);
  }

  return scaled;
}

async function callORSWithWaypoints(
  waypoints: [number, number][],
  avoidPolygons?: [number, number][][]
) {
  const ORS_BASE_URL = 'https://api.openrouteservice.org';
  const ORS_API_KEY = process.env.ORS_API_KEY!;

  const requestBody: {
    coordinates: [number, number][];
    preference: string;
    units: string;
    language: string;
    instructions: boolean;
    elevation: boolean;
    extra_info: string[];
    options?: {
      avoid_features?: string[];
      avoid_polygons?: {
        type: 'Polygon';
        coordinates: [number, number][][];
      };
    };
  } = {
    coordinates: waypoints,
    preference: 'recommended',
    units: 'km',
    language: 'en',
    instructions: false,
    elevation: true,
    extra_info: ['surface', 'waytype', 'steepness'],
  };

  // Add avoidance constraints if water bodies detected
  if (avoidPolygons && avoidPolygons.length > 0) {
    requestBody.options = {
      avoid_features: ['ferries'], // Don't cross water via ferry
      avoid_polygons: {
        type: 'Polygon',
        coordinates: avoidPolygons,
      },
    };
  }

  try {
    const response = await fetch(
      `${ORS_BASE_URL}/v2/directions/foot-walking/geojson`,
      {
        method: 'POST',
        headers: {
          Authorization: ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`    ORS API error ${response.status}:`, errorText.substring(0, 200));
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('    ORS fetch error:', error);
    return null;
  }
}

/**
 * Convert water features to avoid polygons for ORS API
 */
function createAvoidPolygons(waterFeatures: OSMFeature[]): [number, number][][] {
  return waterFeatures
    .filter((f) => f.type === 'water' && f.coordinates && f.coordinates.length >= 3)
    .map((f) => f.coordinates!);
}
