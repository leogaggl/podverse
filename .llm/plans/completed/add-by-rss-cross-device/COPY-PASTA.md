# Add by RSS across devices — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
2. Copy the fenced block only, paste, and the agent runs it.
3. Tick the box when that prompt is done.

**Self-check trial.** Each prompt type-checks and unit-tests what it changed before handing back
([plan-self-check](/.cursor/prompts/plan-self-check.md)). It skips API integration, E2E, and
Maestro, so the cumulative verification at the end still runs everything. 08 also closes the set.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- |
| 01 | Opus 5.5 | high | Playback reconciliation; easy to reintroduce a swap |
| 02 | Cursor Grok 4.7 | high | Shared UI and SCSS with a clear spec |
| 03 | Opus 5.5 | high | Destructive migration, JS-to-SQL hash parity, cross-surface id |
| 04 | Opus 5.5 | high | Native playback recording, offline outbox, device data |
| 05 | Codex 5.3 | high | Worker, ORM, and web against a precise contract |
| 06 | Opus 5.5 | high | In-place metadata upgrade without reloading audio |
| 07 | Codex 5.3 | high | Error state across player files and an i18n layer move |
| 08 | Codex 5.3 | high | SSRF-sensitive route with a clear spec |
| Close | (in 08) | — | 08 archives the set and gives the cumulative verification |

If a Cursor Grok 4.7 or Codex 5.3 prompt stalls or makes the same mistake twice, rerun it one
tier up. Escalate to **Opus 5.5** when the failure is a design question.

## Phase 1

01 and 02 can run at the same time in separate chats.

- [x] **01 — Web: never swap a different item into the player**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/01-web-queue-head-swap-fix.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md. Web only.
The automatic queue head effect must never load an item whose identity differs from the one the
player holds. Do not change resolveHandoffDecision.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 01-web-queue-head-swap-fix.md to
.llm/plans/completed/add-by-rss-cross-device/ and leave the rest of the set in active/.
```

- [x] **02 — Center the placeholder artwork everywhere**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/02-placeholder-centering.md
Follow 00-EXECUTION-ORDER.md. Edit packages/ui image components and the new spec only.
Caller classes stay on the outer element; centering must not depend on its display value.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 02-placeholder-centering.md to
.llm/plans/completed/add-by-rss-cross-device/.
```

## Phase 2

Start only after 01 and 02 are both done.

- [x] **03 — Same Add by RSS id on every device**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/03-add-by-rss-identity-feed-url-guid.md
Follow 00-EXECUTION-ORDER.md. Do not edit apps/mobile.
The legacy hash input must stay byte for byte. The SQL function must match JSON.stringify key
order and escaping, and a DB-backed test must prove it.
Use the next unused app migration number. Set both readiness markers.
Run make db_regen_linear_baseline and make db_verify_linear_baseline yourself.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 03-add-by-rss-identity-feed-url-guid.md to
.llm/plans/completed/add-by-rss-cross-device/.
```

## Phase 3

Start only after 03 is done. 04 and 05 can run at the same time in separate chats.

- [x] **04 — Mobile records Add by RSS playback**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/04-mobile-add-by-rss-playback-recording.md
Follow 00-EXECUTION-ORDER.md. Edit apps/mobile, detail doc 745, and its master plan row only.
Do not edit the catalog, the seed, web, the API, or packages/. Livestream still records nothing.
Read 03's final message for any mobile guid form it flagged.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 04-mobile-add-by-rss-playback-recording.md to
.llm/plans/completed/add-by-rss-cross-device/.
```

