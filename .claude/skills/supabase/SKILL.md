---
name: supabase
description: Supabase schema, auth, RLS for Runner Circuit community features (phase 2)
---

# Supabase — phase 2 reference

## Setup

Client: src/lib/supabase.ts
Use @supabase/supabase-js. Server-side uses SUPABASE_SERVICE_KEY (never expose).
Client-side uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY only.

## Schema

### routes

```sql
create table routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  name text not null,
  distance_km numeric not null,
  geojson jsonb not null,
  surface_score integer,
  difficulty text check (difficulty in ('easy','moderate','hard')),
  city text,
  is_public boolean default false,
  created_at timestamptz default now()
);
```

### reviews

```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references routes,
  user_id uuid references auth.users,
  rating integer check (rating between 1 and 5),
  body text,
  time_of_day text check (time_of_day in ('morning','evening','night')),
  verified_run boolean default false,
  created_at timestamptz default now()
);
```

### group_runs

```sql
create table group_runs (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references routes,
  organiser_id uuid references auth.users,
  run_date timestamptz not null,
  pace_category text,
  max_participants integer default 20,
  created_at timestamptz default now()
);
```

### hazard_markers

```sql
create table hazard_markers (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references routes,
  user_id uuid references auth.users,
  lat numeric not null,
  lng numeric not null,
  type text check (type in ('dog','construction','dim_light','shady','pothole','water_point','safe_turn')),
  expires_at timestamptz,
  created_at timestamptz default now()
);
```

## RLS policies

Always enable RLS. Public routes readable by all, writable by owner only.
Reviews: anyone can read, auth users can insert their own.

## Auth

Use Supabase magic link for MVP — no password complexity to manage.
