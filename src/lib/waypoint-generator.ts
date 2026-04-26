import { destination } from '@turf/turf';
import { point } from '@turf/helpers';
import { OSMFeature, WaypointStrategy } from '@/types/route-optimizer';
import { RoutePreferences } from '@/types/route';

export function generateWaypointStrategies(
  startCoord: [number, number],
  targetDistanceKm: number,
  osmFeatures: OSMFeature[],
  preferences: RoutePreferences
): WaypointStrategy[] {
  const strategies: WaypointStrategy[] = [];

  // Strategy 1: Park Loop (if park nearby)
  const nearbyPark = osmFeatures.find(
    (f) => f.type === 'park' && f.perimeter && f.perimeter > 0.5
  );
  if (nearbyPark && nearbyPark.perimeter) {
    strategies.push(generateParkLoopStrategy(startCoord, targetDistanceKm, nearbyPark));
  }

  // Strategy 2: Trail Out-and-Back (if trail nearby)
  const nearbyTrail = osmFeatures.find(
    (f) => (f.type === 'trail' || f.type === 'waterfront') && f.length && f.length > 1
  );
  if (nearbyTrail && nearbyTrail.coordinates) {
    strategies.push(generateTrailStrategy(startCoord, targetDistanceKm, nearbyTrail));
  }

  // Strategy 3: Neighborhood Circuit (always available as fallback)
  strategies.push(generateNeighborhoodCircuit(startCoord, targetDistanceKm));

  // Strategy 4: Spiral Pattern (urban exploration)
  if (preferences.cityPreference === 'stay-in-city') {
    strategies.push(generateSpiralPattern(startCoord, targetDistanceKm));
  }

  return strategies;
}

function generateParkLoopStrategy(
  startCoord: [number, number],
  targetDistanceKm: number,
  park: OSMFeature
): WaypointStrategy {
  const laps = Math.ceil(targetDistanceKm / park.perimeter!);
  const waypointsPerLap = 4;

  // Sample points around park perimeter
  const parkCoords = park.coordinates || [];
  const sampledWaypoints: [number, number][] = [startCoord];

  for (let lap = 0; lap < laps; lap++) {
    for (let i = 0; i < waypointsPerLap; i++) {
      const idx = Math.floor((i / waypointsPerLap) * parkCoords.length);
      if (parkCoords[idx]) {
        sampledWaypoints.push(parkCoords[idx]);
      }
    }
  }

  sampledWaypoints.push(startCoord); // Return to start

  return {
    name: 'Park Loop',
    description: `${laps} lap(s) around ${park.name}`,
    waypoints: sampledWaypoints,
    reasoning: `Park perimeter is ${park.perimeter?.toFixed(1)}km. Running ${laps} laps will approximate ${targetDistanceKm}km with minimal turns and scenic environment.`,
  };
}

function generateTrailStrategy(
  startCoord: [number, number],
  targetDistanceKm: number,
  trail: OSMFeature
): WaypointStrategy {
  const halfDistance = targetDistanceKm / 2;
  const trailCoords = trail.coordinates || [];

  // Follow trail for half distance, then return
  let accumulatedDist = 0;
  const outboundWaypoints: [number, number][] = [startCoord];

  for (let i = 0; i < trailCoords.length - 1 && accumulatedDist < halfDistance; i++) {
    outboundWaypoints.push(trailCoords[i]);
    accumulatedDist += 0.1; // Rough estimate
  }

  // Return same way (out-and-back)
  const waypoints = [...outboundWaypoints, ...outboundWaypoints.reverse()];

  return {
    name: 'Trail Out-and-Back',
    description: `Follow ${trail.name} and return`,
    waypoints,
    reasoning: `Trail offers scenic, low-traffic running. Out-and-back format minimizes navigation complexity and provides familiar return route.`,
  };
}

function generateNeighborhoodCircuit(
  startCoord: [number, number],
  targetDistanceKm: number
): WaypointStrategy {
  // Create a square/hexagon pattern around start point
  const radiusKm = targetDistanceKm / 4; // Rough approximation
  const waypoints: [number, number][] = [startCoord];

  // Hexagon pattern (6 sides = smoother than square)
  const angles = [0, 60, 120, 180, 240, 300];

  for (const angle of angles) {
    const wp = destination(point(startCoord), radiusKm, angle).geometry.coordinates as [number, number];
    waypoints.push(wp);
  }

  waypoints.push(startCoord); // Close loop

  return {
    name: 'Neighborhood Circuit',
    description: 'Hexagonal loop through local streets',
    waypoints,
    reasoning: `Hexagon pattern provides balanced route with ${angles.length} waypoints, reducing sharp turns while covering target distance through residential areas.`,
  };
}

function generateSpiralPattern(
  startCoord: [number, number],
  targetDistanceKm: number
): WaypointStrategy {
  const waypoints: [number, number][] = [startCoord];
  const spiralTurns = 6;
  let currentRadius = targetDistanceKm / (spiralTurns * 2);

  for (let turn = 0; turn < spiralTurns; turn++) {
    const angle = turn * 60; // 60° increments
    const wp = destination(point(startCoord), currentRadius, angle).geometry.coordinates as [number, number];
    waypoints.push(wp);
    currentRadius += targetDistanceKm / (spiralTurns * 3); // Gradually expand
  }

  waypoints.push(startCoord); // Return to start

  return {
    name: 'Spiral Explorer',
    description: 'Expanding spiral through neighborhood',
    waypoints,
    reasoning: `Spiral pattern allows exploration of surrounding area while maintaining general direction back to start. Good for discovering new routes.`,
  };
}
