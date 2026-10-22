# Realtime and banner notifications — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run realtime-banner-notifications`. It runs one fresh agent per prompt on
that prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run realtime-banner-notifications --resume 'Your answer.'`. The script
passes `--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase
share no file, and none of them writes the release scratchpad: each puts its entry in its final
message, and prompt 53 appends them. Running them one after the other is also correct.

Before Phase 5, start Docker: plan 20 regenerates the linear baseline archives.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 11 | 10 Cursor Grok 4.7 extra high; 11 Opus 5.5 high |
| 2 | 14, 50, 51 | Cursor Grok 4.7 high |
| 3 | 13, 15, 30 | 13 Codex 5.3 high; 15 Cursor Grok 4.7 extra high; 30 Opus 5.5 high |
| 4 | 12, 31 | 12 Opus 5.5 high; 31 Cursor Grok 4.7 extra high |
| 5 | 16, 20, 40 | 16 Cursor Grok 4.7 medium; 20 Cursor Grok 4.7 extra high; 40 Opus 5.5 extra high |
| 6 | 21, 43, 52 | 21 Codex 5.3 high; 43 Cursor Grok 4.7 medium; 52 Cursor Grok 4.7 high |
| 7 | 32, 33, 41 | 32 Cursor Grok 4.7 high; 33 Cursor Grok 4.7 extra high; 41 Cursor Grok 4.7 high |
| 8 | 42 | Cursor Grok 4.7 high |
| 9 | 53 | Cursor Grok 4.7 extra high |

Why the expensive ones: 11 and 12 are the publish-after-commit fanout and the stream hub every
other prompt builds on; 30 is cross-tab leader election; 40 is the mobile stream lifecycle
(foreground, background audio, reconnect, token refresh), which is concurrency work. 13 and 21 go
to Codex 5.3 for exact ioredis subscriber use and a multi-package contract with tricky edge cases.
Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [ ] **10 — Account event stream contract**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/realtime-banner-notifications/10-notification-stream-contract.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Event types keep the notification.* names. playback.* is reserved for cross-device playback state
and control commands; neither carries an SSE id or replays, and unknown types are ignored. Only
notification.created carries an SSE id.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 10-notification-stream-contract.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **11 — Account event fanout through Redis**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/11-notification-signal-fanout.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D2, and the generic
account event stream).
Publish only after the write commits, and a publish never fails the write. @podverse/orm imports
no app Redis client: each process registers a publisher, and a write with none registered is loud.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 11-notification-signal-fanout.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [ ] **14 — Management API account event publisher**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/14-management-api-account-event-redis.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Reuse the existing podverse-keyvaldb instance and the podverse-keyvaldb-opaque secret; add no new
secret values. You are the only prompt in this phase that runs npm at the repo root.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 14-management-api-account-event-redis.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **50 — Banner notification kinds, defaults, and device prefs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/50-banner-notification-prefs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D31).
Prefs live on the device only. On by default: New Episodes and Livestream Started. Off: Livestream
Scheduled and the admin categories. Keep the Vitest glob src/notifications/bannerNotification*.test.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 50-banner-notification-prefs.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **51 — Banner notification card**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/51-banner-notification-card.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D26–D30).
The card takes title and body as props and does not import plan 50's modules. A swipe up
dismisses and never marks read; Reduce Motion skips the slide. Do not edit vitest.config.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 51-banner-notification-card.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [ ] **13 — API account event Redis connections**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/13-api-account-event-redis.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
The subscriber uses its own Redis connection, separate from the cache client in
apps/api/src/lib/keyvaldb/keyvaldb.ts. Plan 12 edits apps/api/src/index.ts and the test helpers
after you; leave clear seams for it.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 13-api-account-event-redis.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **15 — Workers account event publisher**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/realtime-banner-notifications/15-workers-account-event-redis.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Add CATEGORY_KEYVALDB only for commands that create or mark notifications, and mount the existing
podverse-keyvaldb-opaque secret on each deployment and cronjob the plan lists.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 15-workers-account-event-redis.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **30 — Web notification stream client**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/30-web-notification-stream-client.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D12, D17).
One stream per browser profile, shared across tabs, against GET /account/events. Library only,
tested with fakes; nothing renders yet.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 30-web-notification-stream-client.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [ ] **12 — API account event stream (GET /account/events)**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/12-api-notification-stream.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D3–D7, the generic
account event stream, and the second review's playback.* wording).
Login and accepted terms, no membership. A stream ends at token expiry or 30 minutes; 10 per
account per pod, then 429. Replay only events with an SSE id, capped at 50, then
notification.resync. Keep plan 13's edits in apps/api/src/index.ts and the test helpers.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 12-api-notification-stream.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **31 — Web live bell badge and cross-tab read sync**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/realtime-banner-notifications/31-web-live-bell-badge.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Web keeps the push popup and adds no toast. The 60-second poll runs only while the stream is
down. Plan 32 extends notifications-inbox.spec.ts after you and uses your stream-mock helpers;
plan 33 edits the push parts of Notifications.tsx after you.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 31-web-live-bell-badge.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

