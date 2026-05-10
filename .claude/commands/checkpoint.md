---
name: checkpoint
description: Commit current work with an auto-generated descriptive commit message
disable-model-invocation: false
---

Save current progress as a git commit.

1. Run: git diff --staged --stat
   If nothing staged, run: git add -A

2. Run: git diff --cached --name-only
   Read the list of changed files.

3. Generate a commit message in this format:
   feat/fix/chore: [concise description of what changed]

   Keep it under 72 chars. Use:
   - feat: for new features or components
   - fix: for bug fixes
   - chore: for config, deps, tooling changes
   - refactor: for restructuring without behaviour change

4. Run: git commit -m "[generated message]"

5. Confirm commit hash and show git log --oneline -3
