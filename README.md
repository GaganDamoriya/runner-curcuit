# Runner Circuit

A running route planner built with India-first features (heat-aware start times, AQI checks, road quality scoring) that works for runners anywhere in the world.

## Features

- 📋 Route generator — distance input → optimised running route
- 📋 In-app map view — full-screen Mapbox map with route overlay
- 📋 GPX export — download for Strava / Garmin
- 📋 Google Maps deep-link — open route in Google Maps
- 📋 Start time advisor — weather + AQI aware, India summer logic
- 📋 Road quality scoring — surface type per segment
- 📋 Community reviews — ratings and feedback on tracks
- 📋 Group runs — join public community runs
- 📋 Hazard markers — crowdsourced pins (phase 3)

## Tech stack

| Layer       | Technology                           |
| ----------- | ------------------------------------ |
| Frontend    | Next.js 15, TypeScript, Tailwind CSS |
| Map         | Mapbox GL JS                         |
| State       | Zustand + TanStack Query             |
| Routing API | OpenRouteService                     |
| Weather API | OpenWeatherMap                       |
| Database    | Supabase (phase 2)                   |

## Project structure

_Auto-maintained by readme-agent_

## API routes

_Auto-maintained by readme-agent_

## Environment variables

| Variable                   | Type        | Description                    |
| -------------------------- | ----------- | ------------------------------ |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Client-safe | Mapbox public token            |
| `ORS_API_KEY`              | Server-only | OpenRouteService API key       |
| `WEATHER_API_KEY`          | Server-only | OpenWeatherMap API key         |
| `SUPABASE_URL`             | Server-only | Supabase project URL (phase 2) |
| `SUPABASE_SERVICE_KEY`     | Server-only | Supabase service key (phase 2) |

## Getting started

```bash
npm install
cp .env.example .env.local
# Fill in your API keys in .env.local
npm run dev
```

## Roadmap

- **Phase 1** — Core map + route generator + GPX export + start time advisor
- **Phase 2** — Community reviews + group runs (Supabase)
- **Phase 3** — Hazard markers + crowdsourced route scoring