Start Docker before this phase.

- [ ] **16 — Account events architecture doc**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/realtime-banner-notifications/16-account-events-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Describe what plans 11–15 built as it stands in the tree; read their code, not only the plans.
playback.* is reserved for cross-device playback state and control commands, neither replayed.
Another prompt runs at the same time; edit only the files your plan lists. Do not run tests.
This plan appends no scratchpad entry.
When the plan is done, move 16-account-events-docs.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **20 — Per-notification read state: schema and unread rule**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/realtime-banner-notifications/20-notification-read-state-schema.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D8, D9).
Use the next free app migration number at run time: 0022 today, but the artist-album-attribution
set also plans a 0022, so if one exists, take the next number and use it in the file name and in
both markers (api.env and infra/k8s/base/ops/kustomization.yaml). Keep plan 11's edits in the ORM
notification service and plan 12's in openapi.yml. Run make db_regen_linear_baseline and
make db_verify_linear_baseline yourself. If Docker is not available, finish the rest of the plan,
leave the archives untouched, and report BLOCKED asking the operator to start Docker.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 20-notification-read-state-schema.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **40 — Mobile notification stream runtime**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/realtime-banner-notifications/40-mobile-notification-stream.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D18–D23, D35, D36, and
the second review's background-audio revision).
The stream runs over expo/fetch. It runs while signed in and the app is active, or while local
audio plays (one named backgroundAudioActive input from usePlaybackIsPlaying), and closes in the
background otherwise; inactive alone never closes it. A fresh open sends no Last-Event-ID. On
return to the foreground, resumeForeground keeps a live kept connection with no replay and no
refetch, and otherwise does the fresh open. Expose subscribeNotificationStreamEvents and
isNotificationsInboxFocused; plans 41, 42, and 53 build on them. navigation/index.tsx is large:
Grep TabScaffold. Change no playback files.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 40-mobile-notification-stream.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [ ] **21 — Mark one notification read (by id, and by push payload)**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/21-notification-mark-one-read.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D10, D11).
Success returns { marked_ids, unread_count }; an already-read row returns 200 with empty
marked_ids and sends no event; another account's id is 404. The push variant matches itemIdText
plus type. Keep plans 11, 12, and 20's edits in the files you share with them.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 21-notification-mark-one-read.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **43 — Mobile unread count on the More tab and More row**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/realtime-banner-notifications/43-mobile-notification-badges.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D25).
Keep plan 40's edits in navigation/index.tsx; the file is large, so Grep TabScaffold.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 43-mobile-notification-badges.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **52 — Banner notification settings**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/52-banner-notification-settings.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
The UI says "Banner Notifications". Write every new mobile catalog key in en-US, es, fr, and
el-GR originals, including e2e.show_banner_notification, which plan 53 calls. Append your asserts
to notifications-inbox.yaml after plan 40's steps.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 52-banner-notification-settings.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

