'use client';

import { useQuery } from '@tanstack/react-query';
import { ThermometerSun, Wind, AlertTriangle } from 'lucide-react';
import { useRouteStore } from '@/store/route-store';
import { WeatherAdviceSuccessResponse } from '@/types/api';
import { cn } from '@/lib/utils';

// AQI scale helper
const getAQIConfig = (aqi: number) => {
  if (aqi === 1) return { label: 'Good', color: 'text-success', bg: 'bg-success/10' };
  if (aqi === 2) return { label: 'Fair', color: 'text-success', bg: 'bg-success/10' };
  if (aqi === 3) return { label: 'Moderate', color: 'text-warning', bg: 'bg-warning/10' };
  if (aqi === 4) return { label: 'Unhealthy', color: 'text-destructive', bg: 'bg-destructive/10' };
  return { label: 'Very Unhealthy', color: 'text-destructive', bg: 'bg-destructive/10' };
};

export function WeatherQuickView() {
  const startCoord = useRouteStore((state) => state.startCoord);

  const { data, isLoading } = useQuery({
    queryKey: ['weather-advice', startCoord],
    queryFn: async () => {
      const res = await fetch(
        `/api/weather/advice?lat=${startCoord[1]}&lng=${startCoord[0]}`
      );
      if (!res.ok) throw new Error('Failed to fetch weather');
      return res.json() as Promise<WeatherAdviceSuccessResponse>;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!startCoord,
  });

  if (isLoading || !data?.success) {
    return (
      <div className="px-4 py-3">
        <div className="flex gap-3">
          <div className="flex-1 h-16 bg-muted rounded-lg animate-pulse" />
          <div className="flex-1 h-16 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const { current, alerts } = data.data;
  const aqiConfig = current.aqi ? getAQIConfig(current.aqi.aqi) : null;
  const isDangerous = (aqiConfig && current.aqi && current.aqi.aqi >= 4) || current.temp > 38;

  return (
    <div className="px-4 pb-4">
      {/* Critical Alert - Collapsed */}
      {isDangerous && alerts.length > 0 && (
        <div className="mb-3 p-3 bg-destructive/15 border border-destructive rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <span className="text-sm font-semibold text-destructive">Do not run outdoors</span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="flex gap-3">
        {/* Temperature */}
        <div className="flex-1 p-4 rounded-lg bg-accent/5 border border-accent/20">
          <div className="flex items-center gap-2 mb-1">
            <ThermometerSun className="h-4 w-4 text-accent" />
            <span className="text-xs text-muted-foreground uppercase">Temp</span>
          </div>
          <div className="text-2xl font-bold">
            {Math.round(current.temp)}°C
          </div>
          <div className="text-xs text-muted-foreground">
            Feels {Math.round(current.feelsLike)}°C
          </div>
        </div>

        {/* AQI */}
        {current.aqi && aqiConfig && (
          <div className={cn(
            "flex-1 p-4 rounded-lg border",
            aqiConfig.bg
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Wind className={cn("h-4 w-4", aqiConfig.color)} />
              <span className="text-xs text-muted-foreground uppercase">AQI</span>
            </div>
            <div className={cn("text-2xl font-bold", aqiConfig.color)}>
              {current.aqi.aqi === 1 ? '★' : current.aqi.aqi === 2 ? '★★' : current.aqi.aqi === 3 ? '★★★' : current.aqi.aqi === 4 ? '★★★★' : '★★★★★'}
            </div>
            <div className={cn("text-xs font-semibold", aqiConfig.color)}>
              {aqiConfig.label}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-center text-xs text-muted-foreground">
        Swipe up for details
      </div>
    </div>
  );
}
