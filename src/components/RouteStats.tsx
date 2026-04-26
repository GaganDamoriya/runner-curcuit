'use client';

import { Download, Navigation, Clock, Route } from 'lucide-react';
import { RouteData } from '@/types/route';
import { geojsonToGpx, downloadGpx, googleMapsUrl } from '@/lib/gpx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

  const getSurfaceQuality = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-green-500' };
    if (score >= 60) return { label: 'Good', color: 'bg-blue-500' };
    if (score >= 40) return { label: 'Fair', color: 'bg-yellow-500' };
    return { label: 'Poor', color: 'bg-red-500' };
  };

  const surfaceQuality = getSurfaceQuality(route.surfaceScore);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Route className="h-5 w-5 text-blue-600" />
          Route Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Distance
            </div>
            <div className="text-2xl font-bold">
              {route.distanceKm.toFixed(1)}
              <span className="text-sm font-normal text-gray-600 ml-1">km</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Duration
            </div>
            <div className="text-2xl font-bold">
              {Math.round(route.durationMin)}
              <span className="text-sm font-normal text-gray-600 ml-1">min</span>
            </div>
          </div>
        </div>

        {/* Surface Quality */}
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Surface Quality
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${surfaceQuality.color} transition-all`}
                style={{ width: `${route.surfaceScore}%` }}
              />
            </div>
            <Badge variant="secondary" className="text-xs">
              {surfaceQuality.label}
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGpxDownload}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            GPX
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoogleMaps}
            className="w-full"
          >
            <Navigation className="mr-2 h-4 w-4" />
            Maps
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