- [ ] **32 — Web live Notifications inbox**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/32-web-live-inbox.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D13–D15).
Load the list before Mark All as Read; a row stays in the section it arrived in; new rows go only
onto page 1. Keep plan 31's stream-mock helpers in notifications-inbox.spec.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 32-web-live-inbox.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **33 — Web push tap marks that notification read; no popup on the inbox**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/realtime-banner-notifications/33-web-push-tap-marks-read.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D16).
The service worker marks a clicked push read itself, using api_base from its own script URL. The
focused tab on the Notifications page skips the popup. In Notifications.tsx edit only the push
parts and keep plan 31's stream wiring.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 33-web-push-tap-marks-read.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **41 — Mobile push tap marks that notification read**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/41-mobile-push-tap-mark-read.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Use plan 21's request helpers; a 404 means already gone, with no retry and no warning. Keep plan
40's edits in NotificationsRuntime.tsx and vitest.config.ts. Plan 53 calls
markNotificationReadById from notificationReadActions.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 53
appends it.
When the plan is done, move 41-mobile-push-tap-mark-read.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 8

- [ ] **42 — Mobile inbox shows new rows live**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/realtime-banner-notifications/42-mobile-inbox-live-rows.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D24).
New rows go on top and are marked read at once. Keep plan 40's edits in
NotificationsInboxScreen.tsx and SyncProvider.tsx, and plans 40 and 41's in vitest.config.ts.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 42-mobile-inbox-live-rows.md to
.llm/plans/completed/realtime-banner-notifications/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs. Plan 53 runs next and closes the set.
```

## Phase 9

- [ ] **53 — Show the banner, open the page, mark that notification read; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/realtime-banner-notifications/53-banner-notification-host.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D27–D34 and the second
review's no-banners-from-background answer).
Only a tap marks read and opens the page; Dismiss, a swipe, and the timer leave it unread. No
banner while the inbox is focused. A banner presents only while the app is active: an event
received in the background or while inactive enqueues nothing and is not held for later, and
waiting cards clear when the app goes to the background. Reduce Motion skips the slide and the
haptic. Add expo-haptics with npm --prefix apps/mobile exec -- expo install expo-haptics.
Register banner-notification in flow_needs_e2e_api in scripts/mobile/e2e-test.sh. Do not edit
navigation/index.tsx. Keep plans 40 and 42's edits in NotificationsInboxScreen.tsx,
SyncProvider.tsx, App.tsx, and notificationStreamStore.ts.
Do not run tests. Append the plan's release scratchpad entry.

Before your own entry, append to release-notes/scratchpad.md every "Release notes entry" from
the final messages of prompts 14, 15, 12, 31, 20, 40, 21, 43, 52, 32, 33, and 41 in
.artifacts/plan-runner/realtime-banner-notifications/ (14.md, 15.md, …), in that order,
unchanged. Skip one that already appears in the scratchpad.

Then close the set. Confirm every other numbered plan is in
.llm/plans/completed/realtime-banner-notifications/. Move 53-banner-notification-host.md,
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory. Leave .llm/plans/active/cross-device-playback/ where it is; it builds on
this set. If prompt 20 reported the linear baseline archives were not regenerated, put
make db_regen_linear_baseline first in the Root block.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that
Docker, Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must be
running, and that Mobile E2E API must be restarted after the package build so it serves
GET /account/events and the mark-one routes. Do not put leave-running commands in the blocks.
Say that expo-haptics is a native module, so the Mobile block reinstalls and prebuilds before the
E2E app installs, and that ./scripts/development/update-lockfile-linux.sh goes before committing
because plan 14 changed package-lock.json. Note that no E2E path creates a real notification, so
server-to-banner delivery stays unproven on a device (D23), and that the stream staying open in
the background while audio plays is covered by unit tests only.

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run type-check:mobile
npm run test:unit
npm --prefix apps/mobile run test
make db_verify_linear_baseline
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/management-api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/workers
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
make e2e_test_web_report_spec SPEC=e2e/notifications-inbox.spec.ts,e2e/navbar-chrome.spec.ts
open .artifacts/e2e-reports/latest/index.html
./scripts/development/update-lockfile-linux.sh

Mobile:
npm run mobile:install
npm run mobile:prebuild

Mobile E2E iOS:
npm run mobile:e2e:ios

Mobile E2E Android:
npm run mobile:e2e:android

Mobile Maestro:
npm run mobile:e2e:test -- notifications-inbox,banner-notification
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
