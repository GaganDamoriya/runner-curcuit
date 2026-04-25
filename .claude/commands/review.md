---
name: review
description: Multi-agent code review — security, types, conventions before merging
disable-model-invocation: false
---

Run a code review on the current branch changes.

Steps:

1. Run: git diff main --name-only
   Get list of changed files.

2. Delegate security check to security-agent:
   - Scan for any NEXT*PUBLIC* env vars holding secret keys
   - Check all user inputs are sanitised before use in map or DB queries
   - Verify no API keys are hardcoded anywhere
   - Check all API routes validate input before calling external services

3. Check code conventions:
   - All external API calls are in src/lib/ not inline in route handlers
   - Components use React Query for data fetching, not raw fetch
   - No inline styles — Tailwind only
   - Types defined in src/types/, not inline

4. Check for common Next.js mistakes:
   - No 'use client' on API routes
   - No server-only env vars used in client components
   - No missing loading/error states on async components

5. Report findings as: ✅ Pass / ⚠️ Warning / ❌ Block
   Block = must fix before merge
   Warning = should fix but not blocking
