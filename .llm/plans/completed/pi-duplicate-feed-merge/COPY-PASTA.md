# Podcast Index duplicate feed merge — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
2. Copy the fenced block only, paste, and the agent runs it.
3. Tick the box when that prompt is done. The agent moves that numbered plan to `completed/`
   only when its prompt says to. Do not archive the set until phase 5 is finished.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

Phases are sequential. Wait for every prompt in a phase before the next phase. Prompts in the
same phase may run at the same time.

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- |
| 01 | Cursor Grok 4.7 | high | Schema is fully specified; transcribe it |
| 03 | Codex 5.3 | high | Episode matching has easy-to-get-wrong edge cases |
| 02 | Cursor Grok 4.7 | high | Worker, cron, and env wiring against a written sync |
| 05 | Cursor Grok 4.7 | high | One parser gate, specified |
| 04 | Opus 5.5 | high | Data migration: unique keys, journal, revert |
| 06 | Cursor Grok 4.7 | high | API and redirects against a written contract |
| 07 | Opus 5.5 | high | Device data rewrite, idempotency, downloads |
| 08 | Cursor Grok 4.7 | high | Admin list and actions following flag-status |

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it on **Codex 5.3**.
Escalate to **Opus 5.5** only when the failure is a design question.

## Phase 1

Run both. Wait for both.

- [x] **01 — Merge data model**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/01-merge-data-model.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
You own the schema only. Do not edit worker commands or the parser.
Run make db_regen_linear_baseline and make db_verify_linear_baseline yourself.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 01-merge-data-model.md to
.llm/plans/completed/pi-duplicate-feed-merge/ and leave the rest of the set in active/.
```

- [x] **03 — Pair verification and episode matching**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/03-pair-verification-and-item-matching.md
Follow 00-EXECUTION-ORDER.md and the confidence line in 00-SUMMARY.md.
Matching is one-to-one. Do not edit deduplicator.ts.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 03-pair-verification-and-item-matching.md to
.llm/plans/completed/pi-duplicate-feed-merge/ and leave the rest of the set in active/.
```

## Phase 2

Start only after 01 and 03 are done. Run both. Wait for both.

- [x] **02 — Dead-feed detection sync**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/02-dead-feed-detection-sync.md
Follow 00-EXECUTION-ORDER.md. Record duplicate pairs only. Do not merge, and do not archive
a feed that has no duplicate target. Do not edit the parser notification block or
packages/orm/src/services/deduplicator.ts.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 02-dead-feed-detection-sync.md to
.llm/plans/completed/pi-duplicate-feed-merge/.
```

- [x] **05 — First-parse side-effect guard**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/05-first-parse-side-effect-guard.md
Follow 00-EXECUTION-ORDER.md. Do not edit channel update or the CSV sync.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 05-first-parse-side-effect-guard.md to
.llm/plans/completed/pi-duplicate-feed-merge/.
```

## Phase 3

Start only after 02 and 05 are done.

- [x] **04 — Apply the merge on the server**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/04-apply-merge-server.md
Follow 00-EXECUTION-ORDER.md. Re-point when we do not have the survivor. Absorb when we do.
Journal every moved row. An account that follows both channels must not abort the merge.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 04-apply-merge-server.md to
.llm/plans/completed/pi-duplicate-feed-merge/.
```

## Phase 4

Start only after 04 is done.

- [x] **06 — API 410 and web redirects**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/06-api-and-web-redirects.md
Follow 00-EXECUTION-ORDER.md. Unmatched episodes stay playable. Use APP_ROUTES builders
for redirect targets. Update OpenAPI.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 06-api-and-web-redirects.md to
.llm/plans/completed/pi-duplicate-feed-merge/.
```

## Phase 5

Start only after 06 is done. Run both. Wait for both before the cumulative commands.

- [x] **07 — Mobile identity remap**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/07-mobile-identity-remap.md
Follow 00-EXECUTION-ORDER.md. Rewrite local keys. Do not rename download files. Do not add
fields to DTOItem or DTOChannel. Signed-out subscriptions must remap too.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 07-mobile-identity-remap.md to
.llm/plans/completed/pi-duplicate-feed-merge/. Do not archive the rest of the set.
```

- [x] **08 — Management merge review**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/pi-duplicate-feed-merge/08-management-merge-review.md
Follow 00-EXECUTION-ORDER.md. Approve marks the row verified and does not merge it inline.
Register /feeds/merges before /feeds/:id. Update the management OpenAPI spec.
Do not run the test suite. End with the operator verification commands from the plan,
then the cumulative commands below. Say they should be run only after 07 is also done.
When the plan is done, move 08-management-merge-review.md to
.llm/plans/completed/pi-duplicate-feed-merge/. Do not archive 00-SUMMARY.md,
00-EXECUTION-ORDER.md, or COPY-PASTA.md until 07 is done too.

Cumulative verification for the whole set, after 07 and 08 are both done. Root tab unless
noted. API tests need make test_deps (Postgres 5732, Valkey 6679). Do not set
E2E_API_GATE_MODE. Mobile Maestro needs Mobile E2E Metro, Mobile E2E API, and Mobile E2E
iOS / Mobile E2E Android already running.

npm run lint
npm run test:unit
npm run test:e2e:api
make e2e_test_web_report_spec SPEC=e2e/channel-merge-redirect.spec.ts
make e2e_test_management_web_report_spec SPEC=e2e/feeds-merge-review.spec.ts
open .artifacts/e2e-reports/latest/index.html
npm --prefix apps/mobile run test
npm run mobile:e2e:test -- identity-remap
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

## After phase 5

When 07 and 08 are both done and the cumulative commands have been run, archive the set:

```bash
mv .llm/plans/active/pi-duplicate-feed-merge .llm/plans/completed/pi-duplicate-feed-merge
```

Alpha rollout stays manual: `PODCAST_INDEX_DUPLICATE_MERGE_MODE` stays `off` in base. Set alpha to
`dry_run`, review counts, then `apply`. See [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).
