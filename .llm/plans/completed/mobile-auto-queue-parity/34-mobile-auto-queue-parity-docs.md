**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 34 — Mobile queue parity doc and playback skill describe the shared auto-queue

Rewrite the auto-queue parts of the mobile queue parity doc and the **mobile-playback** skill so
they describe what plans 30–33 built: one shared helper both clients call, the eager fill, the
mobile Next rule, Previous through the auto-queue, and the Add by RSS feed walk. Docs only.

## Rows

R27, R3, R11

## Runs after

33

## Files

docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md
.cursor/skills/mobile-playback/SKILL.md

## Design

Read plans 30–33 and the code they produced (`useAutoQueueFill.ts`, `autoQueueFillGate.ts`,
`useAddByRssFeedWalk.ts`, `lib/addByRss/feedWalk.ts`, `autoQueueRepository.createSourceFetchers`)
before writing; describe the code as it stands.

### `DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md`

- **§1 Executive summary, "Reuse the same API sequences":** auto-queue source choice and walks are
  shared code in `@podverse/playback-core` (`./autoQueue`, `./autoQueueWalk`,
  `./addByRSSListWalk`); each client passes its own fetchers.
- **§4 table:** add the auto-queue helpers to the "Moves to `playback-core`" column, and
  `autoQueueRepository.createSourceFetchers` plus `useAutoQueueFill` to the mobile column.
- **§5 table, `add-by-rss` row:** add "next and previous walk the feed (newer / older)".
- **§8 Auto-queue parity:** replace the "replicate the same source logic and `req*` calls" paragraph
  with:
  - The shared helper owns source choice, the forward fill, repeat wrap, paging, dedupe, the
    playable-row check, and the backward walk. Web and mobile call it with their own fetchers.
  - Mobile fills right after every load that has a seed (`refillAutoQueueAhead` in `playTarget`),
    after Shuffle or Repeat, and on a Next press or `ended` with no row loaded. One gate keeps one
    fill in flight per playing item and drops results for an item that is no longer playing.
  - Rows live in `AutoQueueProvider`, with synchronous refs in `useAutoQueueFill`;
    `writeAutoQueueState` is the only writer.
  - **Agreed difference — Next:** web never disables Next. Mobile turns Next on once the manual
    queue for the playing medium, a found auto-queue row, or a newer Add by RSS feed item exists,
    and keeps it off at the true end.
  - **Previous:** chapters first; restart past 3 seconds (tap only; the hold and the remote command
    skip that rule); step back through played auto-queue rows; before row 0, the previous playlist
    row, album track (season order), or episode (publish date), loaded with the buffer cleared and
    the config kept; shuffle restarts. Account queue history is not used.
  - **Add by RSS:** next and previous walk the playing item's feed on this device (episodes newest
    first by publish date, livestreams in the feed's live order). Mobile rebuilds the walk from the
    playing item after each load; web keeps the list the item was played from. Next and `ended`
    both check the manual queue first.
- **§12 Testing parity:** name the unit tests (`autoQueueWalk.test.ts`,
  `addByRSSListWalk.test.ts`, `autoQueueFillGate.test.ts`, `feedWalk.test.ts`) and the
  `auto-queue-advance` flow's Next-enabled check.
- **Ended/skip diagram:** keep the manual-first order; replace "Increment auto-queue active row /
  Fetch more" with: next auto-queue row loaded? yes → load it; no → `refillAutoQueueAhead` → row
  found? load : stop (complete) or stay (skip). Add an Add by RSS branch after the manual check:
  newer feed item? load : stop or stay.
- Leave §11 (native car layer) to area D, which edits it for the native window. Do not touch it here.

### `.cursor/skills/mobile-playback/SKILL.md`

- The parity table's auto-queue row: web `AutoQueue.tsx` with the shared
  `@podverse/playback-core/autoQueue` / `autoQueueWalk`; mobile `AutoQueueProvider` +
  `useAutoQueueFill`; note the fetchers are per client.
- "Queue + auto-queue on ended/skip", step 3: the next row is usually already loaded by the eager
  fill; otherwise `refillAutoQueueAhead` fetches it. An Add by RSS item walks its feed instead.
- The previous/next bullets (the transport section and the full-player section): Previous without
  chapters restarts past 3 seconds, else steps back through played auto-queue rows, then walks the
  source backward; shuffle restarts; no account queue history. Next is enabled only when something
  is next (the agreed difference from web).
- The "Do mirror web `req*` sequences" line: auto-queue goes through the shared helper; mirror web
  `req*` sequences for the manual queue and playlists.
- Keep the skill's existing structure and length; change only the lines above.

## Constraints

- Docs describe the behavior as it stands; no plan numbers, no "previously" or "was".
- No third-party media-player comparisons (**no-third-party-media-player-style**).
- Title case for headings only where the doc already uses it.

## Tests

none (docs only)

## Release scratchpad

none
