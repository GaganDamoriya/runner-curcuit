import { LineString } from 'geojson';

const ORS_BASE_URL = 'https://api.openrouteservice.org';
const ORS_API_KEY = process.env.ORS_API_KEY!;

interface ORSRequest {
  coordinates: [number, number][];
  preference: string;
  units: string;
  language: string;
  instructions: boolean;
  elevation: boolean;
  extra_info: string[];
}

interface SurfaceSegment {
  value: number;
  distance: number;
  amount: number;
}

interface SurfaceData {
  values: Array<[number, number, number]>;
  summary: SurfaceSegment[];
}

interface ORSResponse {
  features: Array<{
    geometry: LineString;
    properties: {
      summary: {
        distance: number;
        duration: number;
      };
      extras?: {
        surface?: SurfaceData;
      };
    };
  }>;
}

export async function generateLoop(
  startCoord: [number, number],
  targetDistanceKm: number
): Promise<ORSResponse> {
  const [lng, lat] = startCoord;
  const radiusKm = targetDistanceKm / 4;

  const waypoints: [number, number][] = [
    [lng, lat],
    calculateWaypoint(lat, lng, radiusKm, 0),
    calculateWaypoint(lat, lng, radiusKm, 90),
    calculateWaypoint(lat, lng, radiusKm, 180),
    calculateWaypoint(lat, lng, radiusKm, 270),
    [lng, lat],
  ];

  return callORS(waypoints);
}

export async function generatePointToPoint(
  startCoord: [number, number],
  distanceKm: number
): Promise<ORSResponse> {
  const [lng, lat] = startCoord;
  const endPoint = calculateWaypoint(lat, lng, distanceKm, 90);

  return callORS([startCoord, endPoint]);
}

async function callORS(coordinates: [number, number][]): Promise<ORSResponse> {
  const requestBody: ORSRequest = {
    coordinates,
    preference: 'recommended',
    units: 'km',
    language: 'en',
    instructions: false,
    elevation: true,
    extra_info: ['surface', 'waytype', 'steepness'],
  };

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
    const error = await response.json().catch(() => ({}));
    const errorMessage =
      (error as { error?: { message?: string } }).error?.message ||
      'ORS request failed';
    const err = new Error(errorMessage) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export function calculateSurfaceScore(surfaceData?: SurfaceData): number {
  if (!surfaceData?.summary) return 50;

  const surfaceScores: Record<number, number> = {
    0: 100,
    1: 100,
    2: 100,
    3: 70,
    4: 70,
    5: 40,
    6: 40,
    7: 20,
    8: 20,
    9: 20,
  };

  let totalDistance = 0;
  let weightedScore = 0;

  surfaceData.summary.forEach((segment) => {
    const score = surfaceScores[segment.value] || 50;
    const distance = segment.distance;
    weightedScore += score * distance;
    totalDistance += distance;
  });

  return totalDistance > 0 ? Math.round(weightedScore / totalDistance) : 50;
}

function calculateWaypoint(
  lat: number,
  lng: number,
  distanceKm: number,
  bearing: number
): [number, number] {
  const R = 6371;
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distanceKm / R) +
      Math.cos(latRad) * Math.sin(distanceKm / R) * Math.cos(bearingRad)
  );

  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distanceKm / R) * Math.cos(latRad),
      Math.cos(distanceKm / R) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return [(newLngRad * 180) / Math.PI, (newLatRad * 180) / Math.PI];
}
