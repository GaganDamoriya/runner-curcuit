'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPin, Loader2 } from 'lucide-react';
import { useRouteStore } from '@/store/route-store';
import { RouteStats } from './RouteStats';
import { LocationSearch } from './LocationSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GenerateRouteRequest } from '@/types/api';

const PRESET_DISTANCES = [5, 10, 21, 42];

export function RouteSidebar() {
  const [distanceKm, setDistanceKm] = useState(5);
  const [customDistance, setCustomDistance] = useState('');
  const [routeType, setRouteType] = useState<'loop' | 'point-to-point'>('loop');
  const [cityPreference, setCityPreference] = useState<
    'stay-in-city' | 'can-leave-city'
  >('stay-in-city');

  const setRoute = useRouteStore((state) => state.setRoute);
  const startCoord = useRouteStore((state) => state.startCoord);
  const route = useRouteStore((state) => state.route);

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
    onSuccess: (data) => {
      setRoute(data.data);
    },
  });

  const handlePresetClick = (dist: number) => {
    setDistanceKm(dist);
    setCustomDistance('');
  };

  return (
    <div className="absolute left-0 top-0 bottom-0 w-95 bg-white border-r border-gray-200 z-10 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-5 w-5 text-blue-600" />
          <h1 className="text-2xl font-bold">Runner Circuit</h1>
        </div>
        <p className="text-sm text-gray-600">AI-powered running routes</p>
      </div>

      {/* Form */}
      <div className="p-6 space-y-6">
        {/* Location Search */}
        <LocationSearch />

        {/* Distance Selection */}
        <div className="space-y-2">
          <Label>Distance</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_DISTANCES.map((dist) => (
              <Button
                key={dist}
                variant={
                  distanceKm === dist && !customDistance
                    ? 'default'
                    : 'outline'
                }
                onClick={() => handlePresetClick(dist)}
                className="h-10"
              >
                {dist}km
              </Button>
            ))}
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="Custom (1-100km)"
              value={customDistance}
              onChange={(e) => setCustomDistance(e.target.value)}
              min="1"
              max="100"
              className="pr-12"
            />
            {customDistance && (
              <Badge
                variant="secondary"
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                {customDistance}km
              </Badge>
            )}
          </div>
        </div>

        {/* Route Type */}
        <div className="space-y-2">
          <Label>Route Type</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={routeType === 'loop' ? 'default' : 'outline'}
              onClick={() => setRouteType('loop')}
            >
              Loop
            </Button>
            <Button
              variant={routeType === 'point-to-point' ? 'default' : 'outline'}
              onClick={() => setRouteType('point-to-point')}
            >
              Point-to-Point
            </Button>
          </div>
        </div>

        {/* City Preference */}
        <div className="space-y-2">
          <Label>City Preference</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={
                cityPreference === 'stay-in-city' ? 'default' : 'outline'
              }
              onClick={() => setCityPreference('stay-in-city')}
              size="sm"
            >
              Stay in City
            </Button>
            <Button
              variant={
                cityPreference === 'can-leave-city' ? 'default' : 'outline'
              }
              onClick={() => setCityPreference('can-leave-city')}
              size="sm"
            >
              Can Leave
            </Button>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Route...
            </>
          ) : (
            'Generate Route'
          )}
        </Button>

        {/* Error Display */}
        {generateMutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {generateMutation.error.message}
          </div>
        )}

        {/* Route Stats */}
        {route && <RouteStats route={route} />}
      </div>
    </div>
  );
}
