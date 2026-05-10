'use client';

import { Clock, Star, Trash2, RotateCcw } from 'lucide-react';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import { RouteData } from '@/types/route';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RouteHistoryProps {
  onRestore: (route: RouteData, preferences: any) => void;
}

export function RouteHistory({ onRestore }: RouteHistoryProps) {
  const { history, removeFromHistory, toggleFavorite, clearHistory, isHydrated } = useRouteHistory();

  if (!isHydrated) {
    return null;
  }

  if (history.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Routes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">
            No saved routes yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Routes ({history.length})
          </CardTitle>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-7 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.slice(0, 10).map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-2 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <button
              onClick={() => toggleFavorite(item.id)}
              className="shrink-0"
            >
              <Star
                className={`h-4 w-4 ${
                  item.isFavorite
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-400 hover:text-yellow-400'
                }`}
              />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {item.route.distanceKm.toFixed(1)}km
                </span>
                <Badge variant="outline" className="text-xs">
                  {item.preferences.routeType === 'loop' ? 'Loop' : 'P2P'}
                </Badge>
              </div>
              <div className="text-xs text-gray-500">
                {formatTimestamp(item.timestamp)}
              </div>
            </div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRestore(item.route, item.preferences)}
                className="h-7 w-7 p-0"
                title="Restore route"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFromHistory(item.id)}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                title="Delete route"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
