# Podcast Index retired feeds — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
2. Copy the fenced block only, paste, and the agent runs it.
3. Tick the box when that prompt is done.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

Start only after `removed-content-references` is finished and committed.

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- |
| 01 | Opus 5.5 | high | Migration, grants, and copy in four locales |
| 02 | Opus 5.5 | high | Brake and lifecycle writes against the live feed table |
| 03 | Codex 5.3 | high | Set-based SQL inside one existing method |
| 04 | Opus 5.5 | high | One row per account, follow deletion, retention |
| 05 | Codex 5.3 | high | Authenticated read API over a settled service |
| 06 | Codex 5.3 | high | Settings tab over a settled API and seed |
| 07 | Opus 5.5 | high | Device sync log and a signed-in screen |
| Close | Cursor Grok 4.7 | medium | Archive files, list commands |

If a Codex 5.3 prompt stalls or makes the same mistake twice, rerun it on **Opus 5.5**.

## Phase 1

- [x] **01 — Schema, DTO, copy**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/podcast-index-retired-feeds/01-schema-dtos-copy.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Use the next unused app migration number. Set both readiness markers.
Run make db_regen_linear_baseline and make db_verify_linear_baseline yourself.
Write every catalog key in en-US, es, fr, and el-GR originals.
Do not run the test suite. End with the operator verification commands from the plan.
Append the scratchpad entry from the plan.
When the plan is done, move 01-schema-dtos-copy.md to
.llm/plans/completed/podcast-index-retired-feeds/ and leave the rest of the set in active/.
```

## Phase 2

Start only after 01 is done. 02 and 03 can run at the same time in separate chats.

- [x] **02 — Retire detection**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/podcast-index-retired-feeds/02-retire-detection.md
Follow 00-EXECUTION-ORDER.md. A null last_retire_eligible_count retires nothing.
dry_run stores the count and changes no lifecycle. apply retires at most 200 feeds.
Do not edit archiver.ts.
Do not run the test suite. End with the operator verification commands from the plan.
Append the scratchpad entry from the plan.
When the plan is done, move 02-retire-detection.md to
.llm/plans/completed/podcast-index-retired-feeds/.
```

- [x] **03 — Batched pending archive**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/podcast-index-retired-feeds/03-batched-pending-archive.md
Follow 00-EXECUTION-ORDER.md. Cap one run at 1000 feeds. Do not load channel.items.
Do not change the archiveAll call order. Do not edit the retire job.
Do not run the test suite. End with the operator verification commands from the plan.
Append the scratchpad entry from the plan.
When the plan is done, move 03-batched-pending-archive.md to
.llm/plans/completed/podcast-index-retired-feeds/.
```

## Phase 3

Start only after 02 and 03 are both done.

- [x] **04 — Log writes, follow end, purge**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/podcast-index-retired-feeds/04-log-writes-follow-end-purge.md
Follow 00-EXECUTION-ORDER.md. One account and one show produce one row. End every remaining
directory follow after conversion settles, including accounts past the log-row cut.
Do not rewrite processPendingArchiveFeeds.
Do not run the test suite. End with the operator verification commands from the plan.
Append the scratchpad entry from the plan.
When the plan is done, move 04-log-writes-follow-end-purge.md to
.llm/plans/completed/podcast-index-retired-feeds/.
```

## Phase 4

Start only after 04 is done.

- [x] **05 — API, OpenAPI, seed fixture**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/podcast-index-retired-feeds/05-api-endpoint.md
Follow 00-EXECUTION-ORDER.md. The list is the signed-in account only. Seed one row for the
E2E user and export its title from both seed-constant files.
Do not edit catalogs, web UI, or mobile UI.
Do not run the test suite. End with the operator verification commands from the plan.
Append the scratchpad entry from the plan.
When the plan is done, move 05-api-endpoint.md to
.llm/plans/completed/podcast-index-retired-feeds/.
```

## Phase 5

Start only after 05 is done. 06 and 07 can run at the same time in separate chats.

- [x] **06 — Web Advanced tab**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/podcast-index-retired-feeds/06-web-advanced-tab.md
Follow 00-EXECUTION-ORDER.md. Do not edit the catalog except the load-error sentence the
plan allows. Do not edit the seed, mobile, or the API.
Use the helpers-requests function from 05.
Do not run the test suite. End with the operator verification commands from the plan.
Append the scratchpad entry from the plan.
When the plan is done, move 06-web-advanced-tab.md to
.llm/plans/completed/podcast-index-retired-feeds/.
```

- [x] **07 — Mobile Removed Content**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/podcast-index-retired-feeds/07-mobile-removed-content.md
Follow 00-EXECUTION-ORDER.md. Do not edit the catalog except the load-error sentence the
plan allows. Do not edit the seed, web, or the API.
A signed-in drop does not append directory_channel_gone. A signed-out drop still does.
Add removed-content-log to flow_needs_e2e_api.
Do not run the test suite. End with the operator verification commands from the plan.
Append the scratchpad entry from the plan.
When the plan is done, move 07-mobile-removed-content.md to
.llm/plans/completed/podcast-index-retired-feeds/.
```

## Close

Start only after 06 and 07 are both done.

- [x] **Close — archive the set, cumulative verification**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Close the plan set .llm/plans/active/podcast-index-retired-feeds/.
Confirm 01 through 07 are in .llm/plans/completed/podcast-index-retired-feeds/. Move
00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, then remove the empty active
directory. Change no code.
End with the cumulative verification for the whole set below. Give one fenced block per tab.
API tests need make test_deps (Postgres 5732, Valkey 6679). Do not set E2E_API_GATE_MODE.
Mobile Maestro needs Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS / Mobile E2E
Android already running. Tell the operator to push infra/k8s/ changes to the Argo CD
tracked branch. Alpha rollout stays manual: base PODCAST_INDEX_DEAD_FEED_RETIRE_MODE stays
off. Set alpha to dry_run, read the eligible count, then set apply.

Root:
npm run build:packages
npm run lint
npm run test:unit
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/workers
npm run build -w apps/workers
make e2e_test_web_report_spec SPEC=e2e/removed-content-log.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile:
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed

Mobile Maestro:
npm run mobile:e2e:test -- removed-content-log
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

## After close

Rollout is in [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md): `dry_run` on alpha, read the
eligible count, then `apply`. The merge-mode flag is a separate step.