- [x] **05 — Real names right away, parsing without asking**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/05-auto-parse-and-follow-row-backfill.md
Follow 00-EXECUTION-ORDER.md. Do not edit apps/mobile, the catalog, the seed, or the player.
Reuse the existing channel title and image selection; do not write a third copy.
Background refresh is membership-checked and runs at most every 30 minutes per account.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 05-auto-parse-and-follow-row-backfill.md to
.llm/plans/completed/add-by-rss-cross-device/.
```

## Phase 4

Start only after 04 and 05 are both done.

- [x] **06 — Web resumes an Add by RSS episode started on another device**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/06-web-cross-device-hydration.md
Follow 00-EXECUTION-ORDER.md. Web and parser-mapping only.
A metadata upgrade must never reload the media element or move the position.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 06-web-cross-device-hydration.md to
.llm/plans/completed/add-by-rss-cross-device/.
```

## Phase 5

Start only after 06 is done.

- [x] **07 — Web playback errors, matching mobile**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/07-web-playback-error-state.md
Follow 00-EXECUTION-ORDER.md. Write every catalog key in en-US, es, fr, and el-GR originals.
Never edit overrides/. Move keys between layers without changing their values.
An error never advances the queue or loads another item.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 07-web-playback-error-state.md to
.llm/plans/completed/add-by-rss-cross-device/.
```

## Phase 6

Start only after 07 is done.

- [x] **08 — Play and show media from hosts that block websites at a redirect**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-cross-device/08-blocked-host-resolution.md
Follow 00-EXECUTION-ORDER.md. The route returns a URL, never media bytes. Validate every hop,
including DNS. Never send or accept credentials. Use fetchWithTimeout on the server and
request from @podverse/helpers-requests in the browser; no raw fetch.
Run the self-check in .cursor/prompts/plan-self-check.md. End with the operator verification commands from the plan.
When the plan is done, move 08-blocked-host-resolution.md to
.llm/plans/completed/add-by-rss-cross-device/. Then, in this same turn, run the Close steps
from the Close section of this COPY-PASTA.md: archive the set and end with its cumulative
verification instead of 08's own commands.
```

## Close

08 runs these steps at the end of its turn. Paste this only if 08 stopped before closing.

- [x] **Close — archive the set, cumulative verification** (done by 08)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Close the plan set .llm/plans/active/add-by-rss-cross-device/.
Confirm 01 through 08 are in .llm/plans/completed/add-by-rss-cross-device/. Move
00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, then remove the empty active
directory. Change no code.
End with the cumulative verification for the whole set below. Give one fenced block per tab.
API tests need make test_deps (Postgres 5732, Valkey 6679). Do not set E2E_API_GATE_MODE.
Mobile Maestro needs Mobile E2E Metro, Mobile E2E API, Mobile E2E test-assets, and
Mobile E2E iOS / Mobile E2E Android already running. Tell the operator to push infra/k8s/
changes to the Argo CD tracked branch, and that mobile changes ship in the next store build.

Root:
npm run i18n:validate
npm run i18n:compile
npm run build:packages
npm run lint
npm run test:unit
npm run build -w apps/workers
npm run build -w tools/test-assets
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/management-api
make e2e_test_web_report_spec SPEC=e2e/media-player-addbyrss-no-swap.spec.ts,e2e/media-player-addbyrss-resume.spec.ts,e2e/media-player-addbyrss-cross-device.spec.ts,e2e/media-player-playback-error.spec.ts,e2e/media-player-blocked-host.spec.ts,e2e/media-player-foundation.spec.ts,e2e/image-placeholder-centering.spec.ts,e2e/header-image-lightbox.spec.ts,e2e/header-image-livestream.spec.ts,e2e/add-by-rss-auto-parse.spec.ts,e2e/add-by-rss-credentials-add.spec.ts,e2e/add-by-rss-credentials-partial-row.spec.ts,e2e/add-by-rss-credentials-media-message.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile:
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed

Mobile Maestro:
npm run mobile:e2e:test -- playback-multi-device-handoff
npm run mobile:e2e:test -- playback-offline-reconciliation
npm run mobile:e2e:test -- add-by-rss
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?

## After close

Rollout is in [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). On alpha, repeat the original
test with the Muse AI feed: play on the phone, open web, confirm the mini player shows that
episode at the phone's position, artwork loads, and playback works.
