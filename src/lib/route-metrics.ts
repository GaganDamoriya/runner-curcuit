import { bearing as turfBearing, distance as turfDistance } from '@turf/turf';
import { point } from '@turf/helpers';
import { RouteData } from '@/types/route';
import { RouteMetrics, OSMFeature, SafetyMetrics } from '@/types/route-optimizer';

/**
 * Calculate safety metrics based on OSM features along the route
 */
function calculateSafetyMetrics(
  routeCoords: [number, number][],
  osmFeatures: OSMFeature[],
  distanceKm: number,
  timeOfDay?: number
): SafetyMetrics {
  // Sample route points for performance (every 10th point)
  const sampleRate = Math.max(1, Math.floor(routeCoords.length / 50));

  // Separate features by type
  const fountains = osmFeatures.filter((f) => f.type === 'fountain');
  const litRoads = osmFeatures.filter((f) => f.isLit === true);
  const streetLamps = osmFeatures.filter((f) => f.type === 'lighting');
  const hospitals = osmFeatures.filter((f) => f.type === 'hospital');
  const police = osmFeatures.filter((f) => f.type === 'police');
  const greenCover = osmFeatures.filter((f) => f.type === 'green-cover');
  const construction = osmFeatures.filter((f) => f.type === 'construction');
  const schools = osmFeatures.filter((f) => f.type === 'school');

  // 1. Lighting Score (0-100)
  let litSegments = 0;
  let totalSegments = 0;

  for (let i = 0; i < routeCoords.length; i += sampleRate) {
    totalSegments++;
    const routePoint = routeCoords[i];

    // Check if within 50m of lit road or street lamp
    const nearLitRoad = litRoads.some((road) => {
      if (!road.coordinates) return false;
      return road.coordinates.some((coord) => {
        const dist = turfDistance(point(routePoint), point(coord), {
          units: 'kilometers',
        });
        return dist < 0.05; // 50 meters
      });
    });

    const nearStreetLamp = streetLamps.some((lamp) => {
      const dist = turfDistance(point(routePoint), point(lamp.location), {
        units: 'kilometers',
      });
      return dist < 0.05; // 50 meters
    });

    if (nearLitRoad || nearStreetLamp) {
      litSegments++;
    }
  }

  let lightingScore = totalSegments > 0 ? (litSegments / totalSegments) * 100 : 50;

  // Time-of-day multiplier: 2x weight if dawn/dusk or night (5-7 AM, 6-10 PM)
  const isDawnDuskNight =
    timeOfDay !== undefined &&
    ((timeOfDay >= 5 && timeOfDay < 7) || (timeOfDay >= 18 && timeOfDay < 22));

  if (isDawnDuskNight && lightingScore < 70) {
    // Penalize low lighting during dawn/dusk/night
    lightingScore *= 0.7;
  }

  // 2. Water Access Score (0-100)
  let waterAccessScore = 100;

  if (distanceKm > 10) {
    // For long runs, check fountain coverage every 5km
    const segmentSize = 5; // km
    const numSegments = Math.ceil(distanceKm / segmentSize);
    let segmentsWithWater = 0;

    for (let seg = 0; seg < numSegments; seg++) {
      const segmentStart = seg * segmentSize;
      const segmentEnd = Math.min((seg + 1) * segmentSize, distanceKm);

      // Check if any fountain within this 5km segment
      const startIdx = Math.floor((segmentStart / distanceKm) * routeCoords.length);
      const endIdx = Math.floor((segmentEnd / distanceKm) * routeCoords.length);

      let hasFountain = false;
      for (let i = startIdx; i < endIdx && i < routeCoords.length; i += sampleRate) {
        const nearFountain = fountains.some((fountain) => {
          const dist = turfDistance(
            point(routeCoords[i]),
            point(fountain.location),
            { units: 'kilometers' }
          );
          return dist < 0.5; // Within 500m
        });

        if (nearFountain) {
          hasFountain = true;
          break;
        }
      }

      if (hasFountain) segmentsWithWater++;
    }

    // Penalty for gaps without water
    const coverage = segmentsWithWater / numSegments;
    waterAccessScore = coverage * 100;
  }

  // 3. Emergency Access Score (0-100)
  const emergencyFacilities = [...hospitals, ...police];
  const hasEmergencyNearby = routeCoords.some((coord) => {
    return emergencyFacilities.some((facility) => {
      const dist = turfDistance(point(coord), point(facility.location), {
        units: 'kilometers',
      });
      return dist < 1.0; // Within 1km
    });
  });

  const emergencyAccessScore = hasEmergencyNearby ? 100 : 70; // Bonus if hospital/police nearby

  // 4. Green Cover Score (0-100)
  let greenSegments = 0;

  for (let i = 0; i < routeCoords.length; i += sampleRate) {
    const routePoint = routeCoords[i];

    const nearGreenCover = greenCover.some((green) => {
      if (!green.coordinates) return false;
      return green.coordinates.some((coord) => {
        const dist = turfDistance(point(routePoint), point(coord), {
          units: 'kilometers',
        });
        return dist < 0.03; // Within 30 meters
      });
    });

    if (nearGreenCover) greenSegments++;
  }

  const greenCoverScore =
    totalSegments > 0 ? (greenSegments / totalSegments) * 100 : 0;

  // Track park coverage ratio for heat island detection (Phase 4.4)
  const parks = osmFeatures.filter((f) => f.type === 'park');
  let parkSegments = 0;

  for (let i = 0; i < routeCoords.length; i += sampleRate) {
    const routePoint = routeCoords[i];

    const inPark = parks.some((park) => {
      if (!park.coordinates) return false;
      return park.coordinates.some((coord) => {
        const dist = turfDistance(point(routePoint), point(coord), {
          units: 'kilometers',
        });
        return dist < 0.05; // Within 50m of park
      });
    });

    if (inPark) parkSegments++;
  }

  const parkRatio = totalSegments > 0 ? parkSegments / totalSegments : 0;

  // 5. Hazard Penalty (0-50)
  let hazardPenalty = 0;

  // Construction zones
  const nearConstruction = routeCoords.some((coord) => {
    return construction.some((zone) => {
      if (!zone.coordinates) return false;
      return zone.coordinates.some((zoneCoord) => {
        const dist = turfDistance(point(coord), point(zoneCoord), {
          units: 'kilometers',
        });
        return dist < 0.1; // Within 100m
      });
    });
  });

  if (nearConstruction) hazardPenalty += 20;

  // School zones during rush hours (if timeOfDay provided)
  if (timeOfDay !== undefined) {
    const isSchoolRushHour =
      (timeOfDay >= 7 && timeOfDay < 9) || (timeOfDay >= 13 && timeOfDay < 16);

    if (isSchoolRushHour) {
      const nearSchool = routeCoords.some((coord) => {
        return schools.some((school) => {
          const dist = turfDistance(point(coord), point(school.location), {
            units: 'kilometers',
          });
          return dist < 0.2; // Within 200m
        });
      });

      if (nearSchool) hazardPenalty += 15;
    }
  }

  hazardPenalty = Math.min(50, hazardPenalty); // Cap at 50

  return {
    waterAccessScore: Math.round(waterAccessScore),
    lightingScore: Math.round(lightingScore),
    emergencyAccessScore,
    greenCoverScore: Math.round(greenCoverScore),
    hazardPenalty,
    parkRatio, // Phase 4.4: For heat island detection
  };
}

