'use client';

import { useQuery } from '@tanstack/react-query';
import { Cloud, AlertTriangle, Clock, ThermometerSun, Wind } from 'lucide-react';
import { useRouteStore } from '@/store/route-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WeatherAdviceSuccessResponse } from '@/types/api';
import { cn } from '@/lib/utils';

// AQI scale helper
const getAQIConfig = (aqi: number) => {
  if (aqi === 1) return {
    label: 'Good',
    variant: 'success' as const,
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    severity: 'safe' as const
  };
  if (aqi === 2) return {
    label: 'Fair',
    variant: 'success' as const,
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    severity: 'safe' as const
  };
  if (aqi === 3) return {
    label: 'Moderate',
    variant: 'warning' as const,
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    severity: 'caution' as const
  };
  if (aqi === 4) return {
    label: 'Unhealthy',
    variant: 'destructive' as const,
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    severity: 'danger' as const
  };
  return {
    label: 'Very Unhealthy',
    variant: 'destructive' as const,
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    severity: 'danger' as const
  };
};

export function WeatherAdvice() {
  const startCoord = useRouteStore((state) => state.startCoord);

  const { data, isLoading, error } = useQuery({
    queryKey: ['weather-advice', startCoord],
    queryFn: async () => {
      const res = await fetch(
        `/api/weather/advice?lat=${startCoord[1]}&lng=${startCoord[0]}`
      );
      if (!res.ok) throw new Error('Failed to fetch weather');
      return res.json() as Promise<WeatherAdviceSuccessResponse>;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!startCoord,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 bg-muted rounded animate-pulse w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return null; // Fail silently, weather is optional
  }

  const { current, recommendations, alerts, location } = data.data;
  const aqiConfig = current.aqi ? getAQIConfig(current.aqi.aqi) : null;
  const isDangerous = aqiConfig?.severity === 'danger' || current.temp > 38;
  const isCaution = aqiConfig?.severity === 'caution' || current.temp > 32;

  return (
    <div className="space-y-4">
      {/* Critical Status Banner - Only shows when conditions are bad */}
      {isDangerous && (
        <div className={cn(
          "p-4 rounded-lg border-2 animate-in",
          aqiConfig?.severity === 'danger'
            ? "bg-destructive/15 border-destructive text-destructive"
            : "bg-warning/15 border-warning text-warning"
        )}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-lg mb-1">
                {aqiConfig?.severity === 'danger' ? '⚠️ Do Not Run Outdoors' : '⚠️ Caution Advised'}
              </div>
              <div className="text-sm font-medium opacity-90">
                {alerts[0] || `${current.aqi ? 'Poor air quality' : 'Extreme heat'} detected. Consider indoor alternatives.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Conditions Card */}
      <Card className={cn(
        isCaution && !isDangerous && "border-warning/40"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-accent" />
            </div>
            Current Conditions
            {location.isNCR && (
              <Badge variant="outline">NCR</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Temp & AQI - Equal Prominence */}
          <div className="grid grid-cols-2 gap-3">
            {/* Temperature */}
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <ThermometerSun className="h-4 w-4 text-accent" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Temp</span>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {Math.round(current.temp)}°C
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Feels {Math.round(current.feelsLike)}°C
              </div>
            </div>

            {/* AQI - Same size as temp */}
            {current.aqi && aqiConfig && (
              <div className={cn(
                "p-4 rounded-lg border",
                aqiConfig.bgColor,
                `border-${aqiConfig.variant}/20`
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Wind className={cn("h-4 w-4", aqiConfig.textColor)} />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">AQI</span>
                </div>
                <div className={cn("text-3xl font-bold", aqiConfig.textColor)}>
                  {current.aqi.aqi === 1 ? '★' : current.aqi.aqi === 2 ? '★★' : current.aqi.aqi === 3 ? '★★★' : current.aqi.aqi === 4 ? '★★★★' : '★★★★★'}
                </div>
                <div className={cn("text-xs font-semibold mt-1", aqiConfig.textColor)}>
                  {aqiConfig.label}
                </div>
              </div>
            )}
          </div>

          {/* 24-Hour Trend - Visual Timeline */}
          {recommendations.length > 0 && (
            <div className="pt-4 border-t border-border">
              <div className="text-label mb-3">Best Running Windows (Next 24h)</div>

              {/* Timeline Visualization */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-1 h-8 rounded overflow-hidden">
                  {recommendations.slice(0, 8).map((rec, idx) => {
                    const quality = rec.score >= 80 ? 'success' : rec.score >= 60 ? 'primary' : rec.score >= 40 ? 'warning' : 'destructive';
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex-1 h-full transition-all hover:scale-105",
                          quality === 'success' && "bg-success/60",
                          quality === 'primary' && "bg-primary/60",
                          quality === 'warning' && "bg-warning/60",
                          quality === 'destructive' && "bg-destructive/60"
                        )}
                        title={`${rec.timeLabel}: ${rec.score}/100`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Now</span>
                  <span>+12h</span>
                  <span>+24h</span>
                </div>
              </div>

              {/* Top Recommendation */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-title text-primary">
                    {recommendations[0].timeLabel}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {recommendations[0].reasoning}
                  </div>
                </div>
                <Badge variant="default" className="shrink-0">
                  {recommendations[0].score}
                </Badge>
              </div>

              {/* Warnings */}
              {recommendations[0].warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {recommendations[0].warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-warning p-2 rounded bg-warning/5"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="flex-1">{warning}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
