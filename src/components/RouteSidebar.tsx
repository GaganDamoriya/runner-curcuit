'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouteStore } from '@/store/route-store';
import { RouteStats } from './RouteStats';
import { GenerateRouteRequest } from '@/types/api';

const PRESET_DISTANCES = [5, 10, 21, 42];

export function RouteSidebar() {
  const [distanceKm, setDistanceKm] = useState(5);
  const [routeType, setRouteType] = useState<'loop' | 'point-to-point'>('loop');
  const [cityPreference, setCityPreference] = useState<
    'stay-in-city' | 'can-leave-city'
  >('stay-in-city');

  const setRoute = useRouteStore((state) => state.setRoute);
  const route = useRouteStore((state) => state.route);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const requestBody: GenerateRouteRequest = {
        distanceKm,
        routeType,
        startCoord: [77.209, 28.6139],
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

  return (
    <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-white shadow-lg z-10 flex flex-col p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6">Runner Circuit</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Distance</label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {PRESET_DISTANCES.map((dist) => (
            <button
              key={dist}
              onClick={() => setDistanceKm(dist)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                distanceKm === dist
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {dist}km
            </button>
          ))}
        </div>
        <input
          type="number"
          value={distanceKm}
          onChange={(e) => setDistanceKm(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded"
          placeholder="Custom distance"
          min="1"
          max="100"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Route Type</label>
        <div className="flex gap-2">
          <button
            onClick={() => setRouteType('loop')}
            className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
              routeType === 'loop'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Loop
          </button>
          <button
            onClick={() => setRouteType('point-to-point')}
            className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
              routeType === 'point-to-point'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Point-to-Point
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">City Preference</label>
        <div className="flex gap-2">
          <button
            onClick={() => setCityPreference('stay-in-city')}
            className={`flex-1 px-4 py-2 rounded font-medium text-sm transition-colors ${
              cityPreference === 'stay-in-city'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Stay in City
          </button>
          <button
            onClick={() => setCityPreference('can-leave-city')}
            className={`flex-1 px-4 py-2 rounded font-medium text-sm transition-colors ${
              cityPreference === 'can-leave-city'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Can Leave
          </button>
        </div>
      </div>

      <button
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {generateMutation.isPending ? 'Generating...' : 'Generate Route'}
      </button>

      {generateMutation.isError && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
          {generateMutation.error.message}
        </div>
      )}

      {route && <RouteStats route={route} />}
    </div>
  );
}