export function calculateRouteMetrics(
  route: RouteData,
  targetDistanceKm: number,
  osmFeatures: OSMFeature[] = [],
  heatIndex?: number,
  timeOfDay?: number,
  recentRain?: { '1h'?: number; '3h'?: number } // Phase 4: Post-rain warnings
): RouteMetrics {
  const distanceAccuracy = calculateDistanceAccuracy(
    route.distanceKm,
    targetDistanceKm
  );

  const turnCount = countSignificantTurns(route.coordinates);
  const elevationGain = route.elevationGain;
  const scenicScore = 50; // TODO: Calculate from waytype data

  // Calculate safety metrics
  const safetyMetrics = calculateSafetyMetrics(
    route.coordinates,
    osmFeatures,
    route.distanceKm,
    timeOfDay
  );

  // Heat index penalty (0-30 points penalty based on severity)
  let heatPenalty = 0;
  if (heatIndex) {
    if (heatIndex > 40) heatPenalty = 30; // Extreme heat
    else if (heatIndex > 35) heatPenalty = 20; // High heat
    else if (heatIndex > 30) heatPenalty = 10; // Warm conditions
  }

  // Water proximity penalty (0-40 points) - only water bodies to avoid
  const waterFeatures = osmFeatures.filter((f) => f.type === 'water' && f.shouldAvoid);
  const waterPenalty = calculateWaterProximityPenalty(
    route.coordinates,
    waterFeatures
  );

  // Phase 4: Post-rain surface penalty
  let postRainPenalty = 0;
  if (recentRain) {
    const hasRecentRain =
      (recentRain['1h'] && recentRain['1h'] > 2) || // > 2mm in last hour
      (recentRain['3h'] && recentRain['3h'] > 5); // > 5mm in last 3 hours

    if (hasRecentRain && route.surfaceScore < 70) {
      // Unpaved surfaces become muddy/slippery after rain
      postRainPenalty = 20;
      console.log(
        `[Route Metrics] Post-rain penalty applied: ${postRainPenalty} (unpaved + recent rain)`
      );
    }
  }

  // Phase 4.4: Heat island bonus - reward shaded routes in extreme heat
  let heatIslandBonus = 0;
  if (heatIndex && heatIndex > 35 && safetyMetrics.parkRatio > 0.5) {
    // Urban heat island effect: Parks are 2-5°C cooler than concrete
    heatIslandBonus = 10;
    console.log(
      `[Route Metrics] Heat island bonus applied: ${heatIslandBonus} (${(safetyMetrics.parkRatio * 100).toFixed(0)}% park coverage in ${heatIndex}°C heat)`
    );
  }

  // Rebalanced scoring weights (Phase 1)
  const distanceScore = Math.max(0, 100 - distanceAccuracy);
  const turnScore = Math.max(0, 100 - turnCount * 3); // Reduced from 5 to 3
  const surfaceScore = route.surfaceScore;

  const overallScore =
    0.25 * distanceScore +                              // Reduced from 0.35
    0.20 * turnScore +                                  // Reduced from 0.30
    0.15 * surfaceScore +                               // Reduced from 0.20
    0.10 * scenicScore +                                // Reduced from 0.15
    0.15 * safetyMetrics.lightingScore +                // NEW (Phase 1)
    0.10 * safetyMetrics.waterAccessScore +             // NEW (Phase 1)
    0.05 * safetyMetrics.greenCoverScore +              // NEW (Phase 1)
    heatIslandBonus -                                   // NEW (Phase 4.4)
    (heatPenalty * 0.15) -                              // Reduced from 0.2
    (waterPenalty * 0.4) -                              // Reduced from 0.5
    (safetyMetrics.hazardPenalty * 0.3) -               // NEW (Phase 1)
    (postRainPenalty * 0.1);                            // NEW (Phase 4.3)

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
    safetyMetrics,
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
