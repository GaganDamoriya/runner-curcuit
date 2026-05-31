# Optimization Roadmap: Traffic, Hazards & Advanced Features

## Current State ✅

You now have a **LangGraph multi-agent routing system** that provides:

- ✅ Natural language route explanations
- ✅ Comprehensive safety assessment (Heat, AQI, UV, Wind)
- ✅ India-specific features (NCR AQI via WAQI, heat avoidance)
- ✅ Conversational AI recommendations
- ✅ Water point detection for long runs
- ✅ Multi-agent orchestration (Route → Safety → Scorer)

## Next Phase: Traffic & Hazards 🚧

### 1. Real-Time Traffic Detection

**Goal:** Avoid routes with heavy traffic, road closures, and accidents

#### APIs to Integrate

##### Option A: TomTom Traffic API (Recommended for India)
- **Coverage:** Excellent in India (Delhi, Mumbai, Bangalore, Pune)
- **Free Tier:** 2,500 requests/day
- **Features:**
  - Real-time traffic flow
  - Traffic incidents (accidents, construction)
  - Road closures
  - Journey time calculations
- **Signup:** https://developer.tomtom.com/

**Implementation:**
```typescript
// src/lib/tomtom-traffic.ts
export async function fetchTrafficIncidents(bbox: [number, number, number, number]) {
  const response = await fetch(
    `https://api.tomtom.com/traffic/services/5/incidentDetails` +
    `?bbox=${bbox.join(',')}&key=${process.env.TOMTOM_API_KEY}`
  );
  // Returns: accidents, road closures, construction zones
}

export async function fetchTrafficFlow(coords: [number, number][]) {
  // Get traffic speed for route segments
  // Penalize slow-moving traffic segments
}
```

##### Option B: HERE Traffic API
- **Coverage:** Global, good India coverage
- **Free Tier:** 250,000 transactions/month (generous!)
- **Features:**
  - Traffic flow
  - Incidents
  - Construction zones
- **Signup:** https://developer.here.com/

##### Option C: Google Maps Roads API
- **Coverage:** Best global coverage
- **Cost:** $10 per 1,000 requests (no free tier)
- **Features:** Most accurate traffic data
- **Signup:** https://developers.google.com/maps/documentation/roads

**Recommendation:** Start with **TomTom** (free, good India coverage)

#### LangGraph Integration

Create a new agent:

```typescript
// src/lib/agents/traffic-agent.ts
export async function trafficAgent(state: RouteAgentState) {
  const bbox = calculateBBox(state.routes);
  const incidents = await fetchTrafficIncidents(bbox);
  
  // Filter routes that intersect with incidents
  const safeRoutes = state.routes.filter(route => 
    !hasTrafficIncidents(route, incidents)
  );
  
  return {
    ...state,
    routes: safeRoutes,
    trafficData: incidents,
    nextStep: 'safety',
  };
}
```

Add to workflow in `graph.ts`:
```typescript
workflow.addNode('traffic', trafficAgent);
workflow.addEdge('route', 'traffic');  // After route generation
workflow.addEdge('traffic', 'safety'); // Before safety check
```

---

### 2. Road Quality & Hazard Detection

**Goal:** Avoid potholes, dark areas, poorly maintained roads

#### 2A. OpenStreetMap (Free, Crowdsourced)

**Features available:**
- Road surface type (`surface=asphalt|concrete|gravel|unpaved`)
- Lighting (`lit=yes|no`)
- Road condition (`smoothness=excellent|good|bad|horrible`)
- Potholes (user-tagged: `hazard=pothole`)

**Implementation:**
```typescript
// src/lib/osm-hazards.ts
export async function fetchRoadConditions(bbox: [number, number, number, number]) {
  const query = `
    [out:json];
    (
      way["smoothness"="bad"](${bbox.join(',')});
      way["smoothness"="horrible"](${bbox.join(',')});
      way["surface"="unpaved"](${bbox.join(',')});
      node["hazard"="pothole"](${bbox.join(',')});
    );
    out geom;
  `;
  
  return fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
}
```

**Pros:**
- ✅ Free
- ✅ Good coverage in major cities
- ✅ Community-maintained

**Cons:**
- ❌ Data quality varies
- ❌ Not real-time
- ❌ Incomplete in smaller cities

---

#### 2B. Custom Hazard Database (Supabase)

**Create a crowdsourced hazard reporting system:**

**Database Schema:**
```sql
CREATE TABLE hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  type TEXT NOT NULL,  -- 'pothole', 'dark_area', 'stray_dogs', 'construction', 'flooding'
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  description TEXT,
  image_url TEXT,
  reported_by UUID REFERENCES users(id),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verification_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,  -- Auto-expire old hazards
  active BOOLEAN DEFAULT TRUE
);

