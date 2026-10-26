# Mobile notifications bell — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Run the set unattended (Root tab of this worktree's window):**
`./scripts/abcplan/run.sh run mobile-notifications-bell`. It runs one fresh agent per prompt on
that prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run mobile-notifications-bell --resume 'Your answer.'`. The script
passes `--parallel`, so both Phase 1 prompts run at once. They share no file, and neither writes
the release scratchpad: each puts its entry in its final message, and prompt 40 appends them.
Running them one after the other is also correct.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/mobile-notifications-bell/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read each result before the next prompt starts.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 20 | Cursor Grok 4.7 extra high (10), high (20) |
| 2 | 11 | Cursor Grok 4.7 high |
| 3 | 40 | Cursor Grok 4.7 medium |

Why the levels: 10 edits `navigation/index.tsx` (very large), deep linking, and how a stored tab
bar is read on device, and 11 and 40 build on its route and helper, so it runs at extra high. 20
and 11 are pattern-following UI with settled plans. 40 is guidance edits plus closing the set.
Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

Two prompts at once. 10 owns the navigation, tab layout, deep linking, inbox screen, `browse.yaml`,
and `banner-notification.yaml`. 20 owns `ChannelHeader`, the podcast, album, and artist detail
screens, and `podcast-episode.yaml`, `subscriptions-anonymous.yaml`, `album.yaml`, and
`artist.yaml`. Full lists: 00-EXECUTION-ORDER.md § Phase 1.

- [x] **10 — Notifications inbox becomes a root slide-up screen; the tab goes away**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/mobile-notifications-bell/10-notifications-root-slide-up.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1 and D2 kept).
apps/mobile/src/navigation/index.tsx is very large: search for the plan's anchors
(NotificationsStackNavigator, MoreOverflowNotifications, notificationsTabLinkScreens, the More tab
badge, ROOT_SLIDE_UP_SCREEN_OPTIONS) and make targeted edits. Export
navigateToNotificationsInboxScreen() exactly as the plan names it; prompt 11 imports it.
tabLayout.test.ts and notificationStack.test.ts are not in the apps/mobile/vitest.config.ts
include list. Update them as the plan says, and do not edit vitest.config.ts (prompt 11 owns it).
Prompt 20 runs at the same time. Edit only the files your plan lists, scope any type-check or
formatter to them, and report errors in files you do not own instead of fixing them. Do not edit
HomeScreen.tsx, ChannelHeader.tsx, the channel detail screens, or notifications-inbox.yaml.
Do not run tests. Do not edit release-notes/scratchpad.md: put the plan's release scratchpad
entry in your final message under "Release notes entry". Prompt 40 appends it.
When the plan is done, move 10-notifications-root-slide-up.md to
.llm/plans/completed/mobile-notifications-bell/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs (the route name, helper name, and test ids as built).
```

- [x] **20 — Channel bell moves into the channel header's action row**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-notifications-bell/20-channel-header-bell.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D5 and D6 kept: the bell
sits at the trailing edge of the action row at CHANNEL_HEADER_SETTINGS_ICON_SIZE, layout inline).
Keep the testIDs podcast-detail-notifications-toggle, album-detail-notifications-toggle, and
artist-detail-notifications-toggle. Leave useChannelNotifications and channelActionChrome as they
are. Share and Boost stay in headerRight.
Prompt 10 runs at the same time. Edit only the files your plan lists, scope any type-check or
formatter to them, and report errors in files you do not own instead of fixing them. Do not edit
apps/mobile/src/navigation/, the tab layout prefs, HomeScreen.tsx, or any .cursor/ file.
Do not run tests. Do not edit release-notes/scratchpad.md: put the plan's release scratchpad
entry in your final message under "Release notes entry". Prompt 40 appends it.
When the plan is done, move 20-channel-header-bell.md to
.llm/plans/completed/mobile-notifications-bell/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **11 — Home title-bar bell opens the notifications inbox**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-notifications-bell/11-home-notifications-bell.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D3 kept; D4 reversed:
filled Ionicons notifications at the HeaderBarAction default size, badge capped at 99+).
Build on prompt 10's root NotificationsInbox route and navigateToNotificationsInboxScreen() in
apps/mobile/src/navigation/index.tsx; import the helper and do not edit that file. If prompt 10's
final message in .artifacts/plan-runner/mobile-notifications-bell/10.md names them differently,
use the names as built. CountBadge's max prop is optional with no default; only the Home bell
passes 99. Add both new test files to the apps/mobile/vitest.config.ts include list.
Do not run tests. Append the plan's release scratchpad entry to release-notes/scratchpad.md.
When the plan is done, move 11-home-notifications-bell.md to
.llm/plans/completed/mobile-notifications-bell/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs (component name and test ids as built).
```

## Phase 3

- [x] **40 — Record where the two notification bells live; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/mobile-notifications-bell/40-bell-placement-guidance.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Use the route, helper,
component, and test id names from the final messages of prompts 10, 20, and 11 in
.artifacts/plan-runner/mobile-notifications-bell/ (10.md, 20.md, 11.md) if they differ from the
plan. Write each rule as what is true of the app; cite no plan or step number. Edit only the four
rules the plan lists; do not change product code, tests, catalogs, or web.
Do not run tests. The plan has no release scratchpad entry of its own.

Append to release-notes/scratchpad.md the "Release notes entry" from the final messages of
prompts 10 and 20 in .artifacts/plan-runner/mobile-notifications-bell/ (10.md, then 20.md),
unchanged. Skip one that already appears in the scratchpad. If a final message has no entry, use
the ## Release scratchpad block from that prompt's plan in
.llm/plans/completed/mobile-notifications-bell/.

Then close the set. Move 40-bell-placement-guidance.md to
.llm/plans/completed/mobile-notifications-bell/ and confirm plans 10, 11, and 20 are there. Move
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name, all run from the root of
this worktree. Before the Mobile Maestro block, tell the operator to stop Dev and Mobile Metro,
and that Mobile E2E Metro (npm run mobile:dev:e2e), Mobile E2E API (npm run mobile:e2e:api), and
Mobile E2E iOS or Mobile E2E Android must be running from this worktree; every flow below is
API-backed and none needs test-assets. Do not put leave-running commands in the blocks. Note that
there is no dependency change, so no lockfile step.

Root:
npm run build:packages
npm --prefix apps/mobile run test
npm run type-check:mobile
npm run lint
npm exec -- prettier --check .cursor/rules/mobile-screen-layout.mdc .cursor/rules/mobile-tab-layout.mdc .cursor/rules/mobile-navigate-known-state.mdc .cursor/rules/about-summary-web-mobile-alignment.mdc release-notes/scratchpad.md

Mobile Maestro:
npm run mobile:e2e:test -- notifications-inbox,banner-notification,browse,podcast-episode,subscriptions-anonymous,album,artist
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
