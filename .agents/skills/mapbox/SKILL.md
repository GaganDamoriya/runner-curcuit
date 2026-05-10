---
name: mapbox
description: Mapbox GL JS — map setup, drawing routes, fitting bounds, marker management
---

# Mapbox GL JS patterns

## Version

Use mapbox-gl v3. Import as: import mapboxgl from 'mapbox-gl'
Token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN (safe for client)

## Map initialisation

```typescript
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: "mapbox://styles/mapbox/streets-v12",
  center: [77.209, 28.6139], // Delhi default
  zoom: 13,
});
```

## Drawing a route (GeoJSON LineString)

Always follow source → layer order. Never add a layer before its source.

```typescript
// Add source
map.addSource("route", {
  type: "geojson",
  data: {
    type: "Feature",
    geometry: geojsonLineString, // from ORS response
  },
});

// Add layer
map.addLayer({
  id: "route-line",
  type: "line",
  source: "route",
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": "#3b82f6",
    "line-width": 4,
    "line-opacity": 0.9,
  },
});
```

## Updating route without re-initialising map

```typescript
const source = map.getSource("route") as mapboxgl.GeoJSONSource;
if (source) {
  source.setData(newGeoJSON);
} else {
  // add source + layer fresh
}
```

## Fit map to route bounds

```typescript
import bbox from "@turf/bbox"; // npm install @turf/bbox

const bounds = bbox(geojsonFeature);
map.fitBounds(bounds as [number, number, number, number], {
  padding: { top: 60, bottom: 60, left: 320, right: 60 }, // 320 = sidebar width
});
```

## Start/end markers

```typescript
new mapboxgl.Marker({ color: "#22c55e" }).setLngLat(startCoord).addTo(map);

new mapboxgl.Marker({ color: "#ef4444" }).setLngLat(endCoord).addTo(map);
```

## Cleanup on component unmount

```typescript
useEffect(() => {
  // init map...
  return () => map.remove();
}, []);
```

## Important

- Always check map.loaded() before adding sources/layers
- Use map.on('load', () => { ... }) for initial source/layer setup
- Remove existing route source/layer before adding new one to avoid duplicate id errors
