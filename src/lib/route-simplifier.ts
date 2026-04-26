import simplify from '@turf/simplify';
import { lineString } from '@turf/helpers';

export function simplifyRoute(
  coordinates: [number, number][],
  tolerance: number = 0.0003
): [number, number][] {
  if (coordinates.length < 3) return coordinates;

  try {
    const line = lineString(coordinates);
    const simplified = simplify(line, {
      tolerance,
      highQuality: true,
      mutate: false,
    });

    return simplified.geometry.coordinates as [number, number][];
  } catch (error) {
    console.error('Route simplification failed:', error);
    return coordinates; // Return original if simplification fails
  }
}
