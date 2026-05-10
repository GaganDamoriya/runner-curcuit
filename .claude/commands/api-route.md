---
name: api-route
description: Scaffold a new Next.js App Router API route with types, validation, error handling
disable-model-invocation: false
---

Create a new Next.js API route at: app/api/$ARGUMENTS/route.ts

Requirements:

1. Server-side only — no 'use client' directive
2. Validate all env vars at top — throw clear error if missing
3. Validate request body/params with zod
4. Wrap external API call in try/catch
5. Return proper HTTP status codes:
   - 200 OK
   - 400 Bad Request (validation fail)
   - 429 Rate limit (if external API returns 429)
   - 500 Internal Server Error (unexpected)
6. Never expose raw external API errors to the client
7. Never use NEXT*PUBLIC* env vars — those are client-safe only
8. Create a matching TypeScript type in src/types/ for request and response

Template to follow:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  // define fields
});

export async function POST(req: NextRequest) {
  const apiKey = process.env.YOUR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // call external API
  } catch (err) {
    console.error("[api-route] error:", err);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
```
