import { distance as turfDistance, bearing as turfBearing, destination } from '@turf/turf';
import { point } from '@turf/helpers';
import { WaypointStrategy, RouteCandidate } from '@/types/route-optimizer';
import { calculateSurfaceScore } from './ors';
import { calculateRouteMetrics } from './route-metrics';
import { RouteData } from '@/types/route';

export async function refineRoute(
  strategy: WaypointStrategy,
  targetDistanceKm: number,
  maxAttempts: number = 3
): Promise<RouteCandidate | null> {
  let currentWaypoints = strategy.waypoints;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // Test current waypoints with ORS
      const orsResponse = await callORSWithWaypoints(currentWaypoints);

      if (!orsResponse) {
        attempt++;
        continue;
      }

      const feature = orsResponse.features[0];
      const actualDistance = feature.properties.summary.distance;
      const duration = feature.properties.summary.duration;
      const surfaceData = feature.properties.extras?.surface;

      // Check if within acceptable range (±10%)
      const distanceError = Math.abs(actualDistance - targetDistanceKm) / targetDistanceKm;

      if (distanceError <= 0.10) {
        // SUCCESS! Build route candidate
        const route: RouteData = {
          geojson: feature.geometry,
          distanceKm: actualDistance,
          durationMin: duration / 60,
          surfaceScore: calculateSurfaceScore(surfaceData),
          coordinates: feature.geometry.coordinates as [number, number][],
        };

        const metrics = calculateRouteMetrics(route, targetDistanceKm);

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
      currentWaypoints = scaleWaypoints(currentWaypoints, scaleFactor);

      attempt++;
    } catch {
      console.error(`Refinement attempt ${attempt + 1} failed`);
      attempt++;
    }
  }

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

async function callORSWithWaypoints(waypoints: [number, number][]) {
  const ORS_BASE_URL = 'https://api.openrouteservice.org';
  const ORS_API_KEY = process.env.ORS_API_KEY!;

  const requestBody = {
    coordinates: waypoints,
    preference: 'recommended',
    units: 'km',
    language: 'en',
    instructions: false,
    elevation: true,
    extra_info: ['surface', 'waytype', 'steepness'],
  };

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
      return null;
    }

    return response.json();
  } catch (error) {
    return null;
  }
}
