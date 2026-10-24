# First-deploy squash — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run first-deploy-squash`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run first-deploy-squash --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase share no
file, and none of them writes the release scratchpad: each puts its entry in its final message,
and Close appends them. Running them one after the other is also correct.

**Before Phase 1, start Docker.** Plan 10 runs the squash script and the baseline generator
against a throwaway Postgres. No agent connects to a cluster or drops a real database; Close hands
the operator the wipe commands.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 11, 12, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 40, 41, 50, 51, 60, 61, 62, 70, 71, 72, 73, 80, 81, 90 | 10 and 20 Opus 5.5 high; 22 Cursor Grok 4.7 extra high; 12, 21, 31, 32, 60, 70, 71, 73 Cursor Grok 4.7 high; 35, 36 Cursor Grok 4.7 low; the rest Cursor Grok 4.7 medium |
| 2 | 37, 38, 52, 82 | 38 Cursor Grok 4.7 extra high; 37, 52, 82 Cursor Grok 4.7 medium |
| 3 | Close | Cursor Grok 4.7 medium |

Why the expensive ones: 10 and 20 are destructive schema squashes (Postgres and on-device SQLite)
that every later database and install depends on. 22 and 38 change what CarPlay and Android Auto
read with the app closed. 38 also edits Swift and Kotlin; it is a deletion with exact anchors, so
it stays on Cursor Grok 4.7 at extra high. Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — Squash the Postgres app and management chains**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/10-postgres-squash.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D2, D3, D6, D8).
Docker must be running. No other prompt in this phase edits scripts/database/**,
infra/k8s/base/ops/source/**, or infra/k8s/base/db/**. Use only the throwaway Postgres the
scripts start; connect to no cluster and drop no other database. If the fixed-point check or the
baseline diff shows any schema change, stop and report BLOCKED with the diff. Delete files with
rm; no git writes.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 10-postgres-squash.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, whether both .gz
baselines were regenerated, any blocker, and anything a later prompt needs.
```

- [x] **11 — Migration contract docs and guidance after the squash**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/11-migration-contract-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D3, D7).
Write the chains as 0000 + 0001 per database and the markers as the 0001 filenames, as
00-SUMMARY.md § Fixed facts settles; plan 10 produces them in this same phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 11-migration-contract-docs.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **12 — Reset paths drop every app schema; database tooling sweep**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/12-wipe-paths-and-database-tooling.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D4, D5).
Do not edit infra/k8s/base/ops/kustomization.yaml, scripts/database/**,
infra/k8s/base/ops/source/**, or infra/k8s/base/db/**; plan 10 owns or runs them in this phase.
Delete with rm; no git writes.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 12-wipe-paths-and-database-tooling.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **20 — Squash the mobile SQLite chain into one first migration**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/20-mobile-sqlite-squash.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D9, D10).
The squashed migration is version 1. A database whose user_version is above the latest migration
fails at open with the reinstall message. Do not edit schema.ts or db/index.ts; plans 23 and 21
edit them in this phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 20-mobile-sqlite-squash.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **21 — Remove the one-time Add by RSS repair passes from database open**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/21-mobile-add-by-rss-open-passes.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Do not edit apps/mobile/src/lib/addByRss/** or apps/mobile/vitest.config.ts; plan 37 removes the
helpers your change leaves unused.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 21-mobile-add-by-rss-open-passes.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **22 — Stop writing the single-file queue snapshot to the native cache**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/first-deploy-squash/22-native-cache-single-queue-file.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D11).
Do not edit the bridge, the media-engine module, or native code; plan 38 removes
writeQueueSnapshot there after you. NATIVE_CACHE_SCHEMA_VERSION stays 2.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 22-native-cache-single-queue-file.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **23 — Mobile data layer comments, README, and guidance**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/23-mobile-data-comments-and-readme.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Do not edit migrations.ts, runMigrations.ts, or db/index.ts; plans 20 and 21 edit them in this
phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 23-mobile-data-comments-and-readme.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **30 — Drop unread Home and Library source-filter prefs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/30-drop-unread-device-prefs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Do not edit apps/mobile/src/prefs/downloadPrefs.ts; plan 31 edits it in this phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 30-drop-unread-device-prefs.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **31 — Stored downloads are a file name**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/31-stored-download-file-name.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Natively, edit only PodverseCarPlaySceneDelegate.swift and PodverseMediaLibraryService.kt; plan 32
edits PodverseNativeCache.swift and PodverseNativeCache.kt in this phase. Keep
downloadsRepository.backfillMissingChannelTitles and its caller.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 31-stored-download-file-name.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **32 — Library cache file is library-index.json**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/32-native-cache-library-filename.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D11).
Change only the library file and its docs. Keep the queueAv / QUEUE_AV fallback and every
queue-snapshot line; plan 38 removes them after plan 22.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 32-native-cache-library-filename.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **33 — Auto-download doc names tables, not old migration files**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/33-auto-download-doc-names.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 33-auto-download-doc-names.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **34 — Share links read EXPO_PUBLIC_MOBILE_WEB_BASE_URL only**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/34-drop-web-base-url-fallback.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
In apps/mobile/vitest.config.ts add only your include line; plan 37 edits that file after you.
Keep the podverse deep-link scheme (v4). Do not edit .cursor/rules/mobile-deep-links-and-prod-cutover.mdc;
plan 82 fixes it after you.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 34-drop-web-base-url-fallback.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **35 — Remove the unused getPrimaryQueue wrapper**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

```
Read and execute .llm/plans/active/first-deploy-squash/35-unused-primary-queue-export.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 35-unused-primary-queue-export.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **36 — Debug panel subtitle does not cite a plan step**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

```
Read and execute .llm/plans/active/first-deploy-squash/36-debug-panel-plan-citation.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 36-debug-panel-plan-citation.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **40 — API membership env docs drop numbered migrations**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/40-api-membership-env-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 40-api-membership-env-docs.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **41 — API comments that narrate an older v5 schema**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/41-api-older-schema-comments.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D12, D13).
Keep every test assertion and the second Add by RSS hash lookup; only titles, labels, local names,
and comments change.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 41-api-older-schema-comments.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **50 — Shared package comments drop migration and plan citations**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/50-shared-package-comment-citations.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D12, D13, D15, D16).
queueResource.ts is large: Grep findAddByRssQueueResource and replace only the doc comment above
it. Do not edit packages/orm/src/services/feed/feedForceReparseScheduler*; plan 52 owns them.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 50-shared-package-comment-citations.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **51 — Add by RSS channel art reads channel_images only**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/51-drop-channel-image-url-fallback.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Do not edit the web seed or web specs that still send channel_image_url; they also send
channel_images.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 51-drop-channel-image-url-fallback.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **60 — Remove the description preview backfill**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/60-remove-description-backfill.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D0, D17, D18).
Remove ormDescriptionsBackfill and its suspended cron. Keep ormVerifiedPublisherLinksBackfill.
Do not edit packages/orm; plan 52 drops the description_backfill reason after you.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 60-remove-description-backfill.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **61 — Rewrite upgrade-only prose in workers, cron comments, and infra docs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/61-workers-infra-upgrade-prose.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D18).
Do not edit infra/k8s/INFRA-K8S.md; plan 11 edits it in this phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 61-workers-infra-upgrade-prose.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **62 — Stop local env setup from upgrading an older checkout**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/62-local-env-drop-upgrade-path.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D19).
Keep make local_env_export_secrets_to_home. Do not edit docs/development/env/LOCAL-ENV-OVERRIDES.md;
plan 82 fixes it after you. Delete with rm; no git writes.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 62-local-env-drop-upgrade-path.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **70 — Cookie banner reads only the current consent shape**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/70-cookie-consent-shape.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D20).
Older consent cookies are ignored. Do not edit the localSettings sba, pmt, or bae tests; plan 73
edits them in this phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 70-cookie-consent-shape.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **71 — Embed builder accepts only the type values it writes**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/71-embed-builder-type-query.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D21).
Older builder type values are ignored. Do not edit buildEmbedIframeCode.test.ts (plan 73) or
docs/features/EMBED-PLAYER.md (plan 82, after you).
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 71-embed-builder-type-query.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **72 — Remove unused shared-UI aliases**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/72-unused-ui-aliases.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Do not edit packages/ui/src/styles/**; plan 73 edits _variables-root.scss in this phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 72-unused-ui-aliases.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **73 — Web comments and the livestream section that describe an older v5 state**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/first-deploy-squash/73-web-comments-and-livestream-doc.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D22, D23).
Comments and titles only: the Add by RSS IndexedDB version stays 8, and web still matches the
hash that omits feed_url. Do not edit localSettings.ts, localSettings.cc.test.ts (plan 70), or
the embed files plan 71 lists.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 73-web-comments-and-livestream-doc.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **80 — Drop upgrade-only steps from feature docs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/80-drop-upgrade-only-feature-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 80-drop-upgrade-only-feature-docs.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **81 — Training scripts drop deleted migration files**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/81-aicasts-drop-migration-rollout.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D24).
Edit the four scripts only; this set generates no audio.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 81-aicasts-drop-migration-rollout.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, which episodes need
new audio, any blocker, and anything a later prompt needs.
```

- [x] **90 — Rewrite proposal citations of pre-squash migration numbers**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/90-proposals-migration-citations.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D25).
Keep the historical upgrade sentences that name no deleted migration file or user_version.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 90-proposals-migration-citations.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **37 — Delete the Add by RSS stored-row helpers the open passes used**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/37-add-by-rss-stored-row-helpers.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Plans 21 and 34 ran before you. In vitest.config.ts remove only the storedResourceType line and
keep plan 34's include line. If a helper still has a caller, stop and report it.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 37-add-by-rss-stored-row-helpers.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **38 — Remove the single-file queue kind from the native cache**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/first-deploy-squash/38-native-cache-single-queue-kind.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D11).
Plans 22 and 32 ran before you; re-read PodverseNativeCache.swift, PodverseNativeCache.kt, the
engine README, both spike docs, and projection.test.ts, and keep their edits. JS, iOS, and
Android lose writeQueueSnapshot and the queue / QUEUE kind together. Do not run the mobile
type-check; plan 37 edits mobile files in this phase.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 38-native-cache-single-queue-kind.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **52 — Drop the description_backfill reparse reason**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/52-drop-description-backfill-reason.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D0, D14).
Plan 60 removed the command before you. Keep description_tier_change.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 52-drop-description-backfill-reason.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **82 — Docs and guidance made false by this set's code removals**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/82-docs-false-after-sweeps.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Plans 34, 62, and 71 ran before you. Change only the three sentences and the one heading the plan
names.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 82-docs-false-after-sweeps.md to
.llm/plans/completed/first-deploy-squash/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [x] **Close — Release notes, set-wide check, archive, and the operator's verification and wipe**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/first-deploy-squash/00-EXECUTION-ORDER.md § Phase 3 — Close.
Every numbered plan has run. Do not edit product code, tests, or guidance in this prompt.

Append to release-notes/scratchpad.md, at the end and unchanged, the "Release notes entry" from
the final messages of prompts 10, 12, 20, 21, 22, 30, 31, 32, 34, 51, 60, 62, 70, 71, 80, 38,
and 52 in .artifacts/plan-runner/first-deploy-squash/ (10.md, 12.md, …), in that order. When a
final message has none, copy that plan's "## Release scratchpad" block. Skip an entry whose title
is already in the scratchpad. Never edit another entry.

Run the set-wide self-check greps in § Phase 3 (read-only) and report every unexpected hit.

Then archive: confirm every numbered plan is in .llm/plans/completed/first-deploy-squash/ (stop
and report BLOCKED naming any still in active/), move 00-REQUEST.md, 00-SUMMARY.md,
00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the empty active directory. Leave
.llm/plans/active/cross-device-playback/ alone.

End with § Final message: the cumulative verification blocks per tab exactly as listed there
(add make db_regen_linear_baseline first in the Root block if prompt 10 reported the baselines
were not regenerated), then plan 10's "## Operator wipe for the last prompt" section in full,
then plan 20's "## Operator reinstall step" section in full, then the notes. Every block is
fish-safe and labeled with its .vscode/terminals.json tab. Say plainly that no agent dropped any
database and that the operator runs the wipe.
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
