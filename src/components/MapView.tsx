'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import bbox from '@turf/bbox';
import { useRouteStore } from '@/store/route-store';
import 'mapbox-gl/dist/mapbox-gl.css';

export function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const route = useRouteStore((state) => state.route);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [77.209, 28.6139],
      zoom: 13,
    });

    mapRef.current = map;

    return () => map.remove();
  }, []);

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
        padding: { top: 60, bottom: 60, left: 320, right: 60 },
      });
    };

    if (map.loaded()) {
      updateRoute();
    } else {
      map.on('load', updateRoute);
    }
  }, [route]);

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />;
}
