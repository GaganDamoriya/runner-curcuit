'use client';

import { RouteData } from '@/types/route';
import { geojsonToGpx, downloadGpx, googleMapsUrl } from '@/lib/gpx';

interface RouteStatsProps {
  route: RouteData;
}

export function RouteStats({ route }: RouteStatsProps) {
  const handleGpxDownload = () => {
    const gpx = geojsonToGpx(
      route.coordinates,
      `${route.distanceKm.toFixed(1)}km route`,
      route.distanceKm
    );
    downloadGpx(gpx, `route-${route.distanceKm.toFixed(1)}km`);
  };

  const handleGoogleMaps = () => {
    const url = googleMapsUrl(route.coordinates);
    window.open(url, '_blank');
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <div className="mb-4">
        <div className="text-sm text-gray-600">Distance</div>
        <div className="text-2xl font-bold">{route.distanceKm.toFixed(1)} km</div>
      </div>
      <div className="mb-4">
        <div className="text-sm text-gray-600">Duration</div>
        <div className="text-2xl font-bold">{Math.round(route.durationMin)} min</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleGpxDownload}
          className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium transition-colors"
        >
          Download GPX
        </button>
        <button
          onClick={handleGoogleMaps}
          className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium transition-colors"
        >
          Google Maps
        </button>
      </div>
    </div>
  );
}
