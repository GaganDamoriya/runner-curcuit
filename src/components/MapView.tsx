'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import bbox from '@turf/bbox';
import { useRouteStore } from '@/store/route-store';
import { Button } from '@/components/ui/button';
import { FloatingLocationSearch } from '@/components/FloatingLocationSearch';
import { Crosshair, Loader2 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

export function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeStartMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeEndMarkerRef = useRef<mapboxgl.Marker | null>(null);
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

    // Create new marker with primary color (fallback to blue since mapbox doesn't support oklch)
    const marker = new mapboxgl.Marker({
      color: '#3b82f6',
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
          'line-opacity': 0.8,
        },
      });

      // Add directional arrows
      if (map.getLayer('route-arrows')) {
        map.removeLayer('route-arrows');
      }

      map.addLayer({
        id: 'route-arrows',
        type: 'symbol',
        source: 'route',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 80,
          'text-field': '▶',
          'text-size': 16,
          'text-rotation-alignment': 'map',
          'text-keep-upright': false,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#3b82f6',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-opacity': 0.8,
        },
      });

      // Remove old route markers if they exist
      if (routeStartMarkerRef.current) {
        routeStartMarkerRef.current.remove();
      }
      if (routeEndMarkerRef.current) {
        routeEndMarkerRef.current.remove();
      }

      // Get start and end coordinates
      const startCoordRoute = route.coordinates[0];
      const endCoordRoute = route.coordinates[route.coordinates.length - 1];

      // Determine if it's a loop route (start ≈ end)
      const isLoop =
        Math.abs(startCoordRoute[0] - endCoordRoute[0]) < 0.0001 &&
        Math.abs(startCoordRoute[1] - endCoordRoute[1]) < 0.0001;

      // Create START marker (green)
      const startMarker = new mapboxgl.Marker({
        color: '#10b981',
        scale: 1.2,
      })
        .setLngLat(startCoordRoute)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            '<div class="font-semibold">🏁 START</div>' +
            (isLoop ? '<div class="text-sm">Loop route</div>' : '')
          )
        )
        .addTo(map);

      routeStartMarkerRef.current = startMarker;

      // Create END/FINISH marker
      if (!isLoop) {
        const endMarker = new mapboxgl.Marker({
          color: '#ef4444',
          scale: 1.2,
        })
          .setLngLat(endCoordRoute)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              '<div class="font-semibold">🏁 FINISH</div>'
            )
          )
          .addTo(map);

        routeEndMarkerRef.current = endMarker;
      } else {
        // For loop routes, add a different colored marker at the same location
        const finishMarker = new mapboxgl.Marker({
          color: '#6366f1',
          scale: 1.0,
        })
          .setLngLat(endCoordRoute)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              '<div class="font-semibold">🏁 START & FINISH</div>' +
              '<div class="text-sm">Return here to complete loop</div>'
            )
          )
          .addTo(map);

        routeEndMarkerRef.current = finishMarker;
      }

      const bounds = bbox(route.geojson);

      // Responsive padding: account for wider sidebar (28rem = 448px)
      const isMobile = window.innerWidth < 640; // Tailwind 'sm' breakpoint
      map.fitBounds(bounds as [number, number, number, number], {
        padding: {
          top: 60,
          bottom: 60,
          left: isMobile ? 20 : 480, // 448px sidebar + 32px margin
          right: 60,
        },
        maxZoom: 14,
      });
    };

    if (map.loaded()) {
      updateRoute();
    } else {
      map.on('load', updateRoute);
    }

    return () => {
      if (routeStartMarkerRef.current) {
        routeStartMarkerRef.current.remove();
      }
      if (routeEndMarkerRef.current) {
        routeEndMarkerRef.current.remove();
      }
    };
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

      {/* Floating Search Bar */}
      <FloatingLocationSearch />

      {/* Location Button */}
      <Button
        onClick={getUserLocation}
        disabled={isLocating}
        variant="default"
        size="icon"
        className="absolute bottom-6 right-6 z-10 shadow-lg hover:shadow-xl transition-all duration-200 animate-in"
        title="Use my location"
        aria-label="Use my location"
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
