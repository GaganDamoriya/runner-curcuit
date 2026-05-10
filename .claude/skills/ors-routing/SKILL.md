---
name: ors-routing
description: OpenRouteService API — generate running routes, surface scoring, GeoJSON output
---

# OpenRouteService routing

## Base URL

https://api.openrouteservice.org

## Auth

Header: Authorization: <ORS_API_KEY>
Always call from server-side only (app/api/route/generate).

## Profile to use for running

foot-walking — best for runners, uses footpaths and parks over roads.
Never use driving-car or cycling profiles for this app.

## Route generation endpoint

POST /v2/directions/{profile}/geojson

### Request body shape

```json
{
  "coordinates": [[lng, lat], [lng, lat]],
  "preference": "recommended",
  "units": "km",
  "language": "en",
  "instructions": false,
  "elevation": true,
  "extra_info": ["surface", "waytype", "steepness"]
}
```

## Response — key fields to extract

- features[0].geometry — LineString GeoJSON for drawing on map
- features[0].properties.summary.distance — total distance in km
- features[0].properties.summary.duration — seconds
- features[0].properties.extras.surface — segment surface types
- features[0].properties.extras.steepness — elevation grade per segment

## Surface scoring for road quality

Map ORS surface values to quality score (0-100):

- paved / asphalt / concrete = 100
- compacted / gravel = 70
- unpaved / dirt = 40
- path / grass / sand = 20

Aggregate: weighted average across all segments by distance.

## Generating a loop route

ORS does not natively generate loops. Strategy:

1. Take user start point [lat, lng]
2. Generate 3-4 waypoints in a rough circle around it
   using bearing offsets (0°, 90°, 180°, 270°) at distance/4 radius
3. Call ORS with start → waypoints → start as coordinates array
4. This creates a loop that approximates the target distance

## Error handling

- 429 = rate limit (2000 req/day free tier) → return 429 to client
- 404 on route = no route found for those coords → try wider waypoints
- Always wrap in try/catch, never let ORS errors reach the browser raw
