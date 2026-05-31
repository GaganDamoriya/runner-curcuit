# Quick Start: Intelligent Routing with LangGraph

## 🚀 Get Started in 3 Steps

### 1. Set up API Keys

Add to your `.env.local`:

```bash
# Existing keys (you already have these)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
ORS_API_KEY=your_ors_key
WEATHER_API_KEY=your_openweathermap_key
WAQI_API_TOKEN=your_waqi_token

# NEW: Required for LangGraph
OPENAI_API_KEY=sk-proj-...  # Get from https://platform.openai.com/api-keys
```

**Cost:** ~$0.002 per route request using GPT-4o-mini

### 2. Try the Demo Component

Add to any page:

```tsx
import { IntelligentRouteDemo } from '@/components/IntelligentRouteDemo';

export default function Page() {
  return <IntelligentRouteDemo />;
}
```

### 3. Use the API Directly

```typescript
const response = await fetch('/api/route/intelligent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    distanceKm: 10,
    startCoord: [77.2090, 28.6139],  // [lng, lat]
    routeType: 'loop',
    cityPreference: 'stay-in-city',
    timeOfDay: 6,  // 6 AM
    userQuery: 'I want a safe morning run avoiding pollution'
  })
});

const data = await response.json();

if (data.success) {
  console.log(data.explanation);  // "I've selected a scenic park loop..."
  console.log(data.advice);       // ["💧 Bring water", "🧴 Apply sunscreen", ...]
  console.log(data.data.route);   // GeoJSON route data
  console.log(data.data.safety);  // Safety scores
}
```

## 🎯 What You Get

### Conversational Explanations

Instead of raw JSON, you get natural language:

> "I've selected a scenic park loop for your morning run. This 10.12km route scores highly because it stays on paved surfaces (85/100 surface score), avoids the heavily polluted main roads, and includes 3 water fountains for hydration. The best time to start is **6:00 AM** when temperatures are coolest and AQI is at its daily low."

### Comprehensive Safety Assessment

- **Heat Risk:** 20/100 (Low - morning coolness)
- **AQI Risk:** 40/100 (Moderate - sensitive groups affected)
- **UV Risk:** 30/100 (Low at 6 AM)
- **Wind Risk:** 10/100 (Calm conditions)
- **Surface Quality:** 85/100 (Mostly paved)
- **Overall Safety:** 78/100 (Good)

### Actionable Advice

- 💧 Bring water - warm conditions expected
- 🧴 Apply SPF 30+ sunscreen
- 😎 Wear UV-blocking sunglasses
- 💧 Long run detected - plan water stops every 5km

### Agent Conversation Trace

See how the AI agents collaborated:

1. **Route Agent:** "Generated 3 route candidates using park-focused strategy..."
2. **Safety Agent:** "Analyzed weather conditions. AQI is moderate (124), recommend early start..."
3. **Scorer Agent:** "Selected park loop with 87/100 combined score based on safety + route quality..."

## 📊 Comparison: Basic vs Intelligent

| Feature | `/api/route/generate` | `/api/route/intelligent` |
|---------|----------------------|--------------------------|
| Speed | ~2s | ~5s |
| Explanation | None | Natural language |
| Safety Analysis | Basic | Comprehensive (Heat, AQI, UV, Wind) |
| Start Time Advice | No | Yes (best time of day) |
| User Tips | No | Yes (3-5 actionable tips) |
| Agent Trace | No | Yes (full conversation) |
| Cost | Free | ~$0.002/request |

**When to use each:**

- **Basic:** Quick route generation, simple requests, no explanation needed
- **Intelligent:** Complex queries, safety-critical runs, need advice/explanations

## 🔧 Advanced Usage

### React Query Hook

```tsx
import { useIntelligentRoute } from '@/hooks/useIntelligentRoute';

function MyComponent() {
  const { mutate, data, isPending, error } = useIntelligentRoute();

  const handleClick = () => {
    mutate({
      distanceKm: 15,
      startCoord: [77.2090, 28.6139],
      routeType: 'loop',
      cityPreference: 'stay-in-city',
      userQuery: 'Half marathon training, need water stops'
    });
  };

  if (isPending) return <div>🤖 AI agents working...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={handleClick}>Generate Route</button>
      {data?.success && (
        <>
          <p>{data.explanation}</p>
          <ul>
            {data.advice.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
```

