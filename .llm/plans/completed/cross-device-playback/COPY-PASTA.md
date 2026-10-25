# Cross-device playback — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger, areas, and
decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order, prerequisites, and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run cross-device-playback`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run cross-device-playback --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase share no
file, and none of them writes the release scratchpad: each puts its entry in its final message,
and prompt 58 appends them. Running them one after the other is also correct.

**Before Phase 1:** `realtime-banner-notifications`, `auth-sessions`,
`auth-sessions-stream-close` (plan 70), and `web-player-marquee` must all be complete on this
branch. None of them has started yet. A prompt that finds one of their files missing stops and
reports BLOCKED.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 27, 40, 41 | 10 Codex 5.3 high; 27, 40 Cursor Grok 4.7 medium; 41 Cursor Grok 4.7 high |
| 2 | 11, 20 | Cursor Grok 4.7 extra high |
| 3 | 12, 21, 30 | 12 Opus 5.5 extra high; 21 Opus 5.5 high; 30 Opus 5.5 extra high |
| 4 | 13, 14 | 13 Opus 5.5 high; 14 Opus 5.5 extra high |
| 5 | 15, 22, 31 | 15 Cursor Grok 4.7 medium; 22, 31 Opus 5.5 extra high |
| 6 | 23, 26, 32 | 23, 26 Cursor Grok 4.7 extra high; 32 Opus 5.5 extra high |
| 7 | 24, 33 | 24 Opus 5.5 high; 33 Opus 5.5 extra high |
| 8 | 25, 49, 34 | 25, 49 Cursor Grok 4.7 extra high; 34 Opus 5.5 extra high |
| 9 | 35, 42, 50 | 35 Opus 5.5 extra high; 42, 50 Cursor Grok 4.7 extra high |
| 10 | 36, 43, 44, 45, 46, 51, 53, 54, 56 | 36 Cursor Grok 4.7 medium; 54 extra high; the rest Cursor Grok 4.7 high |
| 11 | 47, 52 | 47 Codex 5.3 high; 52 Cursor Grok 4.7 high |
| 12 | 48, 55 | 48 Cursor Grok 4.7 medium; 55 Cursor Grok 4.7 extra high |
| 13 | 59 | Cursor Grok 4.7 high |
| 14 | 57 | Cursor Grok 4.7 high |
| 15 | 58 | Cursor Grok 4.7 medium |

Why the expensive ones: 12 and 14 hold presence, the active-device slot, and stream delivery,
where races decide which device plays; 13 is the route contract every client calls; 21 and 22 are
the web tab role and claim rules later web prompts build on; 24 is the two-way transfer; 30–35
are the mobile store, background publishing, commands, and routing through `PlaybackProvider.tsx`.
Codex 5.3 takes 10 (the event and command guards every surface parses) and 47 (a two-browser
Playwright spec with tricky timing). Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — Cross-device playback contract in `@podverse/helpers`**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/10-playback-stream-contract.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. If a file from another set
that the plan builds on is missing (first realtime-banner-notifications plan 10's
packages/helpers/src/lib/accountEventStream.ts), stop and report BLOCKED naming the set and plan.
`medium` on DTOPlaybackResourceSummary is required; next and previous are commands; no toggle.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 10-playback-stream-contract.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **27 — Playback core: a commanded start at or past the file's end backs off 5 s**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/cross-device-playback/27-playback-core-command-start-clamp.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Add clampCommandStartToFileEnd beside clampNearEndSeconds and leave clampNearEndSeconds unchanged;
plans 23 and 33 import it.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 27-playback-core-command-start-clamp.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **40 — Player copy for cross-device playback (consumer catalog)**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/cross-device-playback/40-web-cross-device-player-copy.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (status copy answer).
You own media_player.cross_device in the consumer catalog, including the shared title-case status
keys playing_on_device, paused_on_device, starting_on_device, sending_to_device, and the web-only
playing_in_another_tab. Make targeted insertions; plan 50 adds media_player.devices later.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 40-web-cross-device-player-copy.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **41 — `@podverse/ui` dropdown menu: radio items with a description line**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/41-ui-dropdown-menu-radio-items.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Items without `checked` keep rendering exactly as today; plan 44 builds the device menu on this.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 41-ui-dropdown-menu-radio-items.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **11 — Cross-device playback shared helpers in `@podverse/helpers`**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/11-playback-shared-helpers.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (next and previous, one
device owns playback events).
Keep plan 10's exports in packages/helpers/src/index.ts and package.json; add yours beside them.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 11-playback-shared-helpers.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **20 — Web: `playback.*` events and stream leadership through the shared account stream**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/20-web-stream-playback-events.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. If realtime-banner-
notifications plan 30's notificationStreamCoordinator.ts is missing, stop and report BLOCKED.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 20-web-stream-playback-events.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [x] **12 — API playback store: presence, active device, and state in Redis**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/12-api-playback-redis-store.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D2–D5, D9). If the realtime
Redis fanout or auth-sessions session id it builds on is missing, stop and report BLOCKED naming
the set and plan.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 12-api-playback-redis-store.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **21 — Web cross-device playback runtime library**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/21-web-playback-runtime-library.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D15, D19, D24).
buildPlaybackResourceSummary uses itemTitle and fills medium by plan 22's rule, as the plan says.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 21-web-playback-runtime-library.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **30 — Mobile cross-device playback store and policy (pure)**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/30-mobile-cross-device-store-policy.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D38).
Import from @podverse/helpers/accountPlaybackStream and @podverse/helpers/crossDevicePlayback.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 30-mobile-cross-device-store-policy.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [x] **13 — API playback routes and request calls**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/13-api-playback-routes.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D4, D6, D7, D11, D13,
D14, next and previous). Anchor openapi.yml edits by path and operationId. Plan 13 holds the
feature's one server-side release entry; plans 12 and 14 point to it.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md even
though the plan lists it: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 58 appends it.
When the plan is done, move 13-api-playback-routes.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **14 — Deliver `playback.*` on the account event stream**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/14-api-playback-stream-delivery.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D3, D12). If realtime plan
12's accountEventStreamHub.ts or auth-sessions-stream-close plan 70's session id on each stream
is missing, stop and report BLOCKED naming the set and plan.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 14-api-playback-stream-delivery.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

- [x] **15 — Cross-device playback docs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/cross-device-playback/15-cross-device-playback-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Describe the behavior in Podverse terms (no-third-party-media-player-style). Next and previous are
commands, not toggles; the "never add a toggle command" rule stands.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 15-cross-device-playback-docs.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **22 — Web cross-device playback provider: presence, publishing, claims, and stopping on loss**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/22-web-playback-provider-core.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D15–D20). The publishing
tab fills medium; keep plan 21's value if it already fills it by the same rule.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 22-web-playback-provider-core.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **31 — Mobile playback events and presence**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/31-mobile-playback-stream-presence.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D29, D40). If realtime plan
40's notification stream runtime or runWithMobileAuthRefresh is missing, stop and report BLOCKED.
Do not drive background work from setTimeout or setInterval; Android does not fire them there.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 31-mobile-playback-stream-presence.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [x] **23 — Web: the audio tab obeys playback commands, and reports starts that fail**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/23-web-playback-command-executor.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (next and previous, landing
past the end, one device owns playback events). Use plan 27's clampCommandStartToFileEnd.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 23-web-playback-command-executor.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **26 — Web: the Switch or Continue prompt yields to live control**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/26-handoff-prompt-yields-to-live-control.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D28).
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 26-handoff-prompt-yields-to-live-control.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **32 — Mobile publishes its playback and stops when another device takes over**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/32-mobile-playback-state-publish.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D30–D33). The publishing
app fills medium, including for Add by RSS items. Stopping for another device writes no event.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 32-mobile-playback-state-publish.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

- [x] **24 — Web: sending audio to another device, and taking it over here**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/24-web-playback-transfer.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D21–D23, landing past the
end). A livestream transfer starts at the live point.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 24-web-playback-transfer.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **33 — Mobile obeys playback commands and takes over**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/33-mobile-playback-commands.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D34, next and previous,
landing past the end, one device owns playback events). Import clampCommandStartToFileEnd from
@podverse/playback-core/clampNearEndSeconds and never keep a copy.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 33-mobile-playback-commands.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 8

- [x] **25 — Web: controls in a tab that is not playing go to the playing device**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/25-web-remote-control-routing.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D25, next and previous).
Keep plan 23's edits in the two track-button hooks and CrossDevicePlayback.tsx.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 25-web-remote-control-routing.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **49 — Data the web remote view needs about the item another device plays**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/49-web-remote-player-resource-data.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (Add to Playlist and Share,
segment strip and chapter rows). Keep plan 23's edits in usePlaybackResourceLoader.ts and plan
24's in useCrossDevicePlaybackTransfer.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 49-web-remote-player-resource-data.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **34 — Mobile controls another device and moves playback**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/34-mobile-remote-control-routing.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D36, D37, next and
previous). Adds transferPlaybackTo and takeOverPlaybackHere to PlaybackSessionContextValue.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 34-mobile-remote-control-routing.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 9

- [x] **35 — The 744 prompt and live control never show together**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/35-mobile-handoff-prompt-gate.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D38, D39).
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 35-mobile-handoff-prompt-gate.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **42 — Web player shows what another device or tab is playing**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/42-web-remote-player-display.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (status copy, Add to
Playlist and Share, next and previous, mobile-width split by medium, segment strip). If
web-player-marquee's MediaPlayerSegmentStrip or the bar's itemTitle line is missing, stop and
report BLOCKED naming web-player-marquee plans 20, 21, and 30. Display code never writes to the
MediaPlayer context.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 42-web-remote-player-display.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **50 — Mobile player display model for another device's playback**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/50-mobile-cross-device-player-display.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (status copy). Read plan
40's media_player.cross_device status keys and add only media_player.devices, in the four
originals and, with empty strings, the es, fr, and el-GR overrides. Report every key name in your
final message for plans 51–57.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 50-mobile-cross-device-player-display.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 10

- [x] **36 — Mobile cross-device playback docs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/cross-device-playback/36-mobile-cross-device-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Plan 58 edits the same two
files later; write only this plan's sections.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 36-mobile-cross-device-docs.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **43 — Remote progress bar that advances locally and seeks the playing device**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/43-web-remote-progress-bar.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D47). The bar reads
duration_seconds from the shared state, never the local file length.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 43-web-remote-progress-bar.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **44 — Device button and menu on the web player**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/44-web-playback-devices-button.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D48, D49). Keep plan 42's
edits in the three MediaPlayerButtons components.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 44-web-playback-devices-button.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **45 — Tap-to-play prompt and the "could not start there" notice**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/45-web-tap-to-play-and-transfer-notice.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (failure notice: web toast
kept as an intentional divergence from the mobile dialog). Keep plans 25 and 42's edits in
MediaPlayerController.tsx.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 45-web-tap-to-play-and-transfer-notice.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **46 — Item rows, chapter rows, and detail play buttons show what plays on another device**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/46-web-item-rows-remote-state.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (segment strip and chapter
rows). Chapter rows highlight from the playing device's estimated position.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 46-web-item-rows-remote-state.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **51 — Mini player shows what another device is playing**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/51-mobile-mini-player-remote.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (status copy, segment strip).
Use plan 50's key names as reported in .artifacts/plan-runner/cross-device-playback/50.md. Plan 52
edits MiniPlayer.tsx next.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 51-mobile-mini-player-remote.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **53 — Mobile notices when playback could not start on another device**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/53-mobile-cross-device-notices.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (failure notice: mobile
dialog kept as an intentional divergence from the web toast). Use plan 50's key names as reported
in .artifacts/plan-runner/cross-device-playback/50.md.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 53-mobile-cross-device-notices.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **54 — Full player scrubber with a remote source**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/54-mobile-remote-scrubber.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D64). Remote progress reads
duration_seconds from the shared state.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 54-mobile-remote-scrubber.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **56 — List rows and the queue follow another device's playback**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/56-mobile-rows-remote-active.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D69, D70).
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 56-mobile-rows-remote-active.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 11

- [x] **47 — Playwright: two signed-in browsers share one player**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/47-web-cross-device-playback-e2e.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Follow e2e-readability and
e2e-screenshot-verified-element. The spec waits out the presence leave grace itself; do not change
other specs.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 47-web-cross-device-playback-e2e.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **52 — Device switch button and device menu**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/52-mobile-device-switch-sheet.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D60–D62). Keep plan 51's
edits in MiniPlayer.tsx; plan 55 edits FullPlayerUtilityRow.tsx next.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 52-mobile-device-switch-sheet.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 12

- [x] **48 — Decision matrix: the cross-device remote view**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/cross-device-playback/48-web-player-matrix-cross-device.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Describe what shipped in
plans 42–47 and 49; read their final messages in .artifacts/plan-runner/cross-device-playback/
for any change from the plans.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry", or
"none". Prompt 58 appends it.
When the plan is done, move 48-web-player-matrix-cross-device.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **55 — Full player shows and controls another device's playback**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/cross-device-playback/55-mobile-full-player-remote.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (Add to Playlist and Share,
next and previous, segment strip, status copy). Remote Next and Previous call the same
usePlaybackSession actions the full player calls today; do not disable them from this phone's
canSkipToNext. Keep plan 52's edits in FullPlayerUtilityRow.tsx.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 58
appends it.
When the plan is done, move 55-mobile-full-player-remote.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 13

- [x] **59 — Mobile chapter rows mark the chapter that is playing**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/59-mobile-chapter-rows-playing.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (segment strip and chapter
rows). Keep plan 55's edits in FullPlayerScreen.tsx.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 59-mobile-chapter-rows-playing.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 14

- [x] **57 — Maestro flow for the phone with another device playing**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/cross-device-playback/57-mobile-cross-device-maestro.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Follow
mobile-maestro-timeouts. If the auth-sessions routes the host script uses (device_label on
POST /auth/mobile/token, GET /auth/sessions, DELETE /auth/sessions/:id_text) are missing, stop and
report BLOCKED. The flow needs the default sequential slots.
Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 57-mobile-cross-device-maestro.md to
.llm/plans/completed/cross-device-playback/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 15

- [x] **58 — Document the phone's player for another device's playback; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/cross-device-playback/58-mobile-player-ui-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Keep plan 36's sections in
APPS-MOBILE.md and the mobile-playback skill.
Do not run tests. The plan has no release scratchpad entry of its own.

Append to release-notes/scratchpad.md every "Release notes entry" from the final messages in
.artifacts/plan-runner/cross-device-playback/ of prompts 10, 27, 40, 41, 11, 20, 12, 21, 30, 13,
14, 15, 22, 31, 23, 26, 32, 24, 33, 25, 49, 34, 35, 42, 50, 36, 43, 44, 45, 46, 51, 53, 54, 56,
47, 52, 48, and 55 (10.md, 27.md, …), in that order, unchanged. Skip "none" and any entry that
already appears in the scratchpad. Entries are expected from 13, 22, 31, 23, 26, 32, 24, 33, 25,
34, 35, 42, 43, 44, 45, 46, 51, 53, 56, 52, and 55; name any of those that is missing.

Then close the set. Move 58-mobile-player-ui-docs.md to
.llm/plans/completed/cross-device-playback/ and confirm every other numbered plan is there. Move
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that
Docker, Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must be
running, and that Mobile E2E API must be restarted after make test_deps and the package build so
it serves the playback routes on the test Valkey. Do not put leave-running commands in the
blocks. Say to run the Mobile Maestro block with the default sequential slots, never --parallel,
because both phones sign in to the same seeded account and exclusive playback makes them stop
each other. Note that there is no dependency change, so no lockfile step.

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run test:unit
npm --prefix apps/mobile run test
make test_deps
npm run test:e2e:api
make e2e_test_web_report_spec SPEC=e2e/media-player-cross-device-remote.spec.ts,e2e/media-player-addbyrss-cross-device.spec.ts,e2e/media-player-music-playback.spec.ts,e2e/media-player-foundation.spec.ts,e2e/media-player-keyboard-shortcuts.spec.ts,e2e/media-player-space-shortcut.spec.ts,e2e/media-player-chapter-seek.spec.ts,e2e/media-player-podcast-resume.spec.ts,e2e/media-player-livestream-audio-start.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- playback-cross-device,playback-multi-device-handoff,play-mini-player,player-screen,queue-screen
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
