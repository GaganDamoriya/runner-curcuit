import { bearing as turfBearing } from '@turf/turf';
import { point } from '@turf/helpers';
import { RouteData } from '@/types/route';
import { RouteMetrics } from '@/types/route-optimizer';

export function calculateRouteMetrics(
  route: RouteData,
  targetDistanceKm: number
): RouteMetrics {
  const distanceAccuracy = calculateDistanceAccuracy(
    route.distanceKm,
    targetDistanceKm
  );

  const turnCount = countSignificantTurns(route.coordinates);
  const elevationGain = 0; // TODO: Calculate from elevation data
  const scenicScore = 50; // TODO: Calculate from waytype data

  // Overall score weighted by importance - HEAVILY penalize turns!
  const distanceScore = Math.max(0, 100 - distanceAccuracy);
  const turnScore = Math.max(0, 100 - turnCount * 5); // Penalty: 5 points per turn (was 2)
  const surfaceScore = route.surfaceScore;

  const overallScore =
    0.3 * distanceScore +
    0.5 * turnScore +      // Increased from 0.3 to 0.5 - turns now MOST important!
    0.15 * surfaceScore +  // Decreased from 0.2
    0.05 * scenicScore;    // Decreased from 0.1

  return {
    distanceKm: route.distanceKm,
    targetDistanceKm,
    distanceAccuracy,
    turnCount,
    surfaceScore: route.surfaceScore,
    elevationGain,
    scenicScore,
    overallScore: Math.round(overallScore),
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