### TypeScript Types

```typescript
import type {
  IntelligentRouteRequest,
  IntelligentRouteResponse,
  SafetyAssessment,
} from '@/types/intelligent-route';
```

## 🛠️ Next Steps

### Adding Traffic & Hazards

To detect road blockages, traffic, pits, and accidents:

1. **Sign up for TomTom Traffic API** (India coverage)
   - https://developer.tomtom.com/
   - Free tier: 2,500 requests/day

2. **Create traffic tool:**
   ```bash
   # See LANGGRAPH_GUIDE.md for implementation details
   ```

3. **Add traffic agent to workflow:**
   - Fetches real-time traffic incidents
   - Detects road closures and construction
   - Penalizes routes with heavy traffic

### Custom Hazard Database (Supabase)

Set up crowdsourced hazard reporting:

1. **Schema:**
   ```sql
   CREATE TABLE hazards (
     id UUID PRIMARY KEY,
     lat FLOAT,
     lng FLOAT,
     type TEXT, -- 'pothole', 'dark_area', 'stray_dogs', etc.
     severity INT, -- 1-5
     reported_at TIMESTAMP,
     verified BOOLEAN
   );
   ```

2. **Create hazard-tool.ts:**
   - Queries hazards near route
   - Adjusts route to avoid high-severity hazards
   - Allows users to report new hazards

3. **UI Component:**
   - Hazard markers on map
   - Report hazard form
   - Community verification system

## 📖 Full Documentation

- **Architecture & Concepts:** See [LANGGRAPH_GUIDE.md](./LANGGRAPH_GUIDE.md)
- **API Reference:** See agent files in `src/lib/agents/`
- **Type Definitions:** See `src/types/intelligent-route.ts`

## 💡 Example Use Cases

### 1. Asthma-Friendly Routes
```typescript
{
  userQuery: "I have asthma, need low AQI route avoiding busy roads",
  distanceKm: 8,
  // ... route penalized heavily for AQI risk
}
```

### 2. Night Running Safety
```typescript
{
  userQuery: "Evening run, need well-lit safe areas",
  timeOfDay: 20,  // 8 PM
  // ... route prioritizes lit streets, parks with lighting
}
```

### 3. Long Run Hydration
```typescript
{
  userQuery: "Half marathon training, where are water sources?",
  distanceKm: 21,
  // ... route includes water fountain locations
}
```

### 4. Heat Wave Safety
```typescript
{
  userQuery: "Summer afternoon run, help me avoid heat stroke",
  timeOfDay: 14,  // 2 PM
  // ... AI strongly recommends early morning instead + hydration tips
}
```

## 🐛 Troubleshooting

### "OpenAI API key not configured"
```bash
# Add to .env.local
OPENAI_API_KEY=sk-proj-...
```

### Workflow takes too long
The workflow calls multiple APIs sequentially. Typical times:
- Route generation: ~2s
- Weather analysis: ~1.5s
- LLM explanations: ~1.5s
- **Total: ~5s**

This is expected. For faster responses, use `/api/route/generate`.

### High OpenAI costs
Using GPT-4o-mini costs ~$0.002 per request. For 1000 routes/month:
- Cost: ~$2/month
- To reduce: Cache weather data, reduce explanation length

## ✅ Checklist

- [ ] OpenAI API key added to `.env.local`
- [ ] Existing API keys working (ORS, Weather, WAQI)
- [ ] npm packages installed (`langchain`, `@langchain/langgraph`, etc.)
- [ ] Test `/api/route/intelligent` endpoint
- [ ] Try `IntelligentRouteDemo` component
- [ ] Read full guide in `LANGGRAPH_GUIDE.md`

Ready to add traffic and hazard detection? Let me know!
