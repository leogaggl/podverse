# Artist, album, and track attribution — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):** `./scripts/abcplan/run.sh run artist-album-attribution`.
It runs one fresh agent per prompt on that prompt's model, stops at the first blocker, and resumes
with `./scripts/abcplan/run.sh run artist-album-attribution --resume 'Your answer.'`. The script
passes `--parallel`, so every prompt under one phase heading runs at once. Prompts in a phase share
no file, and none of them writes the release scratchpad: each puts its entry in its final message,
and Close appends them. Running a phase's prompts one after the other is also correct.

**Before Phase 1, start Docker:** plan 01 regenerates the linear baseline archives.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 01, 20 | Cursor Grok 4.7 extra high |
| 2 | 02, 80 · 90 | Opus 5.5 high · Cursor Grok 4.7 high |
| 3 | 05, 10 · 03, 04, 06, 21 | Cursor Grok 4.7 extra high · high |
| 4 | 22, 81 · 23, 70 | Opus 5.5 high · Cursor Grok 4.7 high |
| 5 | 71, 82 · 11, 60 | Opus 5.5 high · Cursor Grok 4.7 extra high |
| 6 | 74 · 61, 64, 83 · 12, 63 · 13, 62 | Opus 5.5 high · Cursor Grok 4.7 extra high · high · medium |
| 7 | 65 · 40, 50, 67 · 66 | Cursor Grok 4.7 extra high · high · medium |
| 8 | 84, 86 · 30, 68 · 72 · 41 | Opus 5.5 high · Cursor Grok 4.7 extra high · high · medium |
| 9 | 73 · 85 · 76 · 51, 91 | Opus 5.5 high · Cursor Grok 4.7 extra high · high · medium |
| 10 | 94 · 75, 87, 92 · 77 | Opus 5.5 high · Cursor Grok 4.7 high · medium |
| 11 | 78 · 93 · 88, 95 | Opus 5.5 high · Cursor Grok 4.7 extra high · high |
| 12 | 96, 97 | Cursor Grok 4.7 high |
| Close | Close | Cursor Grok 4.7 medium |

