'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import bbox from '@turf/bbox';
import { useRouteStore } from '@/store/route-store';
import { Button } from '@/components/ui/button';
import { Crosshair, Loader2 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

export function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const route = useRouteStore((state) => state.route);
  const startCoord = useRouteStore((state) => state.startCoord);
  const setStartCoord = useRouteStore((state) => state.setStartCoord);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: startCoord,
      zoom: 13,
    });

    mapRef.current = map;

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add map click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      setStartCoord([e.lngLat.lng, e.lngLat.lat]);
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [setStartCoord]);

  // Update start marker when startCoord changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing marker
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
    }

    // Create new marker
    const marker = new mapboxgl.Marker({
      color: '#22c55e',
      draggable: true,
    })
      .setLngLat(startCoord)
      .addTo(map);

    // Update store when marker is dragged
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      setStartCoord([lngLat.lng, lngLat.lat]);
    });

    startMarkerRef.current = marker;

    // Center map on new start point
    map.flyTo({ center: startCoord, zoom: 14 });
  }, [startCoord, setStartCoord]);

  // Update route when route data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) return;

    const updateRoute = () => {
      if (map.getSource('route')) {
        map.removeLayer('route-line');
        map.removeSource('route');
      }

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geojson,
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

      const bounds = bbox(route.geojson);
      map.fitBounds(bounds as [number, number, number, number], {
        padding: { top: 60, bottom: 60, left: 400, right: 60 },
      });
    };

    if (map.loaded()) {
      updateRoute();
    } else {
      map.on('load', updateRoute);
    }
  }, [route]);

  // Get user location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setStartCoord([longitude, latitude]);
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please check permissions.');
        setIsLocating(false);
      }
    );
  };

  return (
    <>
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Location Button */}
      <Button
        onClick={getUserLocation}
        disabled={isLocating}
        size="icon"
        className="absolute bottom-6 right-6 z-10 h-12 w-12 rounded-full shadow-lg"
        title="Use my location"
      >
        {isLocating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Crosshair className="h-5 w-5" />
        )}
      </Button>
    </>
  );
}