-- Spatial index for fast bbox queries
CREATE INDEX hazards_location_idx ON hazards USING GIST (
  ST_Point(lng, lat)
);

-- Count confirmations
CREATE TABLE hazard_confirmations (
  hazard_id UUID REFERENCES hazards(id),
  user_id UUID REFERENCES users(id),
  confirmed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (hazard_id, user_id)
);
```

**LangChain Tool:**
```typescript
// src/lib/agents/tools/hazard-tool.ts
export const hazardDetectionTool = new DynamicStructuredTool({
  name: 'detect_hazards',
  description: 'Detects user-reported hazards along route (potholes, dark areas, etc.)',
  schema: z.object({
    bbox: z.array(z.number()).length(4),
    severityThreshold: z.number().min(1).max(5).default(3),
  }),
  func: async ({ bbox, severityThreshold }) => {
    const { data } = await supabase
      .from('hazards')
      .select('*')
      .eq('active', true)
      .gte('severity', severityThreshold)
      .gte('lat', bbox[1])
      .lte('lat', bbox[3])
      .gte('lng', bbox[0])
      .lte('lng', bbox[2]);
    
    return JSON.stringify({
      success: true,
      hazards: data,
      count: data.length,
    });
  },
});
```

**UI Component for Reporting:**
```tsx
// src/components/HazardReporter.tsx
export function HazardReporter() {
  const [location, setLocation] = useState<[number, number]>();
  
  const handleReport = async (hazard: {
    type: string;
    severity: number;
    description: string;
  }) => {
    await fetch('/api/hazards/report', {
      method: 'POST',
      body: JSON.stringify({
        ...hazard,
        lat: location[1],
        lng: location[0],
      }),
    });
  };
  
  // UI: Select location on map, choose hazard type, add photo
}
```

**Gamification Ideas:**
- 🏆 Points for verified reports
- ⭐ Badges for frequent contributors
- 📊 Community leaderboard
- ✅ Verification rewards (2+ confirmations = verified)

---

### 3. Municipal APIs (India-Specific)

#### Delhi Municipal Corporation
- **Road closure notifications**
- **Construction zones**
- **Waterlogging alerts** (monsoon season)

#### Mumbai Traffic Police
- **Real-time traffic diversions**
- **Event-based road closures** (marathons, festivals)

#### Bangalore BBMP
- **Pothole tracking system** (official database)
- **Road maintenance schedule**

**Challenge:** Most don't have public APIs yet. Options:
1. **Web scraping** (fragile, check ToS)
2. **Partner with government** (formal data-sharing agreement)
3. **Wait for official APIs** (slowly improving)

---

### 4. Weather-Based Hazards

**Already implemented, can be enhanced:**

#### Post-Rain Flooding Detection
```typescript
// src/lib/agents/tools/flood-risk-tool.ts
export const floodRiskTool = new DynamicStructuredTool({
  name: 'detect_flood_risk',
  description: 'Identifies areas prone to flooding after heavy rain',
  schema: z.object({
    bbox: z.array(z.number()).length(4),
    recentRainMm: z.number(),
  }),
  func: async ({ bbox, recentRainMm }) => {
    if (recentRainMm < 10) return JSON.stringify({ floodRisk: 'none' });
    
    // Query known flood-prone areas (from DB or OSM)
    const floodZones = await fetchFloodProneAreas(bbox);
    
    // Check if route intersects
    return JSON.stringify({
      floodRisk: floodZones.length > 0 ? 'high' : 'low',
      zones: floodZones,
    });
  },
});
```

**Data Sources:**
- OpenStreetMap: `flood_prone=yes` tags
- Supabase: Crowdsourced flood reports
- Historical weather + elevation data

---

## Implementation Priority

### Phase 1 (Week 1-2): Traffic API
1. ✅ Sign up for TomTom API
2. ✅ Create `src/lib/tomtom-traffic.ts`
3. ✅ Create `src/lib/agents/traffic-agent.ts`
4. ✅ Add traffic agent to LangGraph workflow
5. ✅ Update scorer to penalize routes with traffic incidents
6. ✅ Test with Delhi traffic data

### Phase 2 (Week 3-4): OSM Hazards
1. ✅ Create `src/lib/osm-hazards.ts` (Overpass API queries)
2. ✅ Fetch road surface, lighting, smoothness data
3. ✅ Update route scoring to penalize poor surfaces
4. ✅ Add night running logic (require `lit=yes` after sunset)

### Phase 3 (Week 5-6): Crowdsourced Hazards
1. ✅ Set up Supabase schema
2. ✅ Create `HazardReporter` component
3. ✅ Create `/api/hazards/report` endpoint
4. ✅ Create `hazard-tool.ts` for LangGraph
5. ✅ Add hazard agent to workflow
6. ✅ Build verification system (community voting)
7. ✅ Add gamification (points, badges)

### Phase 4 (Week 7-8): Optimization
1. ✅ Cache traffic/hazard data (reduce API calls)
2. ✅ Pre-compute flood-prone zones
3. ✅ Add route fallback logic (if main route blocked)
4. ✅ Real-time route updates (push notifications)

---

## Sample Workflow with All Features

```
User Request: "10km morning run in Delhi"
    ↓
