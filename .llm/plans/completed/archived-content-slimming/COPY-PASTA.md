# Archived content slimming — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
2. Copy the fenced block only, paste, and the agent runs it.
3. Tick the box when that prompt is done.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

Start only after `feed-description-tiers` 01 and 03 are merged.

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- |
| 01 | Cursor Grok 4.7 | high | Two columns and an index, specified |
| 02 | Opus 5.5 | high | Batched deletes on live data, reversal through the parser |
| 03 | Cursor Grok 4.7 | high | Seed fixture and two E2E checks |

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it on **Codex 5.3**.
Escalate to **Opus 5.5** only when the failure is a design question.

## Phase 1

- [x] **01 — Schema and markers**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/archived-content-slimming/01-schema-markers.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Use the next unused app migration number. Set both readiness markers.
Run make db_regen_linear_baseline and make db_verify_linear_baseline yourself.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 01-schema-markers.md to
.llm/plans/completed/archived-content-slimming/ and leave the rest of the set in active/.
```

## Phase 2

Start only after 01 is done.

- [x] **02 — Slimming pass, parser reversal, report**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/archived-content-slimming/02-slimming-pass.md
Follow 00-EXECUTION-ORDER.md. Never delete an item, channel, or feed row. Keep enclosures,
images, item_about, live_item, and soundbites a playlist references. Run channel_trailer
before channel_season in the shared cleanup list.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 02-slimming-pass.md to
.llm/plans/completed/archived-content-slimming/.
```

## Phase 3

Start only after 02 is done.

- [x] **03 — Seed, surfaces, E2E**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/archived-content-slimming/03-surfaces-and-e2e.md
Follow 00-EXECUTION-ORDER.md. Reach the archived fixture by URL or deep link, not by browsing.
Add no copy. Do not edit ORM services or the parser.
Do not run the test suite. End with the operator verification commands from the plan, then
the cumulative commands below.
When the plan is done, move 03-surfaces-and-e2e.md to
.llm/plans/completed/archived-content-slimming/, then move 00-SUMMARY.md,
00-EXECUTION-ORDER.md, and COPY-PASTA.md there too and remove the empty active directory.

Cumulative verification for the whole set. Give one fenced block per tab. API tests need
make test_deps (Postgres 5732, Valkey 6679). Do not set E2E_API_GATE_MODE. Mobile Maestro
needs Mobile E2E Metro, Mobile E2E API, Mobile E2E test-assets, and Mobile E2E iOS /
Mobile E2E Android already running.

Root:
npm run build:packages
npm run lint
npm run test:unit
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
npm run build -w apps/workers
node apps/workers/dist/index.js ormArchivedSlimReport
make e2e_test_web_report_spec SPEC=e2e/archived-clip.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile:
make mobile_e2e_seed

Mobile Maestro:
npm run mobile:e2e:test -- archived-clip
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

## After phase 3

Rollout is in [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md): run the report, let
`archiveAll` drain the backlog, run the report again.
