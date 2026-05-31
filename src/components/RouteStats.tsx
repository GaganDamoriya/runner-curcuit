'use client';

import { useState } from 'react';
import { Download, Navigation, Clock, Route, TrendingUp, Navigation2, Mountain, Share2, Check, Lightbulb, Droplet, Trees, AlertTriangle } from 'lucide-react';
import { RouteData } from '@/types/route';
import { RouteMetrics, OSMFeature } from '@/types/route-optimizer';
import { geojsonToGpx, downloadGpx, googleMapsUrl } from '@/lib/gpx';
import { encodeRouteToURL } from '@/lib/url-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WaterPointMap } from './WaterPointMap';

interface RouteStatsProps {
  route: RouteData;
  metrics?: RouteMetrics;
  strategyUsed?: string;
  waterPoints?: OSMFeature[]; // Phase 4.6: Water fountains for long runs
  preferences?: {
    distanceKm: number;
    routeType: 'loop' | 'point-to-point';
    startCoord: [number, number];
    cityPreference: 'stay-in-city' | 'can-leave-city';
  };
}

export function RouteStats({ route, metrics, strategyUsed, waterPoints, preferences }: RouteStatsProps) {
  const [shareSuccess, setShareSuccess] = useState(false);
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

  const handleShare = async () => {
    if (!preferences) return;

    const shareUrl = encodeRouteToURL({
      distance: preferences.distanceKm,
      routeType: preferences.routeType,
      cityPreference: preferences.cityPreference,
      lat: preferences.startCoord[1],
      lng: preferences.startCoord[0],
    });

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const getSurfaceQuality = (score: number) => {
    if (score >= 80) return {
      label: 'Excellent',
      variant: 'success' as const,
      icon: '🌟'
    };
    if (score >= 60) return {
      label: 'Good',
      variant: 'default' as const,
      icon: '✓'
    };
    if (score >= 40) return {
      label: 'Fair',
      variant: 'warning' as const,
      icon: '○'
    };
    return {
      label: 'Poor',
      variant: 'destructive' as const,
      icon: '!'
    };
  };

  const getElevationDifficulty = (gain: number) => {
    if (gain > 500) return { label: 'Mountainous', variant: 'destructive' as const };
    if (gain > 200) return { label: 'Hilly', variant: 'warning' as const };
    if (gain > 50) return { label: 'Moderate', variant: 'default' as const };
    return { label: 'Flat', variant: 'success' as const };
  };

  const surfaceQuality = getSurfaceQuality(route.surfaceScore);
  const elevationDifficulty = getElevationDifficulty(route.elevationGain);

  return (
    <>
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Route className="h-5 w-5 text-primary" />
          </div>
          Route Details
          {strategyUsed && (
            <Badge variant="outline" className="ml-auto">
              {strategyUsed}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Metrics - Large Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/30">
            <div className="text-caption mb-1">Distance</div>
            <div className="text-display text-primary">
              {route.distanceKm.toFixed(2)}
              <span className="text-lg text-muted-foreground ml-1">km</span>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/30">
            <div className="text-caption mb-1">Duration</div>
            <div className="text-display text-primary">
              {route.durationMin.toFixed(0)}
              <span className="text-lg text-muted-foreground ml-1">min</span>
            </div>
          </div>
        </div>

        {/* Secondary Metrics */}
        {metrics && (
          <div className="space-y-4">
            {/* Accuracy */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Distance Accuracy</span>
                <span className="text-sm font-medium">
                  {(100 - metrics.distanceAccuracy).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${100 - metrics.distanceAccuracy}%` }}
                />
              </div>
            </div>

            {/* Turns */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm text-muted-foreground">Turns</span>
              <span className="text-title">{metrics.turnCount}</span>
            </div>

            {/* Surface Quality */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Surface Quality</span>
                <Badge variant={surfaceQuality.variant}>
                  {surfaceQuality.icon} {surfaceQuality.label}
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-success to-primary transition-all duration-500"
                  style={{ width: `${route.surfaceScore}%` }}
                />
              </div>
            </div>

            {/* Elevation */}
            {route.elevationGain > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Mountain className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <div className="text-caption">Elevation Gain</div>
                    <div className="text-title">{route.elevationGain}m</div>
                  </div>
                </div>
                <Badge variant={elevationDifficulty.variant}>
                  {elevationDifficulty.label}
                </Badge>
              </div>
            )}

            {/* Safety Metrics */}
            {metrics.safetyMetrics && (
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="text-sm font-medium text-foreground mb-3">Safety Features</div>

                {/* Lighting Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-yellow-500/10 flex items-center justify-center">
                        <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                      </div>
                      <span className="text-sm text-muted-foreground">Lighting</span>
                    </div>
                    <span className="text-sm font-medium">
                      {metrics.safetyMetrics.lightingScore}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 dark:bg-yellow-600 transition-all duration-500"
                      style={{ width: `${metrics.safetyMetrics.lightingScore}%` }}
                    />
                  </div>
                </div>

                {/* Water Access Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                        <Droplet className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                      </div>
                      <span className="text-sm text-muted-foreground">Water Access</span>
                    </div>
                    <span className="text-sm font-medium">
                      {metrics.safetyMetrics.waterAccessScore}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-500"
                      style={{ width: `${metrics.safetyMetrics.waterAccessScore}%` }}
                    />
                  </div>
                </div>

                {/* Green Cover Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center">
                        <Trees className="h-4 w-4 text-green-600 dark:text-green-500" />
                      </div>
                      <span className="text-sm text-muted-foreground">Green Cover</span>
                    </div>
                    <span className="text-sm font-medium">
                      {metrics.safetyMetrics.greenCoverScore}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 dark:bg-green-600 transition-all duration-500"
                      style={{ width: `${metrics.safetyMetrics.greenCoverScore}%` }}
                    />
                  </div>
                </div>

                {/* Hazard Warning */}
                {metrics.safetyMetrics.hazardPenalty > 10 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-destructive">Route Advisory</div>
                      <div className="text-caption text-destructive/80 mt-0.5">
                        {metrics.safetyMetrics.hazardPenalty > 30
                          ? 'High hazard risk detected (construction zones or heavy traffic)'
                          : 'Moderate hazards detected along this route'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Overall Score */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Score</span>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-primary">
                    {metrics.overallScore}
                  </div>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
          <Button
            onClick={handleGpxDownload}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            GPX
          </Button>
          <Button
            onClick={handleGoogleMaps}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Navigation className="mr-2 h-4 w-4" />
            Maps
          </Button>
          <Button
            onClick={handleShare}
            disabled={!preferences}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {shareSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Phase 4.6: Water Point Map for long runs */}
    {waterPoints && waterPoints.length > 0 && (
      <WaterPointMap waterPoints={waterPoints} distanceKm={route.distanceKm} />
    )}
    </>
  );
}
