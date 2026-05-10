import { bearing as turfBearing, distance as turfDistance } from '@turf/turf';
import { point } from '@turf/helpers';
import { RouteData } from '@/types/route';
import { RouteMetrics, OSMFeature } from '@/types/route-optimizer';

export function calculateRouteMetrics(
  route: RouteData,
  targetDistanceKm: number,
  heatIndex?: number,
  waterFeatures: OSMFeature[] = []
): RouteMetrics {
  const distanceAccuracy = calculateDistanceAccuracy(
    route.distanceKm,
    targetDistanceKm
  );

  const turnCount = countSignificantTurns(route.coordinates);
  const elevationGain = route.elevationGain;
  const scenicScore = 50; // TODO: Calculate from waytype data

  // Heat index penalty (0-30 points penalty based on severity)
  let heatPenalty = 0;
  if (heatIndex) {
    if (heatIndex > 40) heatPenalty = 30; // Extreme heat
    else if (heatIndex > 35) heatPenalty = 20; // High heat
    else if (heatIndex > 30) heatPenalty = 10; // Warm conditions
  }

  // Water proximity penalty (0-40 points)
  const waterPenalty = calculateWaterProximityPenalty(
    route.coordinates,
    waterFeatures
  );

  // Rebalanced scoring weights
  const distanceScore = Math.max(0, 100 - distanceAccuracy);
  const turnScore = Math.max(0, 100 - turnCount * 3); // Reduced from 5 to 3
  const surfaceScore = route.surfaceScore;

  const overallScore =
    0.35 * distanceScore +      // Increased from 0.3
    0.30 * turnScore +          // Decreased from 0.5
    0.20 * surfaceScore +       // Increased from 0.15
    0.15 * scenicScore -        // Increased from 0.05
    (heatPenalty * 0.2) -       // Reduced weight
    (waterPenalty * 0.5);       // HIGH penalty for water proximity

  return {
    distanceKm: route.distanceKm,
    targetDistanceKm,
    distanceAccuracy,
    turnCount,
    surfaceScore: route.surfaceScore,
    elevationGain,
    scenicScore,
    heatIndex,
    waterProximity: waterPenalty,
    overallScore: Math.max(0, Math.min(100, Math.round(overallScore))),
  };
}

function calculateDistanceAccuracy(
  actualKm: number,
  targetKm: number
): number {
  return Math.abs(actualKm - targetKm) / targetKm * 100;
}

function countSignificantTurns(
  coordinates: [number, number][],
  angleThreshold: number = 60 // Increased from 45° - only count sharper turns
): number {
  if (coordinates.length < 3) return 0;

  let turnCount = 0;
  const sampleRate = Math.max(1, Math.floor(coordinates.length / 50)); // Sample every Nth point

  for (let i = sampleRate; i < coordinates.length - sampleRate; i += sampleRate) {
    const prev = coordinates[i - sampleRate];
    const current = coordinates[i];
    const next = coordinates[i + sampleRate];

    const bearing1 = turfBearing(point(prev), point(current));
    const bearing2 = turfBearing(point(current), point(next));

    let angleDiff = Math.abs(bearing2 - bearing1);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    if (angleDiff > angleThreshold) {
      turnCount++;
    }
  }

  return turnCount;
}

/**
 * Calculate penalty for routes that get close to water bodies
 */
function calculateWaterProximityPenalty(
  routeCoords: [number, number][],
  waterFeatures: OSMFeature[]
): number {
  if (waterFeatures.length === 0) return 0;

  let penalty = 0;
  const dangerThreshold = 0.05; // 50 meters (in km)
  const warningThreshold = 0.2; // 200 meters (in km)

  // Sample route points (every 10th to avoid performance issues)
  const sampleRate = Math.max(1, Math.floor(routeCoords.length / 50));

  for (let i = 0; i < routeCoords.length; i += sampleRate) {
    const routePoint = routeCoords[i];

    // Find closest water body
    const closestWaterDist = Math.min(
      ...waterFeatures
        .filter((f) => f.type === 'water' && f.location)
        .map((f) =>
          turfDistance(point(routePoint), point(f.location), {
            units: 'kilometers',
          })
        )
    );

    if (closestWaterDist < dangerThreshold) {
      penalty += 10; // Major penalty for very close proximity
    } else if (closestWaterDist < warningThreshold) {
      penalty += 3; // Minor penalty for nearby water
    }
  }

  return Math.min(40, penalty); // Cap at 40 points
}
