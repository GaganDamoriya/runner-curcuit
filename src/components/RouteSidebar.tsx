'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPin, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useRouteStore } from '@/store/route-store';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import { RouteStats } from './RouteStats';
import { RouteHistory } from './RouteHistory';
import { WeatherAdvice } from './WeatherAdvice';
import { WeatherQuickView } from './WeatherQuickView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GenerateRouteRequest, GenerateRouteResponse } from '@/types/api';
import { RouteData } from '@/types/route';
import { decodeURLToParams } from '@/lib/url-utils';
import { cn } from '@/lib/utils';

const PRESET_DISTANCES = [5, 10, 21, 42];

interface RouteSidebarProps {
  initialParams?: Record<string, string | string[] | undefined>;
}

export function RouteSidebar({ initialParams }: RouteSidebarProps) {
  const [distanceKm, setDistanceKm] = useState(5);
  const [customDistance, setCustomDistance] = useState('');
  const [routeType, setRouteType] = useState<'loop' | 'point-to-point'>('loop');
  const [cityPreference, setCityPreference] = useState<
    'stay-in-city' | 'can-leave-city'
  >('stay-in-city');
  const [routeResponse, setRouteResponse] = useState<GenerateRouteResponse | null>(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);

  const setRoute = useRouteStore((state) => state.setRoute);
  const setStartCoord = useRouteStore((state) => state.setStartCoord);
  const startCoord = useRouteStore((state) => state.startCoord);
  const route = useRouteStore((state) => state.route);
  const { addToHistory } = useRouteHistory();

  // Initialize from URL params on mount
  useEffect(() => {
    if (!initialParams) return;

    const urlSearchParams = new URLSearchParams(
      initialParams as Record<string, string>
    );
    const routeParams = decodeURLToParams(urlSearchParams);

    if (routeParams) {
      // Initialize form state
      setDistanceKm(routeParams.distance);
      setRouteType(routeParams.routeType);
      setCityPreference(routeParams.cityPreference);
      setStartCoord([routeParams.lng, routeParams.lat]);

      // TODO: Optionally auto-generate route here
    }
  }, [initialParams, setStartCoord]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const finalDistance = customDistance
        ? Number(customDistance)
        : distanceKm;

      const requestBody: GenerateRouteRequest = {
        distanceKm: finalDistance,
        routeType,
        startCoord,
        cityPreference,
      };

      const res = await fetch('/api/route/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate route');
      }

      return res.json();
    },
    onSuccess: (data: GenerateRouteResponse) => {
      setRoute(data.data);
      setRouteResponse(data);

      // Save to history
      const finalDistance = customDistance ? Number(customDistance) : distanceKm;
      addToHistory(data.data, {
        distanceKm: finalDistance,
        routeType,
        startCoord,
        cityPreference,
      });

      // Close mobile sheet after successful route generation on mobile
      setIsMobileExpanded(false);
    },
  });

  const handlePresetClick = (dist: number) => {
    setDistanceKm(dist);
    setCustomDistance('');
  };

  const handleRestoreRoute = (restoredRoute: RouteData, preferences: any) => {
    // Restore route to map
    setRoute(restoredRoute);

    // Restore form preferences
    setDistanceKm(preferences.distanceKm);
    setCustomDistance('');
    setRouteType(preferences.routeType);
    setCityPreference(preferences.cityPreference);

    // Set route response to show stats
    setRouteResponse({
      success: true,
      data: restoredRoute,
      strategyUsed: 'Restored from History',
    });
  };

  // Touch handlers for bottom sheet
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.touches[0].clientY - touchStart;
    if ((isMobileExpanded && diff > 0) || (!isMobileExpanded && diff < 0)) {
      setTouchOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchOffset) > 50) {
      setIsMobileExpanded(touchOffset < 0);
    }
    setTouchStart(null);
    setTouchOffset(0);
  };

  // Shared content for both desktop and mobile
  const formContent = (
    <div className="p-6 space-y-6 flex-1">
        {/* Weather Advice */}
        <WeatherAdvice />

        {/* Distance Selection */}
        <div className="space-y-3">
          <Label className="text-label">Distance</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_DISTANCES.map((dist) => (
              <Button
                key={dist}
                variant={
                  distanceKm === dist && !customDistance
                    ? 'default'
                    : 'outline'
                }
                onClick={() => handlePresetClick(dist)}
                size="default"
              >
                {dist}km
              </Button>
            ))}
          </div>
          <Input
            type="number"
            placeholder="Custom distance (1-100km)"
            value={customDistance}
            onChange={(e) => setCustomDistance(e.target.value)}
            min="1"
            max="100"
          />
        </div>

        {/* Route Type */}
        <div className="space-y-3">
          <Label className="text-label">Route Type</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={routeType === 'loop' ? 'default' : 'outline'}
              onClick={() => setRouteType('loop')}
              size="default"
            >
              Loop
            </Button>
            <Button
              variant={routeType === 'point-to-point' ? 'default' : 'outline'}
              onClick={() => setRouteType('point-to-point')}
              size="default"
            >
              Point-to-Point
            </Button>
          </div>
        </div>

        {/* City Preference */}
        <div className="space-y-3">
          <Label className="text-label">City Preference</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={
                cityPreference === 'stay-in-city' ? 'default' : 'outline'
              }
              onClick={() => setCityPreference('stay-in-city')}
              size="default"
            >
              Stay in City
            </Button>
            <Button
              variant={
                cityPreference === 'can-leave-city' ? 'default' : 'outline'
              }
              onClick={() => setCityPreference('can-leave-city')}
              size="default"
            >
              Can Leave
            </Button>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full"
          size="lg"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating Route...
            </>
          ) : (
            'Generate Route'
          )}
        </Button>

        {/* Error Display */}
        {generateMutation.isError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm animate-in">
            {generateMutation.error.message}
          </div>
        )}

        {/* Route Stats */}
        {route && routeResponse && (
          <RouteStats
            route={route}
            metrics={routeResponse.metrics}
            strategyUsed={routeResponse.strategyUsed}
            preferences={{
              distanceKm: customDistance ? Number(customDistance) : distanceKm,
              routeType,
              startCoord,
              cityPreference,
            }}
          />
        )}

        {/* Route History */}
        <RouteHistory onRestore={handleRestoreRoute} />
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden sm:block fixed left-0 top-0 bottom-0 z-40 w-md bg-card border-r border-border shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-6 border-b border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <MapPin className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Runner Circuit</h1>
              <p className="text-xs text-muted-foreground">AI-powered running routes</p>
            </div>
          </div>
        </div>

        {formContent}
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={cn(
          "sm:hidden fixed left-0 right-0 bottom-0 z-40",
          "bg-card border-t-2 border-border shadow-2xl",
          "transition-all duration-300 ease-out",
          isMobileExpanded ? "top-20" : "top-auto"
        )}
        style={{ transform: `translateY(${touchOffset}px)` }}
      >
        {/* Drag Handle */}
        <button
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full flex flex-col items-center py-2 active:bg-muted/50 touch-none"
        >
          <div className="w-12 h-1.5 bg-border rounded-full mb-2" />
          {isMobileExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {/* Content */}
        <div className={cn(
          "overflow-y-auto",
          isMobileExpanded ? "max-h-[calc(100vh-6rem)]" : "max-h-40"
        )}>
          {isMobileExpanded ? (
            <>
              {/* Header for expanded state */}
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
                    <MapPin className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold tracking-tight">Runner Circuit</h2>
                    <p className="text-xs text-muted-foreground">AI-powered routes</p>
                  </div>
                </div>
              </div>
              {formContent}
            </>
          ) : (
            <WeatherQuickView />
          )}
        </div>
      </div>
    </>
  );
}
