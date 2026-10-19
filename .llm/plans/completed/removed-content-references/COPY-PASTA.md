# Removed content references — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
2. Copy the fenced block only, paste, and the agent runs it.
3. Tick the box when that prompt is done.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

Start only after `archived-content-slimming` is finished and committed.

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- |
| 01 | Codex 5.3 | high | Constraint and foreign key rewrites on live tables |
| 02 | Opus 5.5 | high | Capture before delete in one transaction; owner-only API states |
| 03 | Opus 5.5 | high | Follow moves across accounts, retries, row deletion |
| 04 | Cursor Grok 4.7 | high | UI states over a settled API and seed |
| 05 | Opus 5.5 | high | Sync orchestration and device data on installed phones |
| Close | Cursor Grok 4.7 | medium | Archive files, list commands |

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it on **Codex 5.3**.
Escalate to **Opus 5.5** only when the failure is a design question.

## Phase 1

- [x] **01 — Schema, entities, DTOs**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/removed-content-references/01-schema-and-dtos.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Use the next unused app migration number. Set both readiness markers.
Run make db_regen_linear_baseline and make db_verify_linear_baseline yourself.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 01-schema-and-dtos.md to
.llm/plans/completed/removed-content-references/ and leave the rest of the set in active/.
```

## Phase 2

Start only after 01 is done.

- [x] **02 — Snapshots, takedown, clip and playlist API, copy**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/removed-content-references/02-snapshots-and-clip-api.md
Follow 00-EXECUTION-ORDER.md. Capture snapshots in the same transaction that deletes the
items, before the delete. Never return a snapshot to anyone but the clip or playlist owner.
Write every catalog key in en-US, es, fr, and el-GR originals.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 02-snapshots-and-clip-api.md to
.llm/plans/completed/removed-content-references/.
```

## Phase 3

Start only after 02 is done.

- [x] **03 — Follow conversion, archived 410, empty show deletion, seed**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/removed-content-references/03-follow-conversion-and-show-cleanup.md
Follow 00-EXECUTION-ORDER.md. Probe feeds from workers through fetchWithTimeout, never fetch.
Convert only members who have add_by_rss_add access. Never delete a feed row, a channel that
still has an item row, or a channel referenced by channel_merge.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 03-follow-conversion-and-show-cleanup.md to
.llm/plans/completed/removed-content-references/.
```

## Phase 4

Start only after 03 is done. 04 and 05 can run at the same time in separate chats.

- [x] **04 — Web**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/removed-content-references/04-web-removed-states.md
Follow 00-EXECUTION-ORDER.md. Do not edit the catalog, the seed, mobile, or the API.
Use isRemovedSource from @podverse/helpers.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 04-web-removed-states.md to
.llm/plans/completed/removed-content-references/.
```

- [x] **05 — Mobile**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/removed-content-references/05-mobile-removed-states.md
Follow 00-EXECUTION-ORDER.md. Do not edit the catalog, the seed, web, or the API.
Use isRemovedSource from @podverse/helpers. Old cached payloads must keep rendering.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 05-mobile-removed-states.md to
.llm/plans/completed/removed-content-references/.
```

## Close

Start only after 04 and 05 are both done.

- [x] **Close — archive the set, cumulative verification**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Close the plan set .llm/plans/active/removed-content-references/.
Confirm 01 through 05 are in .llm/plans/completed/removed-content-references/. Move
00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, then remove the empty active
directory. Change no code.
End with the cumulative verification for the whole set below. Give one fenced block per tab.
API tests need make test_deps (Postgres 5732, Valkey 6679). Do not set E2E_API_GATE_MODE.
Mobile Maestro needs Mobile E2E Metro, Mobile E2E API, Mobile E2E test-assets, and
Mobile E2E iOS / Mobile E2E Android already running. Tell the operator to push infra/k8s/
changes to the Argo CD tracked branch.

Root:
npm run build:packages
npm run lint
npm run test:unit
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
npm run build -w apps/workers
make e2e_test_web_report_spec SPEC=e2e/removed-content.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile:
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed

Mobile Maestro:
npm run mobile:e2e:test -- removed-content
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

## After close

Rollout is in [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md): deploy, then watch the next
`archiveAll` log for converted, unreachable, and deleted show counts.
