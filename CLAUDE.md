# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Read the Next.js docs first

This project uses Next.js 16 (via `next@16.2.4`), which has breaking changes from older versions. Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices — APIs, conventions, and file structure may differ from training data.

## Commands

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

No test suite is configured yet.

## Architecture

**Runner Circuit** is a running route planner with India-first features (heat-aware start times, AQI checks, local road conditions) that works globally.

### Stack

- Next.js App Router + TypeScript
- Mapbox GL JS — map rendering (public token, safe in browser)
- Tailwind CSS v4
- Zustand — client state
- TanStack React Query — server state / API caching

### Project structure

```
src/
├── app/
│   ├── page.tsx              # home / map view
│   ├── api/
│   │   ├── route/generate/   # POST: generates running route via ORS
│   │   ├── weather/advice/   # GET: start time advisor
│   │   ├── tracks/           # GET/POST: community routes
│   │   └── groups/           # group run endpoints
│   └── components/
├── lib/
│   ├── ors.ts                # OpenRouteService client
│   ├── weather.ts            # OpenWeatherMap client
│   ├── gpx.ts                # GPX file generator
│   └── supabase.ts           # DB client (phase 2)
└── types/
```

### External APIs

All external API calls go server-side only — keys are never exposed to the browser:

- **OpenRouteService** — route generation (free 2000 req/day); pedestrian profiles + OSM surface tags
- **OpenWeatherMap** — hourly forecast, heat index, AQI
- **Mapbox** — map rendering only (public token, frontend-safe)
- **Supabase** — database + auth (phase 2)

### Env vars

Server-side (never expose to client):
```
ORS_API_KEY
WEATHER_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

Client-safe:
```
NEXT_PUBLIC_MAPBOX_TOKEN
```

## Conventions

- All external API logic lives in `src/lib/` — never inline in route handlers.
- API keys only in server-side route handlers (`app/api/`).
- Components in `src/app/components/`.
- Types in `src/types/`.
- Use React Query for all data fetching in components.
- Difficulty score = distance + elevation + heat index + surface score.
- AQI check is critical for NCR (Delhi, Ghaziabad, Gurugram) users.

## Feature build order

1. Map view + route generator (ORS API via server route)
2. GPX export + Google Maps deep-link
3. Start time advisor (weather-aware, AQI, India summer logic)
4. Road quality scoring
5. Community reviews + ratings (Supabase)
6. Group runs / community events
7. Hazard markers (crowdsourced, feeds back into routing)
