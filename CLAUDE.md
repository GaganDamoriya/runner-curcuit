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
│   ├── page.tsx                    # home / map view
│   ├── api/
│   │   ├── route/
│   │   │   ├── generate/           # POST: basic route generation (ORS)
│   │   │   └── intelligent/        # POST: LangGraph AI route planner
│   │   ├── weather/advice/         # GET: start time advisor
│   │   ├── tracks/                 # GET/POST: community routes
│   │   └── groups/                 # group run endpoints
│   └── components/
├── lib/
│   ├── ors.ts                      # OpenRouteService client
│   ├── weather.ts                  # OpenWeatherMap client
│   ├── waqi.ts                     # WAQI (India AQI)
│   ├── openuv.ts                   # UV index
│   ├── windy.ts                    # Wind data
│   ├── gpx.ts                      # GPX file generator
│   ├── supabase.ts                 # DB client (phase 2)
│   └── agents/                     # LangGraph multi-agent system
│       ├── graph.ts                # State machine orchestrator
│       ├── route-agent.ts          # Route generation agent
│       ├── safety-agent.ts         # Weather/safety analysis agent
│       ├── scorer-agent.ts         # Route scoring agent
│       ├── tools/                  # LangChain tools
│       │   ├── route-tool.ts
│       │   └── weather-tool.ts
│       └── types.ts
├── hooks/
│   └── useIntelligentRoute.ts      # React Query hook for AI routing
└── types/
    ├── intelligent-route.ts        # AI routing types
    └── ...
```

### External APIs

All external API calls go server-side only — keys are never exposed to the browser:

- **OpenRouteService** — route generation (free 2000 req/day); pedestrian profiles + OSM surface tags
- **OpenWeatherMap** — hourly forecast, heat index, global AQI
- **WAQI (World Air Quality Index)** — India-specific AQI (more accurate than OpenWeatherMap for NCR)
- **OpenUV** — UV index and sun exposure warnings
- **Windy** — Wind speed, direction, and gusts
- **OpenAI** — GPT-4o-mini for LangGraph intelligent routing (conversational explanations)
- **Mapbox** — map rendering only (public token, frontend-safe)
- **Supabase** — database + auth (phase 2)

### Env vars

Server-side (never expose to client):
```
ORS_API_KEY              # OpenRouteService
WEATHER_API_KEY          # OpenWeatherMap
WAQI_API_TOKEN           # World Air Quality Index (India)
OPENUV_API_KEY           # UV index (optional)
WINDY_API_KEY            # Wind data (optional)
OPENAI_API_KEY           # Required for /api/route/intelligent (LangGraph)
SUPABASE_URL             # Phase 2
SUPABASE_SERVICE_KEY     # Phase 2
```

Client-safe:
```
NEXT_PUBLIC_MAPBOX_TOKEN
```

## Conventions

- All external API logic lives in `src/lib/` — never inline in route handlers.
- API keys only in server-side route handlers (`app/api/`).
- Components in `src/app/components/` or `src/components/`.
- Types in `src/types/`.
- Use React Query for all data fetching in components.
- Difficulty score = distance + elevation + heat index + surface score.
- AQI check is critical for NCR (Delhi, Ghaziabad, Gurugram) users.

## Intelligent Routing (LangGraph)

Runner Circuit includes a **multi-agent AI system** powered by LangGraph and GPT-4o-mini.

**Architecture:**
```
User Query → Route Agent → Safety Agent → Scorer Agent → Recommendation
```

**When to use:**
- `/api/route/generate` — Fast, basic route generation (no AI)
- `/api/route/intelligent` — Conversational, safety-aware recommendations with natural language explanations

**Key files:**
- `src/lib/agents/graph.ts` — LangGraph state machine
- `src/lib/agents/route-agent.ts` — Route generation with ORS
- `src/lib/agents/safety-agent.ts` — Weather + AQI + UV + wind analysis
- `src/lib/agents/scorer-agent.ts` — Combines route quality + safety, explains recommendation
- `src/components/IntelligentRouteDemo.tsx` — Demo UI component
- `src/hooks/useIntelligentRoute.ts` — React Query hook

**Documentation:**
- Full guide: `LANGGRAPH_GUIDE.md`
- Quick start: `QUICKSTART_INTELLIGENT_ROUTING.md`

**Cost:** ~$0.002 per route using GPT-4o-mini

## Feature build order

1. Map view + route generator (ORS API via server route)
2. GPX export + Google Maps deep-link
3. Start time advisor (weather-aware, AQI, India summer logic)
4. Road quality scoring
5. Community reviews + ratings (Supabase)
6. Group runs / community events
7. Hazard markers (crowdsourced, feeds back into routing)
