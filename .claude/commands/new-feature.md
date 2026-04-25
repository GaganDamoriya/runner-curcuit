---
name: new-feature
description: Start a new feature — branch, plan, implement, lint, commit, PR
disable-model-invocation: false
---

Start a new feature: $ARGUMENTS

Follow these steps exactly:

1. Create a feature branch:
   git checkout -b feat/$ARGUMENTS

2. Enter plan mode — read relevant existing files before proposing structure.
   Identify which components, API routes, and lib files need to be created or modified.

3. Present the plan. Wait for approval before writing any code.

4. Implement in small focused diffs — one logical change per edit, not everything at once.

5. After each file is written, confirm lint passes (hooks will auto-run).

6. Run: npx tsc --noEmit
   Fix any type errors before continuing.

7. Run: npm run build
   Fix any build errors.

8. Commit with a descriptive message:
   git add -A
   git commit -m "feat: [describe what was built]"

9. Write a short PR description covering:
   - What was built
   - Any API keys or env vars needed
   - Known limitations or follow-up tasks
