# Popularity Tracking rebuild — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger, decisions, and
deferred work: [00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run popularity-tracking-rebuild`. It runs one fresh agent per prompt on
that prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run popularity-tracking-rebuild --resume 'Your answer.'`. The script
passes `--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase
share no file, and none of them writes the release scratchpad: each puts its entry in its final
message, and prompt 19 appends them. Running them one after the other is also correct.

Start Docker before Phase 1 and keep it running for Phase 12: plans 10 and 19 regenerate the
linear baseline archives.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 12, 21, 30 | 10 Opus 5.5 high; 12, 21, 30 Cursor Grok 4.7 high |
| 2 | 11, 20, 61, 80 | 11 Cursor Grok 4.7 extra high; 20 Cursor Grok 4.7 high; 61 Cursor Grok 4.7 medium; 80 Cursor Grok 4.7 extra high |
| 3 | 31, 40, 60, 91 | 31 Opus 5.5 extra high; 40 Cursor Grok 4.7 medium; 60, 91 Cursor Grok 4.7 high |
| 4 | 32, 41 | Opus 5.5 high |
| 5 | 70, 81, 82 | 70 Opus 5.5 high; 81 Cursor Grok 4.7 extra high; 82 Opus 5.5 high |
| 6 | 71 | Cursor Grok 4.7 extra high |
| 7 | 42, 90 | 42 Opus 5.5 high; 90 Cursor Grok 4.7 high |
| 8 | 50, 92, 94 | 50, 92 Cursor Grok 4.7 high; 94 Cursor Grok 4.7 extra high |
| 9 | 72, 93, 95 | 72 Cursor Grok 4.7 high; 93, 95 Opus 5.5 high |
| 10 | 43, 51 | 43 Cursor Grok 4.7 high; 51 Opus 5.5 high |
| 11 | 83 | Cursor Grok 4.7 medium |
| 12 | 19 | Opus 5.5 high |

Why the expensive ones: 10 and 19 are destructive schema migrations with the listener-id privacy
layer; 31 is the write path's concurrency (per-listener lock, consent re-read, daily first-of-day
checks) that every reader builds on; 32 is entitlement, rate limit, and the request contract both
clients use; 41 and 42 are partition and range-total jobs other plans lock against; 70 is the
opt-out deletion race; 82 is the mobile outbox's persisted data; 51 is the channel merge's
overlap removal and journal; 93 and 95 are the Taste Profile screens' open UI behavior. Fast stays
off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [ ] **10 — Schema foundation: listener id, listen and open events, daily and range totals, taste rows**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/10-stats-foundation-schema.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md § Review of the first
planning pass (one clock: server receive time; no compatibility paths or data migrations).
List the app migrations directory first and use the next free number; 0021 is already taken.
Move the marker in both api.env and the podverse-ops-migration-scripts generator in
infra/k8s/base/ops/kustomization.yaml. Run make db_regen_linear_baseline and
make db_verify_linear_baseline yourself. If Docker is not available, finish the rest of the plan,
leave the archives untouched, and report BLOCKED asking the operator to start Docker.
Create docs/features/POPULARITY-TRACKING.md with the section headings later plans fill.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 10-stats-foundation-schema.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed (including the migration file name),
self-check results, any blocker, and anything a later prompt needs.
```

- [ ] **12 — Listener-id separation guard: lint rule, source-guard test, rule file**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/12-listener-id-separation-guard.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Only the listener entity and packages/orm/src/services/stats/listenerIdentity/ may name the
listener mapping table; tests and migrations are exempt, exactly as the plan lists. Later plans
create files under listenerIdentity/, so the guard must pass on a tree where that directory holds
only plan 11's file.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 12-listener-id-separation-guard.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **21 — Terms: Popularity Tracking section**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/21-terms-section.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
The terms version stays 2026-10-15. Copy never calls the listener id anonymous or anonymized in
any locale.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 21-terms-section.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **30 — Counted-listen rule and taste score helper**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/30-counted-listen-rule-helper.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
60 seconds or 25% of the item, whichever comes first. Ship the @podverse/helpers/popularityListen
subpath export; plan 80 imports it from playback-core and plans 31 and 51 use the half-life
constants.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 30-counted-listen-rule-helper.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [ ] **11 — ORM entities, listener mapping service, range lookback helper**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/11-stats-foundation-orm.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Match the tables plan 10 created in the tree (read its migration, not only the plan). The listen
event entity has no listened_at column. Keep the old stats entities and exports; plan 19 removes
them.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 11-stats-foundation-orm.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **20 — Explanation text and agreement version**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/20-explanation-and-version.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
The explanation version becomes 2026-10-21. In api.env and web-sidecar.env edit only the version
keys; plan 10 already moved the migration marker in api.env, and plan 40 changes retention later.
Copy never calls the listener id anonymous or anonymized.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 20-explanation-and-version.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **61 — Management database browser lists the popularity tables**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/61-management-stats-browser.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
tablePolicy.ts must not contain the text stats_listener; plan 12's source-guard test fails if it
does. Tests may name it.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 61-management-stats-browser.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **80 — Listen session tracker in playback-core, wired into web and mobile playback**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/80-listen-session-tracker.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Import the counted-listen rule from @podverse/helpers/popularityListen (plan 30). This plan sends
nothing; plans 81 and 82 wire the senders into the same orchestrator and PlaybackProvider after
you, so leave clear seams. PlaybackProvider.tsx is large: Grep the anchors the plan names.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 80-listen-session-tracker.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [ ] **31 — Listen and open write services**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/31-listen-and-open-write-services.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (server receive time is the
only clock; no listened_at anywhere).
Only listenerIdentity/ reads the listener mapping; exported services take an account_id and never
return a listener id. Re-read consent FOR SHARE before creating a listener id. Keep the write
order the plan fixes (event, item daily, channel daily, taste rows); plan 51 locks in that order.
Plan 70 reuses your listener lock helper, so keep it exported from listenerIdentity/ and keyed
'popularity_listen:' || listener_id.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 31-listen-and-open-write-services.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed (including the lock helper's file and
name), self-check results, any blocker, and anything a later prompt needs.
```

- [ ] **40 — Retention setting: 90 days**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/40-retention-setting-90-days.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
The env name STATS_TRACK_EVENT_RETENTION_DAYS stays; only its value moves to 90. In api.env and
web-sidecar.env edit only that key; plans 10 and 20 edited other keys before you.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 40-retention-setting-90-days.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **60 — Management stats page reads the popularity tables**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/60-management-stats-ranges.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
range accepts day, week, month, and all-time; 7day, 30day, and 1year answer 400. In the four
management catalogs edit only the statsPage key. apps/management-api/openapi.yml is large: Grep
the anchors the plan names.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 60-management-stats-ranges.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **91 — Taste Profile E2E seed accounts**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/91-taste-profile-e2e-seed.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
The two accounts are dedicated; do not reuse e2e-user. Seed against the tables plan 10 created
and the agreement version plan 20 set, as they stand in the tree. Keep plan 20's edits in
tools/web/seed-e2e.mjs.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 91-taste-profile-e2e-seed.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [ ] **32 — Listen and open API routes, rate limit, daily cap**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/32-listen-and-open-api.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D14: the five old routes
are removed; D19: 200 with daily_cap_reached; no listened_at in the request).
Name the request body type StatsListenRequestBody and export reqStatsListen and reqStatsOpen from
the helpers-requests package root; plans 81 and 82 build on those names. Leave the five
reqStatsTrack* functions in place; plan 83 removes them. In api.env edit only the keys your plan
adds. apps/api/openapi.yml is large: Grep the stats paths.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 32-listen-and-open-api.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **41 — Monthly partition job for listen and open events**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/41-event-partitions-job.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D21: whole months only).
Workers never name the listener mapping table. Plans 42 and 43 edit the workers registry,
command index, categories, package.json, ENV.md, and the cron kustomization after you; make
targeted insertions.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 41-event-partitions-job.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

- [ ] **70 — Opt-out deletes listening data; involuntary stops pause**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/70-opt-out-deletes-listening-data.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D34: no confirmation flag
on the server; D5: opt-out deletes the listener row and cascades).
Plan 31 already added the listener lock helper: search 'popularity_listen:' under
packages/orm/src/services/stats/listenerIdentity/ and reuse it. Create listenerLock.ts only if no
helper exists. Lock the account_settings row and delete the listener row in one transaction.
apps/api/openapi.yml is large: edit only the PATCH /account-settings/listen-stats description.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 70-opt-out-deletes-listening-data.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **81 — Web sends listen reports and profile and playlist opens**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/81-web-listen-and-open-reports.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D44: no retry; no
listened_at).
Use plan 32's reqStatsListen and reqStatsOpen and plan 80's session tracker as they stand in the
tree. Keep plan 80's edits in NonLiveMediaOrchestrator.tsx. Do not edit
apps/web/src/contexts/Account.tsx.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 81-web-listen-and-open-reports.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **82 — Mobile listen outbox and sender**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/82-mobile-listen-outbox.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D45, D46; no listened_at).
Use SQLite migration 24 unless the tree already has it; then take the next free version and say
so. Do not rename listen_stats_* fields. Keep plan 80's edits in PlaybackProvider.tsx; the file is
large, so Grep the anchors the plan names.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 82-mobile-listen-outbox.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [ ] **71 — Taste Profile API: list, hidden list, hide, unhide**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/71-taste-profile-api.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D35–D38).
Routes need an account, not a membership or consent. Responses never carry a listener id. Reuse
the listener lock helper plan 70 used; do not add a second one. Keep plans 32 and 70's edits in
apps/api/openapi.yml and _request.ts; openapi.yml is large, so Grep the account paths.
You run alone in this phase. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 71-taste-profile-api.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

- [ ] **42 — Range totals refresh job, hourly and nightly**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/42-popularity-refresh-job.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D22).
Keep the per-type lock key 'popularity_refresh:' || <type> and full mode rebuilding every past
day; plan 51 relies on both. Do not create files at
packages/orm/src/services/stats/popularity/statsPopularity<Type>.ts or reuse the class names
StatsPopularity<Type>Service; plan 50 owns them. Keep plan 41's edits in the workers registry,
command index, categories, package.json, ENV.md, APPS-WORKERS.md, and the cron kustomization.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 42-popularity-refresh-job.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **90 — Taste Profile copy and paging helper**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/90-taste-profile-copy-and-paging-helper.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D51, D52).
Section names match plan 20's explanation in every locale. Write every new consumer key in
en-US, es, fr, and el-GR originals, with no empty strings; the catalogs are large, so Grep the key
prefix. Plans 92 to 95 use these keys.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 90-taste-profile-copy-and-paging-helper.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 8

- [ ] **50 — Public range sorts read the popularity tables**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/50-public-popularity-readers.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D28).
packages/orm/src/services/item/item.ts is large: Grep the StatsAggregated anchors the plan names.
Keep the old StatsAggregated* ORM services in place; plan 19 deletes them.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 50-public-popularity-readers.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **92 — Web opt-out warning**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/92-web-opt-out-warning.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D52).
Show the warning whenever isPopularityTrackingOptOutDestructive (plan 70) is true, including No
Thanks on the prompt for a new version. Use plan 90's catalog keys and plan 91's stale account.
Plan 93 builds the Taste Profile sections on this settings panel after you.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 92-web-opt-out-warning.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **94 — Mobile opt-out warning**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/94-mobile-opt-out-warning.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D52, D53).
Settings uses a dialog; the consent prompt confirms inside its own screen. Match the web wording
from plan 90's keys. Plan 95 edits ConfirmDialog.tsx and the Popularity Tracking screen after
you; make targeted edits.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 94-mobile-opt-out-warning.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 9

- [ ] **72 — Account data export includes listening data**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/72-data-export-listening-data.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D39).
Exported listen records carry the stored created_at, not listened_at. The export never contains a
listener id.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 72-data-export-listening-data.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **93 — Web Taste Profile and Hidden From Taste Profile sections**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/93-web-taste-profile-sections.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D48–D51).
Rows are plain text, not links. Remove acts at once; Unhide asks between Add to Taste Profile and
Only Remove From Hidden List. Use plan 71's request helpers and plan 90's keys and paging helper.
Keep plan 92's edits in the settings panel.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 93-web-taste-profile-sections.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **95 — Mobile Taste Profile and Hidden From Taste Profile sections**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/95-mobile-taste-profile-sections.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D48–D51, D55).
Match the web sections from plan 93's plan. The Maestro flow changes nothing on the server. Keep
plan 94's edits in ConfirmDialog.tsx and MoreSettingsPopularityTrackingScreen.tsx.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 19
appends it.
When the plan is done, move 95-mobile-taste-profile-sections.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 10

- [ ] **43 — Dev seed writes daily totals**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/43-dev-seed-daily-totals.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
The root script name stays. Keep plans 41 and 42's edits in the workers registry, command index,
categories, package.json, and ENV.md.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 43-dev-seed-daily-totals.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **51 — Channel merge moves popularity data and removes same-day overlap**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/51-channel-merge-popularity-data.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D24, D25, D27, and the
D26 change: remove same-day listener overlap for days inside retention, sum older days unchecked,
journal daily and range rows so revert is exact). D56 in 00-SUMMARY.md stands: range totals are
left to plan 42's refresh job.
Read plan 31's write order and plan 42's lock key in the tree before writing the merge's locks.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 19 appends it.
When the plan is done, move 51-channel-merge-popularity-data.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 11

- [ ] **83 — Remove the legacy stats request helpers**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/83-remove-legacy-stats-requests.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Search the tree for reqStatsTrack first; if any caller remains outside the files you own, stop
and report it. Keep plans 32 and 71's edits in _request.ts.
You run alone in this phase. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 83-remove-legacy-stats-requests.md to
.llm/plans/completed/popularity-tracking-rebuild/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs. Prompt 19 runs next and closes the set.
```

## Phase 12

- [ ] **19 — Drop the legacy stats tables and code; then archive the set**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-tracking-rebuild/19-remove-legacy-stats.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (no compatibility paths or
data migrations; the drop of the old tables stays).
Use the next free app migration number after plan 10's. Move the marker in both api.env and the
podverse-ops-migration-scripts generator in infra/k8s/base/ops/kustomization.yaml. Run
make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest, leave the archives untouched, and report BLOCKED asking the operator
to start Docker. If any caller of the old stats code remains outside your files, stop and report
it. Plan 43 already deleted simulatedAggregatedStats.ts and its test.
Do not run tests. Append the plan's release scratchpad entry.

Before your own entry, append to release-notes/scratchpad.md every "Release notes entry" from
the final messages of prompts 10, 21, 20, 61, 40, 60, 32, 41, 70, 81, 82, 71, 42, 50, 92, 94, 72,
93, 95, and 51 in .artifacts/plan-runner/popularity-tracking-rebuild/ (10.md, 21.md, …), in that
order, unchanged. Skip one that already appears in the scratchpad.

Then write .llm/plans/active/popularity-tracking-rebuild-deferred/00-SUMMARY.md from the
"Deferred" section of 00-SUMMARY.md: each gap, why it waits, and the questions to settle first.

Then close the set. Confirm every other numbered plan is in
.llm/plans/completed/popularity-tracking-rebuild/. Move 19-remove-legacy-stats.md,
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory. If prompt 10 reported the linear baseline archives were not regenerated,
put make db_regen_linear_baseline first in the Root block.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that
Docker, Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must be
running, and that Mobile E2E API must be restarted after make local_env_setup and the package
build, because the API now requires the new rate-limit and daily-cap settings and serves the new
listen, open, and Taste Profile routes. Do not put leave-running commands in the blocks. Say that
no plan added a dependency, so no lockfile update is needed. Name the operator steps the release
entries carry: run the partition job once by hand after the first deploy (plan 41's entry), and
update STATS_TRACK_EVENT_RETENTION_DAYS in the home legal.env (plan 40's entry). Alpha's GitOps
values are already 90 and go out with the alpha ref bump.

Root:
make local_env_setup
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run test:unit
npm --prefix apps/mobile run test
make db_verify_linear_baseline
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/web
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/workers
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
make e2e_test_report_scoped WEB_SPEC=e2e/popularity-tracking-consent.spec.ts,e2e/settings-taste-profile.spec.ts,e2e/terms-version-acceptance.spec.ts,e2e/media-player-foundation.spec.ts,e2e/media-player-clip-soundbite-end-pause.spec.ts,e2e/media-player-music-playback.spec.ts,e2e/playlist-edit-play.spec.ts,e2e/seo-profile-sharable-status.spec.ts MGMT_SPEC=e2e/stats-page.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- popularity-tracking,taste-profile,terms-popularity
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
