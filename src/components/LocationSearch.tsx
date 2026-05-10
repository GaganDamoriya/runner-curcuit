'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouteStore } from '@/store/route-store';

interface GeocodingResult {
  place_name: string;
  center: [number, number];
}

export function LocationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
        )}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=5`
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
  };

  return (
    <div className="relative">
      <Label htmlFor="location-search">Search Location</Label>
      <Input
        id="location-search"
        type="text"
        placeholder="Search for a place..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          searchLocation(e.target.value);
        }}
        className="mt-1"
      />
      {isSearching && (
        <div className="absolute right-3 top-9 text-sm text-gray-500">
          Searching...
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectLocation(result)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            >
              {result.place_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