Why the expensive ones: 02 is the match rule every link depends on; 22 sends credentials across
album hosts; 71, 80, 81, 82, 84, and 74 design device storage and the in-memory artist index other
prompts build on; 73 and 86 merge device and directory artists; 94 runs many unfollows behind one
dialog; 78 stitches the Add by RSS fixtures across five pages. Cursor Grok 4.7 at extra high covers
the migration (01), stored-data and contract changes many later prompts read (10, 11, 20, 60), the
player and native work (61, 64, 65, 68), merges (05), and the most-edited mobile screens (83, 85,
93). Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [ ] **01 — Publisher claims as lists, and the verified publisher link table**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/01-publisher-claims-and-link-schema.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Take app migration 0022 unless a later one has landed; then use the next free number, and that
same name in the readiness marker and the release entry. Docker is running: run
make db_regen_linear_baseline and make db_verify_linear_baseline as the plan says (they produce
the change; they are not the test run). If either cannot run, say so in your final message. Do
not edit detectDuckTypedPublisherMediumId or docs/proposals/podcast-namespace/.
Another prompt runs at the same time (00-EXECUTION-ORDER.md § Phase 1 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 01-publisher-claims-and-link-schema.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **20 — Add by RSS publisher listed feeds: response contract and pure planning**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/20-add-by-rss-publisher-listed-feeds-contract.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
At most 100 listed feeds per artist (D27 kept); only the artists type fans out. In openapi.yml,
insert only the Add by RSS parse response fields; five later prompts edit the same file.
Another prompt runs at the same time (00-EXECUTION-ORDER.md § Phase 1 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 20-add-by-rss-publisher-listed-feeds-contract.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [ ] **02 — Verified publisher match rule and recompute service**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/02-verified-publisher-recompute.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 01 in .artifacts/plan-runner/artist-album-attribution/01.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
D1 stands: check feedUrl in both directions only when a reference carries one; guid-only
references link on guids. Keep isVerified, getForContentChannels, and getForPublisher as the plan
names them; later plans read links through them.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 2 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 02-verified-publisher-recompute.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **80 — Mobile stores what an Add by RSS artist lists, and albums it holds only for that artist**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/80-mobile-add-by-rss-listed-feed-storage.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 20 in .artifacts/plan-runner/artist-album-attribution/20.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Listed-only albums are a followed column on the existing Add by RSS table (D62 kept). SQLite
migration version 25 is this plan's; take the next free version if one has landed first.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 2 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 80-mobile-add-by-rss-listed-feed-storage.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **90 — API: unfollow many feeds in one request**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/90-account-unfollow-bulk-endpoint.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
One bulk endpoint covers directory and Add by RSS follows, with no transaction (D72). In
openapi.yml and packages/helpers-requests/src/api/_request.ts, insert only this route's entries.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 2 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 90-account-unfollow-bulk-endpoint.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [ ] **03 — Recompute links on every parse, and map publisher claims as a list**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/03-parser-recompute-and-claim-lists.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 02 in .artifacts/plan-runner/artist-album-attribution/02.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
The recompute hook runs before items are parsed, and a recompute failure is logged, not thrown
(D8).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 3 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 03-parser-recompute-and-claim-lists.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **04 — New-album notifications name only verified or not-yet-parsed albums**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/04-new-album-notification-verified.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 02 in .artifacts/plan-runner/artist-album-attribution/02.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
New-album notifications require a verified link (D7 kept), checked in
handleNewRemoteItemNotifications.ts.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 3 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 04-new-album-notification-verified.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **05 — Channel merges remove the absorbed channel's verified publisher links**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/05-channel-merge-verified-links.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 01 and 02 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
An absorb deletes the absorbed feed's links and recomputes the survivor; a revert restores rows
from the journal and does not recompute (D10).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 3 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 05-channel-merge-verified-links.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **06 — Worker command to backfill verified publisher links**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/06-verified-publisher-backfill-command.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 02 in .artifacts/plan-runner/artist-album-attribution/02.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
The command is ormVerifiedPublisherLinksBackfill. Plan 22 adds its own line to
categoriesForCommand.ts in the next phase; insert yours where the plan says.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 3 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 06-verified-publisher-backfill-command.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **10 — Verified publishers on channel and item responses**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/10-verified-publishers-on-channel-and-item.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 02 in .artifacts/plan-runner/artist-album-attribution/02.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
verified_publishers is channel-wide on channels and item-only on items (D12).
resolveVerifiedPublishers and joinVerifiedPublisherTitles in @podverse/helpers are what every later
reader calls; keep those names (D13). Plans 11, 12, and 70 extend the same files in later phases.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 3 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 10-verified-publishers-on-channel-and-item.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **21 — Find directory channels for the feeds an Add by RSS artist lists**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/21-add-by-rss-directory-channel-match.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Match by guid, then by URL with a guid check (D30). In packages/orm/src/index.ts, add only your
export.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 3 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 21-add-by-rss-directory-channel-match.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [ ] **22 — Adding an Add by RSS artist also parses the albums it lists**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/22-add-by-rss-artist-fan-out-worker.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 20 and 21 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Each listed album is its own queue message, with dedupe off (D21, D22). Credentials are re-sealed
only for albums inside the artist feed's resolveCredentialScope; the rest get credentialsWithheld
(D23). Podcast Index lookup runs only for public artist feeds (D24).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 4 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 22-add-by-rss-artist-fan-out-worker.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **23 — E2E fixture: an Add by RSS artist that lists two albums**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/23-add-by-rss-artist-e2e-fixture.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 20 and 21 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
The fixture artist is https://e2e-seed-addbyrss.example/artist.xml. It lists the Add by RSS album
and the seeded directory album e2eMusicAlbm01; plans 78, 88, and 96 build on these ids.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 4 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 23-add-by-rss-artist-e2e-fixture.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **70 — Public read: which directory channel a feed guid is**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/70-channel-directory-match-endpoint.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 10 and 21 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
GET /channel/directory-match and reqChannelGetDirectoryMatch are what web plan 76 and mobile
plans 80 and 82 call; keep the route, DTO, and helper names exactly. In openapi.yml,
_request.ts, and dtos/index.ts, insert only this route's entries.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 4 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 70-channel-directory-match-endpoint.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **81 — Mobile answers "which artist" for Add by RSS from memory**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/81-mobile-add-by-rss-artist-index.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 10 and 80 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
The index answers synchronously, so the full player decides its artist line when an item starts
(D64).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 4 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 81-mobile-add-by-rss-artist-index.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

- [ ] **11 — Artist endpoint: verified albums, Not Yet Added, tracks from verified albums**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/11-artist-page-verified-albums-and-tracks.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 10 in .artifacts/plan-runner/artist-album-attribution/10.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Keep channelsAdded, channelsUnadded, itemsAdded, and itemsUnadded, with itemsUnadded always
empty, so installed mobile builds still work (D15). Tracks are capped at 500 (D16 kept).
tools/web/seed-e2e.mjs is large: grep the plan's anchors and edit in place; plan 13 edits it next
phase.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 5 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 11-artist-page-verified-albums-and-tracks.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **60 — Mobile verified-artist helpers and the artist chooser sheet**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/60-mobile-verified-artists-helpers-and-chooser.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 10 in .artifacts/plan-runner/artist-album-attribution/10.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
A publisher shows as an artist only when getChannelRouteKind(medium_id) is 'artist' (D43 kept).
Plans 61–65 and 86 import these helpers and the chooser; keep their names exactly as the plan
states.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 5 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 60-mobile-verified-artists-helpers-and-chooser.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **71 — Web: store what an Add by RSS artist lists, and the albums parsed with it**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/71-web-add-by-rss-listed-albums-store.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 20 and 22 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Listed albums and artist links get their own IndexedDB stores, DB_VERSION 7 to 8 (D51 kept).
Plan 74 extends the same files next phase; keep the exports the plan names.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 5 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 71-web-add-by-rss-listed-albums-store.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **82 — Mobile stores an Add by RSS artist's albums as their parses finish**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/82-mobile-add-by-rss-artist-album-sync.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 20, 22, 70, 80, and 81 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
One album-sync job checks every pending album each round, capped at about 30 seconds, through the
one-at-a-time sync queue (D63). Failures are logged, not shown.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 5 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 82-mobile-add-by-rss-artist-album-sync.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [ ] **12 — Verified publishers on item lists, queue resources, and playlist resources**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/12-verified-publishers-on-lists-and-queue.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 10 in .artifacts/plan-runner/artist-album-attribution/10.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Review answer for D49: the by-channel item list also attaches the album channel's verified
publishers as channel_wide_verified_publishers, separate from the item-only list, so stored
channel_item payloads carry them. In openapi.yml, insert only this plan's fields.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 12-verified-publishers-on-lists-and-queue.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **13 — E2E fixtures for the artist page's album groups**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/artist-album-attribution/13-artist-page-e2e-fixtures.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 11 in .artifacts/plan-runner/artist-album-attribution/11.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
In E2E fixtures mode the artist page never calls live Podcast Index; the preview route serves
fixture id 2147483631 (D20). tools/web/seed-e2e.mjs is large: grep the plan's anchors and edit in
place.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 13-artist-page-e2e-fixtures.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **61 — Mobile full player artist line**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/61-mobile-full-player-artist-line.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 60 in .artifacts/plan-runner/artist-album-attribution/60.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
The artist band is reserved per item when it starts (D44); the link opens Home when the artist
itself is followed, Browse otherwise (D45). Re-read FullPlayerScreen.tsx before editing; other
sets have changed it.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 61-mobile-full-player-artist-line.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **62 — Mobile mini player "Artist · Album" line**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/artist-album-attribution/62-mobile-mini-player-artist-album-line.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 60 in .artifacts/plan-runner/artist-album-attribution/60.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
The second line always uses MarqueeText, in the title's turn group (D46 kept).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 62-mobile-mini-player-artist-album-line.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **63 — Mobile track screen artist byline**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/63-mobile-track-screen-artist-byline.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 60 in .artifacts/plan-runner/artist-album-attribution/60.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Verified artists go in the album header byline, falling back to the feed's author text (D47).
Album screens do not change (R39).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 63-mobile-track-screen-artist-byline.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **64 — Lock screen and car now-playing: artist and album fields (phone-started playback)**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/64-mobile-now-playing-artist-and-album-fields.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 60 in .artifacts/plan-runner/artist-album-attribution/60.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
This is a native change; do not rebuild the app. With no artist, the album field stays empty and
the channel title stays in the artist field (D48).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 64-mobile-now-playing-artist-and-album-fields.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **74 — Web: open, play, and follow an album an Add by RSS artist lists**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/74-web-add-by-rss-listed-album-pages.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 71 in .artifacts/plan-runner/artist-album-attribution/71.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Review answer for D59: listed-only albums behave like mobile before follow, with livestream rows
and the Settings credentials section. Plan 78 adds the Playwright steps this plan's Tests
describe; do not create that spec. Extend plan 71's files and keep its exports.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 74-web-add-by-rss-listed-album-pages.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **83 — Mobile: follow an album an Add by RSS artist listed, and unfollow back to listed**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/83-mobile-follow-listed-add-by-rss-albums.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 80 and 82 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Unsubscribing an album some artist on the device still lists sets it back to listed-only and
keeps the screen open (D66). unfollowFeed returns 'listed' or 'removed'; plans 94 and 95 call it.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 6 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 83-mobile-follow-listed-add-by-rss-albums.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

- [ ] **40 — Mobile artist screen: verified albums, Not Yet Added, track list**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/40-mobile-artist-album-sections.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 11 in .artifacts/plan-runner/artist-album-attribution/11.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
You are the first catalog prompt in the set and the only one in this phase. Insert the four
media.music keys (verified_albums, your_add_by_rss_albums, not_yet_added,
not_yet_added_albums_note) in all four consumer originals, then run npm run i18n:compile. Plans
30 and 75 reuse these keys. Leave the Your Add by RSS sections as stubs; plan 85 fills them.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 7 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 40-mobile-artist-album-sections.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **50 — Web player artist line**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/50-web-player-artist-line.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 11 and 12 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Several artists open MediaPlayerArtistChooser, portaled to document.body (D40). Change the text
expressions and add the artist row in place: web-player-marquee edits the same components on
another branch. Plan 76 extends artistPublishers.ts and the resolver later; keep
presentArtistLine and compactArtistAlbumLine as the plan names them.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 7 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 50-web-player-artist-line.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **65 — Car-started playback: artist and album from the native cache**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/65-mobile-car-started-playback-artist-fields.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 12 and 64 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Review answer for D49: car plays started from Queue, History, and album track lists show artist
and album; car library children entries carry an artist field native reads. This is a native
change; do not rebuild the app. Plan 68 extends the same projection and native files next phase.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 7 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 65-mobile-car-started-playback-artist-fields.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **66 — Maestro: artist line on the track screen, mini player, and full player**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/artist-album-attribution/66-mobile-artist-line-maestro.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 61, 62, and 63 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Use the seeded pair from plan 11: E2E Music Artist (e2eMusicChnl01), E2E Music Album
(e2eMusicAlbm01), track e2eMusicTrk001. Use the shared TIMEOUT_* ladder for waits.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 7 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
formatters to your own files. Do not run tests or Maestro. This plan has no release scratchpad
entry.
When the plan is done, move 66-mobile-artist-line-maestro.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **67 — Phone playback from a download shows the album's artist**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/67-mobile-download-playback-artist.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 12 in .artifacts/plan-runner/artist-album-attribution/12.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Review answer for D50: read the artist from the stored album item through the existing download
to channel_item join, as the plan decides; add no SQLite column. Downloads of albums the member
does not follow show none. Plan 68 extends channelItemsRepository.ts and downloadsRepository.ts
next phase.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 7 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 67-mobile-download-playback-artist.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 8

- [ ] **30 — Web artist page: verified albums, Not Yet Added, verified tracks**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/30-web-artist-page-album-sections.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 11 and 13 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Plan 40 already inserted media.music.verified_albums, your_add_by_rss_albums, not_yet_added, and
not_yet_added_albums_note. Add only keys still missing, keep the values already there, then run
npm run i18n:compile; you are the only catalog prompt in this phase. ArtistPageAddByRssSections.tsx
holds mount points that render nothing; plan 75 fills them.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 8 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 30-web-artist-page-album-sections.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **41 — Maestro: artist album groups and the Podcast Index preview**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/artist-album-attribution/41-mobile-artist-sections-maestro.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 13 and 40 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Assert the verified heading, the hidden unclaimed and unknown albums, the Not Yet Added preview,
and both seeded tracks, as the plan says. Do not tap pi-feed-add-button. Use the shared TIMEOUT_*
ladder for waits.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 8 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
formatters to your own files. Do not run tests or Maestro. This plan has no release scratchpad
entry.
When the plan is done, move 41-mobile-artist-sections-maestro.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **68 — Car Downloads list and car-started download plays show the artist**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/68-mobile-car-downloads-artist.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 65 and 67 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Plans 65 and 67 edited the same projection, repository, and native files; extend their changes
and keep them. This is a native change; do not rebuild the app.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 8 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 68-mobile-car-downloads-artist.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **72 — Web: match Add by RSS artists and albums by guid**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/72-web-add-by-rss-artist-matching.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 50 and 71 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
Matching is by guid, in the browser; nothing here changes server data (R40). Plans 73, 75, 76,
and 93 call these functions; keep their names exactly as the plan states.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 8 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 72-web-add-by-rss-artist-matching.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **84 — Mobile Add by RSS artist screen: Albums and Tracks**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/84-mobile-add-by-rss-artist-albums-and-tracks.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 80, 81, 82, and 83 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Albums that need credentials show above the album rows (D67). Directory albums open the directory
album, and their tracks are not on this Tracks tab (D68). Plans 94 and 95 call listFeedsWithRefs,
buildAddByRssArtistAlbums, and isArtistFeed; keep those names.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 8 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 84-mobile-add-by-rss-artist-albums-and-tracks.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **86 — Mobile player artist line for Add by RSS albums and albums Add by RSS artists list**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/86-mobile-player-add-by-rss-artist-line.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 60 through 65 and 81 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Keep resolveVerifiedArtists, verifiedArtistNames, and itemArtistNames verified-only on directory
DTO types; do not route itemArtistNames through Add by RSS, so car-started names stay verified
(D70). Re-read FullPlayerScreen.tsx and MiniPlayer.tsx; plans 61 and 62 changed them.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 8 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 86-mobile-player-add-by-rss-artist-line.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 9

- [ ] **51 — Directory track page artist byline**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/artist-album-attribution/51-web-track-page-artist-byline.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 50 in .artifacts/plan-runner/artist-album-attribution/50.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Each verified artist is its own link under the track title, with no chooser (D42). Album pages do
not change (R39). Plan 77 edits CoreTrackHeader.tsx next phase.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 9 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 51-web-track-page-artist-byline.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **73 — Web: Add by RSS artist page Albums and Tracks by guid**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/73-web-add-by-rss-artist-page-albums-tracks.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 71 and 72 in .artifacts/plan-runner/artist-album-attribution/; finished
plans are in .llm/plans/completed/artist-album-attribution/.
The artist page's livestream index stays followed feeds only; a listed album shows its
livestreams on its own album page (plan 74). An artist's list refreshes after 24 hours when the
page is visited (D60). Do not edit AddByRSSArtistHeader.tsx; plan 93 does.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 9 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 73-web-add-by-rss-artist-page-albums-tracks.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **76 — Web: player artist line for Add by RSS artists**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/76-web-player-add-by-rss-artist-line.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 50, 70, and 72 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Verified artists win; device artists fill an empty line only, and logged-out visitors and the
embed player get none (D56). The directory fallback uses plan 70's reqChannelGetDirectoryMatch.
Extend plan 50's presentArtistLine and compactArtistAlbumLine; do not fork the player components.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 9 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 76-web-player-add-by-rss-artist-line.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **85 — Mobile directory artist page: Your Add by RSS Albums and their tracks**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/85-mobile-artist-your-add-by-rss-albums.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 40, 80, 81, 82, and 84 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Fill plan 40's stubs; isEmpty is true exactly when the section renders nothing. The row marker is
an RSS icon whose accessible name is "Add by RSS" (D71). Tracks use artist-track-add-by-rss-row-N
test ids, never artist-album-row-* or artist-track-row-*.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 9 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 85-mobile-artist-your-add-by-rss-albums.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **91 — Catalog keys for the unsubscribe-from-artist dialog**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/artist-album-attribution/91-unsubscribe-artist-catalog-keys.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final message of plan 40 in .artifacts/plan-runner/artist-album-attribution/40.md; finished plans
are in .llm/plans/completed/artist-album-attribution/.
Two body keys (one album, several albums), no ICU plural (D73). Insert only this plan's keys in
the four consumer originals, then run npm run i18n:compile; you are the only catalog prompt in
this phase.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 9 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
formatters to your own files. Do not run tests. This plan has no release scratchpad entry.
When the plan is done, move 91-unsubscribe-artist-catalog-keys.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 10

- [ ] **75 — Web: Your Add by RSS Albums and tracks on a directory artist page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/75-web-artist-page-your-add-by-rss.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 30, 72, 73, and 74 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
media.music.your_add_by_rss_albums already exists from plan 40: add only keys still missing, keep
existing values, then run npm run i18n:compile; you are the only catalog prompt in this phase.
Keep plan 30's three exports and their { channel } prop; the sections stay out of server HTML
(R48). The marker's test id is add-by-rss-row-marker.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 10 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 75-web-artist-page-your-add-by-rss.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **77 — Web: artist byline on Add by RSS track pages**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/artist-album-attribution/77-web-add-by-rss-track-byline.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 51, 74, and 76 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Directory track pages keep the verified-only byline; Add by RSS track pages use the device rules
(D57). Plan 51's rule against editing Add by RSS track headers limited plan 51 only.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 10 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 77-web-add-by-rss-track-byline.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **87 — Mobile Add by RSS track screen: artist link in the byline**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/87-mobile-add-by-rss-track-byline.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 63, 81, 85, and 86 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Use the Add by RSS artist rules from plans 81 and 86. Directory track screens keep verified
artists only (D69) and are not edited here.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 10 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 87-mobile-add-by-rss-track-byline.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **92 — Web: ask about albums when unsubscribing from a directory artist**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/92-web-directory-artist-unsubscribe-prompt.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 11, 30, 90, and 91 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Web buttons, left to right: Cancel, Artist Only, Artist and Albums as the primary action (D74).
The verified albums reach the Unsubscribe button as a prop threaded through the header components
(D75). Plan 93 extends artistUnsubscribe.ts next phase.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 10 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 92-web-directory-artist-unsubscribe-prompt.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **94 — Mobile: the unsubscribe-from-artist dialog, its data, and many unfollows at once**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/94-mobile-artist-unsubscribe-dialog-and-repository.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 40, 83, 84, 90, and 91 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Mobile buttons, top to bottom: Artist and Albums, Artist Only, Cancel (D74). Close the dialog
first, then run the writes under the screen's busy state (D78). Offline, or when fetching the
verified albums fails, unsubscribe the artist without the dialog (D77).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 10 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry, if it has one, in your final message under "Release notes
entry". Close appends it.
When the plan is done, move 94-mobile-artist-unsubscribe-dialog-and-repository.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 11

- [ ] **78 — Web E2E: an Add by RSS artist's albums, player line, byline, and directory page**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/78-web-add-by-rss-artist-albums-e2e.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 11, 30, 50, 51, 73, 74, 75, 76, and 77 in
.artifacts/plan-runner/artist-album-attribution/; finished plans are in
.llm/plans/completed/artist-album-attribution/.
Also add plan 74's Playwright steps to add-by-rss-artist-albums.spec.ts: one podcastLiveItems
entry on ALBUM_FEED, the row on the album page, Settings showing Check Feed for Updates and Feed
Username and Password, /add-by-rss?tab=livestreams not showing it, and the livestream page
opening. The web E2E stack has no broker; stub the parse outcomes as the plan says.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 11 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks and formatters to your own files. Do not run tests or Playwright. This plan has no
release scratchpad entry.
When the plan is done, move 78-web-add-by-rss-artist-albums-e2e.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **88 — Maestro: an Add by RSS artist on mobile, end to end**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/88-mobile-add-by-rss-artist-maestro.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 23, 61, 82, 83, 84, 86, and 87 in
.artifacts/plan-runner/artist-album-attribution/; finished plans are in
.llm/plans/completed/artist-album-attribution/.
Register the add-by-rss-artist area in scripts/mobile/e2e-test.sh. Step 11 taps
add-by-rss-home-remove directly; plan 97 replaces that step's body next phase. Use the shared
TIMEOUT_* ladder for waits.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 11 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
formatters to your own files. Do not run tests or Maestro. This plan has no release scratchpad
entry.
When the plan is done, move 88-mobile-add-by-rss-artist-maestro.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **93 — Web: ask about albums when unsubscribing from an Add by RSS artist**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/artist-album-attribution/93-web-add-by-rss-artist-unsubscribe-prompt.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 71, 72, 73, 90, 91, and 92 in
.artifacts/plan-runner/artist-album-attribution/; finished plans are in
.llm/plans/completed/artist-album-attribution/.
Albums are worked out when Unsubscribe is pressed, fetching directory album ids five at a time;
if reading the stores fails, unsubscribe the artist alone with no dialog (D76). Call
pruneAddByRSSPublisherData() after removing the artist; albums the member never followed go
without asking (R59).
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 11 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 93-web-add-by-rss-artist-unsubscribe-prompt.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **95 — Mobile: every artist unsubscribe asks about albums**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/95-mobile-artist-unsubscribe-wiring.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 40, 83, 84, 85, and 94 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Use plan 40's verifiedAlbums and showDirectoryAlbums and plan 84's isArtistFeed; if they were
renamed, keep the rule and use the new names. Re-read ArtistDetailScreen.tsx and
AddByRssHomeDetailScreen.tsx; several earlier prompts changed them.
Other prompts run at the same time (00-EXECUTION-ORDER.md § Phase 11 names each owner). Edit only
the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks, builds, and formatters to your own files or workspace; report errors in files you do
not own instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close appends
it.
When the plan is done, move 95-mobile-artist-unsubscribe-wiring.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 12

- [ ] **96 — Playwright: the unsubscribe-from-artist dialog on web**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/96-web-artist-unsubscribe-e2e.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 13, 78, 92, and 93 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Move plan 78's fixture constants and payloads into helpers/addByRSSArtist.ts, keeping plan 78's
assertions. The Add by RSS case follows the directory album, not the Add by RSS album (D81).
Another prompt runs at the same time (00-EXECUTION-ORDER.md § Phase 12 names each owner). Edit
only the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
type-checks and formatters to your own files. Do not run tests or Playwright. This plan has no
release scratchpad entry.
When the plan is done, move 96-web-artist-unsubscribe-e2e.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **97 — Maestro: the unsubscribe-from-artist dialog on mobile**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/artist-album-attribution/97-mobile-artist-unsubscribe-maestro.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Read the notes in the
final messages of plans 41, 88, and 95 in .artifacts/plan-runner/artist-album-attribution/;
finished plans are in .llm/plans/completed/artist-album-attribution/.
Replace plan 88's step 11 body in add-by-rss-artist.yaml so it answers the dialog with Artist
Only (D80). Register the artist-unsubscribe area in scripts/mobile/e2e-test.sh. Use the shared
TIMEOUT_* ladder for waits.
Another prompt runs at the same time (00-EXECUTION-ORDER.md § Phase 12 names each owner). Edit
only the files your plan lists, with targeted edits, and never rewrite a shared file. Scope
formatters to your own files. Do not run tests or Maestro. This plan has no release scratchpad
entry.
When the plan is done, move 97-mobile-artist-unsubscribe-maestro.md to
.llm/plans/completed/artist-album-attribution/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Close

- [ ] **Close — Release entries, archive the set, cumulative verification**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
You close the artist-album-attribution plan set. Follow
.llm/plans/active/artist-album-attribution/00-EXECUTION-ORDER.md § Close, § Deploy order, and
§ Checks that need a person. Change no product, test, or guidance code. Do not run tests.

1. Append to release-notes/scratchpad.md every "Release notes entry" from the final messages in
   .artifacts/plan-runner/artist-album-attribution/ of prompts 01, 02, 03, 04, 05, 06, 10, 11,
   12, 22, 30, 40, 50, 51, 61, 62, 63, 64, 65, 67, 68, 70, 73, 74, 75, 76, 77, 82, 83, 84, 85, 86,
   87, 90, 92, 93, 95, in that order, unchanged, separated by one blank line. Also append an
   entry any other prompt's final message carries. Skip an entry already in the scratchpad. If
   one of those final messages has no entry, use the ## Release scratchpad block of that plan in
   .llm/plans/completed/artist-album-attribution/, skipping a block that says none. Never edit or
   remove another change's entry.
2. Confirm every numbered plan (01–06, 10–13, 20–23, 30, 40, 41, 50, 51, 60–68, 70–78, 80–88,
   90–97) is in .llm/plans/completed/artist-album-attribution/. If one is still in active/, stop
   and report BLOCKED naming it. Then move 00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md,
   and COPY-PASTA.md there, and remove the empty active directory.
3. Grep every final message in .artifacts/plan-runner/artist-album-attribution/ for blockers and
   for errors reported in files the prompt did not own, and list them in your final message.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. If plan 01's final message
says make db_regen_linear_baseline did not run, put it first in the Root block. Tell the operator
that Docker must be running for the Root block; that Mobile E2E Metro, Mobile E2E API, Mobile E2E
test-assets, and Mobile E2E iOS or Mobile E2E Android must be running for the Mobile Maestro
block, and that the E2E installs must be rebuilt first because plans 64, 65, and 68 change native
code; and that the device checks run against a local build with Mobile Metro running. Do not put
leave-running commands in the blocks. Say there is no dependency change, so no lockfile step.
Restate the deploy order (migration, then the ormVerifiedPublisherLinksBackfill command, then the
API with plan 11) and the person-only checks: iOS lock screen and Control Center, Android media
notification, CarPlay simulator, and Android Auto DHU for phone-started, car-started, and
download plays (plans 64, 65, 67, 68, with
apps/mobile/modules/podverse-media-engine/ANDROID-AUTO-DHU-CHECKLIST.md), plus Your Add by RSS
Albums on a directory artist page and the player line for a directory album an Add by RSS artist
lists (R47, R49, R52; no Maestro fixture covers them).

Root:
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
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
make e2e_test_report
open .artifacts/e2e-reports/latest/index.html

Mobile E2E iOS:
npm run mobile:e2e:ios

Mobile E2E Android:
npm run mobile:e2e:android

Mobile:
make mobile_e2e_seed

Mobile Maestro:
npm run mobile:e2e:test -- artist,track,album,player-screen,play-mini-player,library-downloads,add-by-rss,add-by-rss-track,add-by-rss-artist,artist-unsubscribe
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html

Mobile iOS (device checks, after the E2E run; Mobile Metro running):
npm run mobile:ios -- --device "iPhone 17 Pro"

Mobile Android (device checks; Mobile Metro running):
npm run mobile:android -- --device Pixel_6_Pro_API_33
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