Route Agent
  → Generates 3 route candidates
    ↓
Traffic Agent (NEW)
  → Fetches TomTom incidents
  → Filters routes with accidents/closures
  → 1 route removed (construction zone)
    ↓
Hazard Agent (NEW)
  → Queries OSM + Supabase hazards
  → Checks road surface, lighting, potholes
  → Penalizes routes with >5 hazards
    ↓
Safety Agent
  → Analyzes weather (heat, AQI, UV)
  → Detects NCR location → uses WAQI
  → AQI = 180 (unhealthy)
  → Recommends 6 AM start
    ↓
Scorer Agent
  → Combines: route quality (40%) + safety (30%) + hazards (20%) + traffic (10%)
  → Selected route: Park loop with good surface, low AQI exposure
    ↓
Final Recommendation:
  - Route: 10.2km park loop
  - Safety: 75/100 (moderate AQI risk)
  - Traffic: Clear (no incidents)
  - Hazards: 2 dark areas, 1 pothole (low severity)
  - Advice: "Start at 6 AM, bring N95 mask, avoid dark section after sunset"
```

---

## Cost Estimate

| Service | Free Tier | Beyond Free | Monthly Cost (1000 routes) |
|---------|-----------|-------------|----------------------------|
| TomTom Traffic | 2,500/day | $0.50/1k | $0 (within free tier) |
| OpenAI (GPT-4o-mini) | None | $0.150/1M input, $0.600/1M output | ~$2 |
| Supabase (DB) | 500MB free | $25/month (Pro) | $0 (within free) |
| OpenWeatherMap | 1,000/day | $0.0012/call | $0 (within free) |
| WAQI | Unlimited | Free | $0 |
| **Total** | | | **~$2/month** |

**Scaling to 10,000 routes/month:** ~$20/month

---

## Next Steps

1. **Choose traffic API:** TomTom vs HERE vs Google
2. **Implement traffic agent** (see Phase 1 checklist)
3. **Test with real Delhi traffic data**
4. **Add OSM hazard detection**
5. **Build crowdsourced hazard reporting UI**
6. **Deploy to production**

Ready to implement? Let me know which phase you'd like to start with!
