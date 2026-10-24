# combined-merge-anti-gaming-api-keys — COPY-PASTA

## How to use

**Run the whole set (Root tab of the `podverse_combined` window):**
`caffeinate -dims bash .llm/plans/active/combined-merge-anti-gaming-api-keys/driver.sh`. It
merges `origin/develop`, starts each merge, runs each step below with
`./scripts/abcplan/run.sh run combined-merge-anti-gaming-api-keys --stop-after NN`, commits and
pushes `feature/combined` after each step, then runs abcsmoketest. Do not run
`./scripts/abcplan/run.sh run combined-merge-anti-gaming-api-keys` by itself: nothing would start
the merges or commit between them.

When the smoke run stops with a question, answer by rerunning the driver with
`--resume 'Your answer.'`.

Shared rules: `00-SUMMARY.md` § Merge step rules. Deferred items:
`.llm/plans/active/combined-merge-anti-gaming-api-keys-deferred/00-SUMMARY.md`.

## Phase 1 — Popularity anti-gaming

- [x] **01 — Merge feature/popularity-anti-gaming**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/combined-merge-anti-gaming-api-keys/01-merge-popularity-anti-gaming.md

Follow .llm/plans/active/combined-merge-anti-gaming-api-keys/00-SUMMARY.md § Merge step rules.
The driver already started the merge; you resolve, check, and stage. The driver commits and
pushes. This prompt runs build:packages, lint:fix, npm install, and the make db targets the plan
names, which overrides the usual rule against running checks during agent work. A problem you
cannot fix goes to the deferred file and does not block the run.
```

## Phase 2 — Developer API keys

- [x] **02 — Merge feature/developer-api-keys**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/combined-merge-anti-gaming-api-keys/02-merge-developer-api-keys.md

Follow .llm/plans/active/combined-merge-anti-gaming-api-keys/00-SUMMARY.md § Merge step rules.
The driver already started the merge; you resolve, check, and stage. The driver commits and
pushes. This prompt runs build:packages, lint:fix, openapi:check, i18n:validate, npm install, and
the make db targets the plan names, which overrides the usual rule against running checks during
agent work. A problem you cannot fix goes to the deferred file and does not block the run. Read
the final message of step 01 first.
```

## Phase 3 — Whole-tree verification

- [ ] **03 — Whole-tree verification on feature/combined**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/combined-merge-anti-gaming-api-keys/03-combined-verification.md

This prompt runs the builds, lint, type-check, validators, and make db targets the plan names,
which overrides the usual rule against running checks during agent work. Do not run unit, API,
E2E, or Maestro tests; abcsmoketest runs after you. Never commit or push; the driver does. A
problem you cannot fix goes to
.llm/plans/active/combined-merge-anti-gaming-api-keys-deferred/00-SUMMARY.md and does not block
the run. The driver runs abcsmoketest and archives this set after you, so do not archive it.
```

Verification for the whole set is the abcsmoketest run the driver starts after step 03. Its Close
message is in `.artifacts/plan-runner/abctest-smoke-*/Close.md`.
