# Lint fix failures — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):** `./scripts/abcplan/run.sh run lint-fix-failures`.
It runs one fresh agent per prompt on that prompt's model, stops at the first blocker, and resumes
with `./scripts/abcplan/run.sh run lint-fix-failures --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. Prompts in a phase share no
file, and none of them writes the release scratchpad: each puts its entry in its final message,
and plan 12 appends them. Running a phase's prompts one after the other is also correct.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/lint-fix-failures/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read each result before the next prompt starts.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10 · 11, 20 · 21 | Cursor Grok 4.7 high · medium · low |
| 2 | 12 (closes the set) | Cursor Grok 4.7 medium |

No prompt needs Opus 5.5: every change follows a settled plan, and none touches persisted data,
auth, or playback. Plan 10 runs at high because it adds a new script with parsing logic and wires
it into the lint runner. Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — Lint refuses to type-check against out-of-date package builds**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/lint-fix-failures/10-package-build-freshness-check.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
D1 and D5 stand: the runner skips both type-check steps and names npm run build:packages when a
package is out of date, never builds packages itself, and scripts/ci/lint-changed.mjs is not
changed. Do not edit .github/workflows/*. Plan 12 adds a counting helper beside summarize in
lint-with-summary.mjs next phase; leave summarize's shape as it is.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 1 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Do not run
npm run lint, npm run lint:fix, npm run type-check, or any repo-wide check; scope formatters to
your own files. Do not run tests. Do not edit release-notes/scratchpad.md; this plan has no
release scratchpad entry.
When the plan is done, move 10-package-build-freshness-check.md to
.llm/plans/completed/lint-fix-failures/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **11 — Next app type-check ignores generated `.next` types**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/lint-fix-failures/11-next-type-check-without-generated-types.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
D2 and D3 stand: type-check in apps/web and apps/management-web uses a source-only
tsconfig.type-check.json. Leave each app's tsconfig.json, its include of .next types, and
apps/web/.next/ as they are.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 1 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Do not run
npm run lint, npm run lint:fix, npm run type-check, or any repo-wide check; scope formatters to
your own files. Do not run tests. Do not edit release-notes/scratchpad.md; this plan has no
release scratchpad entry.
When the plan is done, move 11-next-type-check-without-generated-types.md to
.llm/plans/completed/lint-fix-failures/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **20 — Clear the feed-check spinner without returning from finally**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/lint-fix-failures/20-feed-check-finally.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Invert the isMountedRef check in checkFeed's finally; no return, throw, break, or continue in
finally. The unmounted path still skips setIsChecking and onChecked.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 1 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Do not run
npm run lint, npm run lint:fix, npm run type-check, or any repo-wide check; scope formatters to
your own file. Do not run tests. Do not edit release-notes/scratchpad.md; this plan has no
release scratchpad entry.
When the plan is done, move 20-feed-check-finally.md to
.llm/plans/completed/lint-fix-failures/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **21 — Give the guidless episode fixture an empty guid**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

```
Read and execute .llm/plans/active/lint-fix-failures/21-guidless-episode-fixture.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Set guid: '' on the No Guid item only; do not change Episode or the expected index '1'.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 1 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Do not run
npm run lint, npm run lint:fix, npm run type-check, or any repo-wide check; scope formatters to
your own file. Do not run tests. Do not edit release-notes/scratchpad.md; this plan has no
release scratchpad entry.
When the plan is done, move 21-guidless-episode-fixture.md to
.llm/plans/completed/lint-fix-failures/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **12 — Lint summary counts each error once, and close the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/lint-fix-failures/12-lint-summary-single-count.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 10 in .artifacts/plan-runner/lint-fix-failures/10.md; finished plans are in
.llm/plans/completed/lint-fix-failures/.
D4 stands: the failed-workspace reprint in run-workspaces.mjs stays; only the lint summary's
count stops including it. Plan 10 changed lint-with-summary.mjs; re-read it and keep its
freshness check. You run alone. Do not run tests.
When the plan is done, move 12-lint-summary-single-count.md to
.llm/plans/completed/lint-fix-failures/. Then close the set:
1. Append to release-notes/scratchpad.md any "Release notes entry" in the final messages of
   prompts 10, 11, 20, and 21 in .artifacts/plan-runner/lint-fix-failures/, unchanged, separated
   by one blank line, skipping one already there. Every plan says none, so expect to append
   nothing. Never edit or remove another change's entry.
2. Confirm 10, 11, 12, 20, and 21 are in .llm/plans/completed/lint-fix-failures/. If one is still
   in active/, stop and report BLOCKED naming it. Then move 00-REQUEST.md, 00-SUMMARY.md,
   00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the empty active directory.
3. Grep every final message in .artifacts/plan-runner/lint-fix-failures/ for blockers and for
   errors reported in files the prompt did not own, and list them in your final message.
End with the cumulative verification for the whole set, assuming no earlier prompt was tested:
one fish-safe fenced bash block labeled Root, in this order. Say the first npm run lint is
expected to name the out-of-date packages, skip type-check, and exit 1 while any package dist/ is
older than its source. Say there is no Maestro or Playwright run because nothing on screen
changes and no Maestro flow exercises checkFeed, and no dependency change, so no lockfile step.

Root:
node --test scripts/ci/package-build-freshness.test.mjs
npm run lint
npm run build:packages
npm run type-check -w apps/web
npm run type-check -w apps/management-web
npm run type-check:mobile
npm --prefix apps/mobile run test
npm run lint:fix
npm run lint
```
