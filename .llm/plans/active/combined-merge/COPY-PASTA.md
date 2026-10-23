# combined-merge — COPY-PASTA

## How to use

**Run the whole set overnight (Root tab of the `podverse_combined` window):**
`caffeinate -dims bash .llm/plans/active/combined-merge/overnight.sh`. It starts each merge, runs
each step below with `./scripts/abcplan/run.sh run combined-merge --stop-after NN`, commits and
pushes `feature/combined` after each step, then runs abctestall. Do not run
`./scripts/abcplan/run.sh run combined-merge` by itself: nothing would start the merges or commit
between them.

Shared rules: `00-SUMMARY.md` § Merge step rules. Deferred items:
`.llm/plans/active/combined-merge-deferred/00-SUMMARY.md`.

## Phase 1 — Realtime banner notifications

- [x] **01 — Merge feature/realtime-banner-notifications**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/combined-merge/01-merge-realtime-banner-notifications.md

Follow .llm/plans/active/combined-merge/00-SUMMARY.md § Merge step rules. The overnight driver
already started the merge; you resolve, check, and stage. The driver commits and pushes. This
prompt runs build:packages, lint:fix, npm install, and the make db targets the plan names, which
overrides the usual rule against running checks during agent work. A problem you cannot fix goes
to the deferred file and does not block the run.
```

## Phase 2 — Artist and album attribution

- [x] **02 — Merge feature/artist-album-attribution**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/combined-merge/02-merge-artist-album-attribution.md

Follow .llm/plans/active/combined-merge/00-SUMMARY.md § Merge step rules. The overnight driver
already started the merge; you resolve, check, and stage. The driver commits and pushes. This
prompt runs build:packages, lint:fix, npm install, and the make db targets the plan names, which
overrides the usual rule against running checks during agent work. A problem you cannot fix goes
to the deferred file and does not block the run. Read the final message of step 01 first.
```

## Phase 3 — Auth sessions

- [x] **03 — Merge feature/auth-sessions**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/combined-merge/03-merge-auth-sessions.md

Follow .llm/plans/active/combined-merge/00-SUMMARY.md § Merge step rules. The overnight driver
already started the merge; you resolve, check, and stage. The driver commits and pushes. This
prompt runs build:packages, lint:fix, npm install, and the make db targets the plan names, which
overrides the usual rule against running checks during agent work. A problem you cannot fix goes
to the deferred file and does not block the run. Read the final message of step 02 first.
```

## Phase 4 — Popularity tracking rebuild

- [ ] **04 — Merge feature/popularity-tracking-rebuild**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/combined-merge/04-merge-popularity-tracking-rebuild.md

Follow .llm/plans/active/combined-merge/00-SUMMARY.md § Merge step rules. The overnight driver
already started the merge; you resolve, check, and stage. The driver commits and pushes. This
prompt runs build:packages, lint:fix, npm install, and the make db targets the plan names, which
overrides the usual rule against running checks during agent work. A problem you cannot fix goes
to the deferred file and does not block the run. Read the final message of step 03 first.
```

## Phase 5 — Whole-tree verification

- [ ] **05 — Whole-tree verification on feature/combined**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/combined-merge/05-combined-verification.md

This prompt runs the builds, lint, validators, and make db targets the plan names, which overrides
the usual rule against running checks during agent work. Do not run unit, API, E2E, or Maestro
tests; abctestall runs after you. Never commit or push; the driver does. A problem you cannot fix
goes to .llm/plans/active/combined-merge-deferred/00-SUMMARY.md and does not block the run. The
driver runs abctestall and archives this set after you, so do not archive it.
```

Verification for the whole set is the abctestall sweep the driver starts after step 05. Its Close
message is in `.artifacts/plan-runner/abctest-all-*/Close.md`.
