'use client';

import { useState } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRouteStore } from '@/store/route-store';
import { cn } from '@/lib/utils';

interface GeocodingResult {
  place_name: string;
  center: [number, number];
  place_type: string[];
}

export function FloatingLocationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const setStartCoord = useRouteStore((state) => state.setStartCoord);

  const searchLocation = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=5&types=place,locality,neighborhood,address`
      );
      const data = await response.json();
      setResults(data.features || []);
    } catch (error) {
      console.error('Geocoding error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (result: GeocodingResult) => {
    setStartCoord(result.center);
    setQuery(result.place_name);
    setResults([]);
    setIsFocused(false);
  };

  return (
    <div className="fixed top-4 left-4 sm:left-auto sm:right-4 z-30 w-[calc(100%-2rem)] sm:w-96">
      <div className={cn(
        "bg-card border border-border rounded-lg shadow-xl transition-all",
        isFocused && "ring-2 ring-primary/20"
      )}>
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a place..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              searchLocation(e.target.value);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            className="pl-11 pr-11 h-12 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base bg-transparent"
          />
          {isSearching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results Dropdown */}
        {results.length > 0 && isFocused && (
          <div className="border-t border-border max-h-64 overflow-y-auto">
            {results.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectLocation(result)}
                className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
              >
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {result.place_name.split(',')[0]}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.place_name.split(',').slice(1).join(',')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
