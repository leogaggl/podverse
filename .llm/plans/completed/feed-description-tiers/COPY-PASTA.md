# Feed description length tiers — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
2. Copy the fenced block only, paste, and the agent runs it.
3. Tick the box when that prompt is done. The agent moves that numbered plan to `completed/`
   only when its prompt says to. Do not archive the set until phase 5 is finished.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

Phases are sequential. Wait for every prompt in a phase before the next phase. Prompts in the
same phase may run at the same time.

`pi-duplicate-feed-merge` is already finished. See the first section of
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- |
| 01 | Codex 5.3 | high | Tree builder, truncation, and serializer; many edge cases |
| 02 | Cursor Grok 4.7 | medium | Small additive field in a small library |
| 03 | Cursor Grok 4.7 | high | Schema and scheduler fully specified; transcribe it |
| 04 | Opus 5.5 | high | Parser threading, job handler, backfill on live data |
| 05 | Cursor Grok 4.7 | high | Admin control following the existing flag-status pattern |
| 06 | Cursor Grok 4.7 | high | One endpoint against a written contract |
| 07 | Cursor Grok 4.7 | high | Web wiring across several pages |
| 08 | Opus 5.5 | high | Device cache, migration, offline pinning |
| 09 | Codex 5.3 | high | TypeORM `select: false` has easy-to-miss readers |

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it on **Codex 5.3**.
Escalate to **Opus 5.5** only when the failure is a design question.

## Phase 1

Run both. Wait for both.

- [x] **01 — Description ingest helpers**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/01-description-ingest-helpers.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
You own packages/helpers lib files only. Do not edit DTOs, parser-mapping, or renderers.
Strict-mode parsing must produce the same output as before for every existing test.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 01-description-ingest-helpers.md to
.llm/plans/completed/feed-description-tiers/ and leave the rest of the set in active/.
```

- [x] **02 — Partytime raw description**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/feed-description-tiers/02-partytime-raw-description.md
Follow 00-EXECUTION-ORDER.md. Make the code changes in the Partytime repo at
/Users/mitcheldowney/repos/pv/partytime, not in Podverse. The change is additive: the
existing description output must not change.
Do not run release.sh, npm publish, git commit, or git push. End with the operator
verification, release, and Podverse bump commands from the plan.
Do not run the test suite.
When the plan is done, move 02-partytime-raw-description.md (in the Podverse repo) to
.llm/plans/completed/feed-description-tiers/.
```

## Phase 2

Start only after 01 and 02 are done. The Partytime release may still be pending.

- [x] **03 — Schema, ORM, and DTO fields**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/03-description-schema.md
Follow 00-EXECUTION-ORDER.md. Use the next unused app migration number (0016 unless taken).
Every new DTO field is optional. Set both readiness markers.
Run make db_regen_linear_baseline and make db_verify_linear_baseline yourself.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 03-description-schema.md to
.llm/plans/completed/feed-description-tiers/.
```

## Phase 3

Start only after 03 is done. Run all three. Wait for all three.

- [x] **04 — Parser tier wiring, reparse job, backfill**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/04-parser-tier-wiring.md
Follow 00-EXECUTION-ORDER.md. A description never fails a parse. Write telemetry only when
the parse succeeds. The backfill CronJob stays suspended in base. Do not edit
management-api or apps/api.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 04-parser-tier-wiring.md to
.llm/plans/completed/feed-description-tiers/.
```

- [x] **05 — Management tier controls**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/05-management-tier-controls.md
Follow 00-EXECUTION-ORDER.md. Schedule a reparse only when the tier value changes. Build the
options from DESCRIPTION_LENGTH_TIERS; never hardcode lengths. Update the management
OpenAPI spec. Write all four locales in management originals.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 05-management-tier-controls.md to
.llm/plans/completed/feed-description-tiers/.
```

- [x] **06 — API description contract**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/06-api-description-contract.md
Follow 00-EXECUTION-ORDER.md. List responses keep value; do not narrow them here. Update
apps/api/openapi.yml. Write all four locales in consumer originals, title case for chrome.
Do not edit web, mobile, or management.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 06-api-description-contract.md to
.llm/plans/completed/feed-description-tiers/.
```

## Phase 4

Start only after 04, 05, and 06 are done. Run both. Wait for both before the cumulative
commands.

- [x] **07 — Web previews and truncation notice**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/07-web-description-preview.md
Follow 00-EXECUTION-ORDER.md. Rows use getDescriptionPreviewText. Show the notice only when
the description is shortened. Do not edit the catalog, the seed, or mobile.
Do not run the test suite. End with the operator verification commands from the plan.
When the plan is done, move 07-web-description-preview.md to
.llm/plans/completed/feed-description-tiers/.
```

- [x] **08 — Mobile previews, show notes cache, offline notes**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/08-mobile-description-cache.md
Follow 00-EXECUTION-ORDER.md. Never block first paint. Every new DTO field is optional on
read; do not rewrite payload rows already on phones. Use the next unused SQLite version.
Do not edit the catalog, the seed, web, or the API.
Do not run the test suite. End with the operator verification commands from the plan, then
the cumulative commands below. Say they should be run only after 07 is also done.
When the plan is done, move 08-mobile-description-cache.md to
.llm/plans/completed/feed-description-tiers/. Do not archive 00-SUMMARY.md,
00-EXECUTION-ORDER.md, COPY-PASTA.md, or 09.

Cumulative verification for 01 through 08, after 07 and 08 are both done. Give one fenced
block per tab. API tests need make test_deps (Postgres 5732, Valkey 6679). Do not set
E2E_API_GATE_MODE. Mobile Maestro needs Mobile E2E Metro, Mobile E2E API, Mobile E2E
test-assets, and Mobile E2E iOS / Mobile E2E Android already running.

Root:
npm run build:packages
npm run lint
npm run test:unit
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
make e2e_test_web_report_spec SPEC=e2e/episode-show-notes.spec.ts,e2e/about-summary-people.spec.ts
make e2e_test_management_web_report_spec SPEC=e2e/feeds-flag-status.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile:
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed

Mobile Maestro:
npm run mobile:e2e:test -- show-notes
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

## Phase 5

01–08 are done. Run 09 now. It ships in the same alpha deploy as the rest of this set.
Nobody is testing alpha, and the app database can be wiped, so there is no store-build wait.
Alpha rollout steps are in [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). Run them after 09
is in the tree, as one deploy.

- [x] **09 — Narrow list payloads**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/feed-description-tiers/09-narrow-list-payloads.md
Follow 00-EXECUTION-ORDER.md. No installed client depends on list responses still
including value. Every server reader of value either goes through a detail path or
selects the column explicitly. Do not hide missing values with empty-string fallbacks.
Update apps/api/openapi.yml.
Do not run the test suite. End with the whole-set verification commands from the plan.
When the plan is done, move 09-narrow-list-payloads.md to
.llm/plans/completed/feed-description-tiers/.
```

## After phase 5

When 09 is done and the whole-set commands have been run, archive the set. The numbered plans
are already in `completed/feed-description-tiers/`, so move the remaining three files. **Root**:

```bash
mv .llm/plans/active/feed-description-tiers/00-SUMMARY.md .llm/plans/completed/feed-description-tiers/
mv .llm/plans/active/feed-description-tiers/00-EXECUTION-ORDER.md .llm/plans/completed/feed-description-tiers/
mv .llm/plans/active/feed-description-tiers/COPY-PASTA.md .llm/plans/completed/feed-description-tiers/
rmdir .llm/plans/active/feed-description-tiers
```
