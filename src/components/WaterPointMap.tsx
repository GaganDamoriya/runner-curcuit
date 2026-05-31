'use client';

import { Droplet, MapPin } from 'lucide-react';
import { OSMFeature } from '@/types/route-optimizer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WaterPointMapProps {
  waterPoints: OSMFeature[];
  distanceKm: number;
}

export function WaterPointMap({ waterPoints, distanceKm }: WaterPointMapProps) {
  if (distanceKm < 15 || waterPoints.length === 0) {
    return null; // Only show for long runs with water points
  }

  // Calculate expected water needs (150ml per km is conservative for heat)
  const expectedWaterML = Math.round(distanceKm * 150);
  const expectedWaterBottles = Math.ceil(expectedWaterML / 500); // 500ml bottles

  // Check for gaps without water (>5km)
  const hasGaps = distanceKm > 15 && waterPoints.length < 3;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Droplet className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          </div>
          Water Points ({waterPoints.length})
          <Badge variant="outline" className="ml-auto">
            {distanceKm.toFixed(1)}km route
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Water needs estimate */}
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
            Estimated Water Needs
          </div>
          <div className="text-caption text-blue-700 dark:text-blue-300">
            ~{expectedWaterML}ml total ({expectedWaterBottles}× 500ml bottles) for this distance
          </div>
        </div>

        {/* Warning if gaps exist */}
        {hasGaps && (
          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
              ⚠️ Limited Water Access
            </div>
            <div className="text-caption text-yellow-700 dark:text-yellow-300">
              Carry extra water - fountain coverage may have gaps over 5km
            </div>
          </div>
        )}

        {/* List of water points */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Available Fountains
          </div>
          {waterPoints.map((point, idx) => (
            <div
              key={point.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {point.name !== 'Unnamed' ? point.name : `Water Point ${idx + 1}`}
                </div>
                <div className="text-caption text-muted-foreground">
                  {point.location[1].toFixed(5)}, {point.location[0].toFixed(5)}
                </div>
              </div>
              <div className="text-caption text-muted-foreground shrink-0">
                {idx === 0 ? 'Start' : idx === waterPoints.length - 1 ? 'End' : `Mid`}
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="text-caption text-muted-foreground italic pt-2 border-t border-border">
          💡 Tip: For hot weather runs, drink 200-250ml every 20 minutes to stay hydrated
        </div>
      </CardContent>
    </Card>
  );
}
