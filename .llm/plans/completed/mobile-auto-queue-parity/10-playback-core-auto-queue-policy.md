**Cursor model:** Codex 5.3 · **Reasoning:** high

# 10 — Auto-queue policy in `@podverse/playback-core`

Move the auto-queue decision that web and mobile each carry a copy of into `@podverse/playback-core`:
source choice, the forward fill with repeat wrap and paging, row mapping, the playable-row check,
shuffle dedupe, the backward walk Previous uses, the config transitions, and a "fill until N rows
are ahead" entry point for the native window. Each surface passes its own fetch functions in.

This plan edits only `packages/playback-core/**` (plus the release scratchpad). It changes no
caller. Web moves onto these exports in area B (plans 20–29), mobile in area C (plans 30–39), and
the native window in area D (plans 40–49).

## Rows

R1, R2, R4, R22, R26

## Runs after

none

## Files

packages/playback-core/src/autoQueue.ts
packages/playback-core/src/autoQueueWalk.ts
packages/playback-core/src/__tests__/autoQueue.test.ts
packages/playback-core/src/__tests__/autoQueueWalk.test.ts
packages/playback-core/src/index.ts
packages/playback-core/package.json
packages/playback-core/PACKAGES-PLAYBACK-CORE.md
release-notes/scratchpad.md

## Answers to the question rows

### R1, R2 — how web auto-queue works

Yes, web has it, and the behavior is consistent. The parity source is web:

- **Buffer.** `autoQueueResources` (`apps/web/src/contexts/AutoQueue.tsx`) is a client-only map
  keyed `0..n`. Row 0 is the item an explicit play started. `autoQueueActiveRow` points at the row
  playing now. It is separate from the account queue the user builds.
- **Explicit play** (episode row, track row, playlist row, clip, and so on) passes a new
  `AutoQueueConfig`: keeps `random` and `repeat`, sets `playlist_id_text` (the playlist when played
  from a playlist, otherwise `null`), `nextPage: 1`, a fresh `shuffleHash`, `disabled: false`, with
  `autoQueueShouldClear: true`. Moves within the auto-queue pass `autoQueueShouldClear: false`.
- **Eager fill.** `useMediaPlayerControllerQueueHeadLoading` reloads the buffer each time the
  playing item changes, when the active row is the highest key or the buffer is empty.
- **Source choice** (`useAutoQueueLoadResources`):

  | Config | Source | Repeat wrap when empty |
  | --- | --- | --- |
  | playlist, not shuffled | playlist rows after the current row, by list position | playlist page 1 |
  | playlist, shuffled | playlist shuffle page `nextPage` with `shuffleHash` | shuffle page 1, `nextPage` becomes 2 |
  | channel, shuffled | channel shuffle page `nextPage` with `shuffleHash` | shuffle page 1, `nextPage` becomes 2 |
  | music channel | items after the current item in season order | channel season list page 1 |
  | podcast channel | items after the current item by publish date (newer) | channel recent list page 1 (newest first) |

- **Mapping.** Playlist rows map clip, then soundbite, then item; removed rows are skipped
  (`isPlayablePlaylistResource`). Channel rows map one item each. New rows append after the
  highest key.
- **Shuffle dedupe.** In random mode the whole buffer is deduped by clip, soundbite, and item
  `id_text` (first occurrence wins) and renumbered from 0.
- **Advance.** Ended and Next go through `resolveQueueAdvance`: manual queue first, then the next
  auto-queue row, which loads with `musicIntent: 'fresh_transition'`. The web Next button is never
  disabled.
- **Previous** (`useTrackPreviousButtonActions`): chapters first; past 3 seconds restart; otherwise
  step back one auto-queue row; at row 0 with shuffle on, restart; otherwise fetch the item before
  the current one (playlist list position, season order for music, publish date for podcasts) and
  play it with a cleared buffer; nothing found restarts.
- **Shuffle and Repeat toggles** clear the buffer, reset the active row to 0, change the config,
  and reload. The `aqc.rd` / `aqc.rp` cookie keeps them across sessions.
- **Add by RSS** items do not use this buffer. They walk a list context of feed item ids
  (plan 11).

### R4 — shared helpers

Yes. The two loaders are the same policy line for line; only the fetch transport differs
(`getApiRequestService()` on web, `autoQueueRepository` with auth refresh on mobile). This plan
shares the decision. Each surface keeps its own fetch, storage, React state, refs, and
stale-result guards (**reuse-beyond-components**). Another client (area D's native window, a later
surface) implements the same fetcher interface and gets the same rows.

### R26 — `isPlayablePlaylistResource` versus the mobile inline check

Web drops a row when the resource or its clip is removed, or when the clip, soundbite, or plain row
has no embedded `item`. Mobile checks only the two removed flags, then falls through its mapping:
a clip row whose clip has no `item` is queued as the plain episode when the resource also carries
`item`, where web drops it. Mobile also treats an empty-string `playlist_id_text` as a playlist
source; web does not. The shared `isPlayablePlaylistResource` is web's version, and source choice
uses web's truthy rule. Mobile picks both up when area C moves onto the helper.

## Design

### Module split

- `src/autoQueue.ts` — synchronous and pure: types, buffer helpers, selectors, config
  transitions, seed from a `PlaybackTarget`, the playable check, row mapping, dedupe, and source
  choice.
- `src/autoQueueWalk.ts` — the fetcher interface and the async walks that call it:
  `fillAutoQueueForward`, `fillAutoQueueAhead`, `resolveAutoQueuePrevious`.

Both are exported from `src/index.ts` and as package subpaths `./autoQueue` and
`./autoQueueWalk` in `package.json` `exports` (mobile imports playback-core values by subpath).

### Imports

- Types via `import type { … } from '@podverse/helpers'` (as other playback-core files do).
- `MediumEnum` from `@podverse/helpers/medium` (mobile-safe subpath).
- `isRemovedSource` from `@podverse/helpers` (no subpath exists; the mobile loader already imports
  it from the barrel, and playback-core already imports barrel values).
- Relative imports use `.js` specifiers (Tier A). No `@podverse/helpers-requests`: shuffle hashes
  come in as a `nextShuffleHash: () => string` argument.

### Contract (`src/autoQueue.ts`)

Type names match the web and mobile types they replace, so callers swap imports without renames.

```typescript
export type AutoQueueResourcesMapRow = {
  item: DTOItemQueueItem;
  clip: DTOClip | null;
  item_soundbite: DTOItemSoundbite | null;
  channel: DTOChannel | null;
};
export type AutoQueueResourcesMap = { [key: number]: AutoQueueResourcesMapRow };
export type AutoQueueConfig = {
  playlist_id_text: string | null;
  disabled: boolean;
  random: boolean;
  repeat: boolean;
  nextPage: number;
  shuffleHash: string;
};
/** The playing resource the walks start from. Add by RSS and livestreams have none. */
export type AutoQueueSeed = {
  item: DTOItemQueueItem;
  channel: DTOChannel;
  clip: DTOClip | null;
  item_soundbite: DTOItemSoundbite | null;
};
export type AutoQueueSource =
  | { kind: 'playlist-list-position'; playlistIdText: string }
  | { kind: 'playlist-shuffle'; playlistIdText: string }
  | { kind: 'channel-shuffle'; channelIdText: string }
  | { kind: 'channel-season'; channelIdText: string }
  | { kind: 'channel-pub-date'; channelIdText: string };

export function checkIsActiveRowHighestKey(activeRow: number | null, resources: AutoQueueResourcesMap): boolean;
export function autoQueueIncrementActiveRow(activeRow: number | null): number;
export function countAutoQueueRowsAhead(resources: AutoQueueResourcesMap, activeRow: number | null): number;
export function selectAutoQueueRowsAhead(resources: AutoQueueResourcesMap, activeRow: number | null, limit: number): AutoQueueResourcesMapRow[];
export function hasAutoQueueRowAfter(resources: AutoQueueResourcesMap, activeRow: number | null): boolean;

export function createDefaultAutoQueueConfig(nextShuffleHash: () => string): AutoQueueConfig;
export function resolveAutoQueueConfigForExplicitPlay(current: AutoQueueConfig, playlistIdText: string | null, nextShuffleHash: () => string): AutoQueueConfig;
export function toggleAutoQueueShuffle(current: AutoQueueConfig, nextShuffleHash: () => string): AutoQueueConfig;
export function toggleAutoQueueRepeat(current: AutoQueueConfig): AutoQueueConfig;

export function autoQueueSeedFromPlaybackTarget(target: PlaybackTarget | null): AutoQueueSeed | null;
export function isPlayablePlaylistResource(resource: DTOPlaylistResource): boolean;
export function autoQueueRowFromPlaylistResource(resource: DTOPlaylistResource): AutoQueueResourcesMapRow | null;
export function autoQueueRowFromItem(item: DTOItemQueueItem): AutoQueueResourcesMapRow;
export function dedupeAutoQueueResources(resources: AutoQueueResourcesMap): AutoQueueResourcesMap;
export function resolveAutoQueueSource(config: AutoQueueConfig, seed: AutoQueueSeed): AutoQueueSource | null;
```

Behavior:

- `checkIsActiveRowHighestKey` and `autoQueueIncrementActiveRow` are the web functions as they
  stand (null or below 1 increments to 1).
- Rows ahead are the contiguous keys after `max(activeRow ?? 0, 0)`, in ascending key order.
  `selectAutoQueueRowsAhead` stops at `limit` or the first missing key. `hasAutoQueueRowAfter` is
  `countAutoQueueRowsAhead(…) > 0`.
- `createDefaultAutoQueueConfig`: `playlist_id_text: null`, `disabled: false`, `random: false`,
  `repeat: false`, `nextPage: 1`, `shuffleHash: nextShuffleHash()`.
- `resolveAutoQueueConfigForExplicitPlay`: keeps `random` and `repeat`; sets `playlist_id_text`,
  `disabled: false`, `nextPage: 1`, `shuffleHash: nextShuffleHash()`. This is web's explicit-play
  config for both a playlist play and a channel play.
- `toggleAutoQueueShuffle`: flips `random`, `nextPage: 1`, new hash (web `ShuffleButton`).
  `toggleAutoQueueRepeat`: flips `repeat`, `nextPage: 1`, keeps the hash (web `RepeatButton`).
  Clearing the buffer and active row stays with the caller.
- `autoQueueSeedFromPlaybackTarget`: `clip` gives the clip seed, `soundbite` the soundbite seed,
  `chapter` and the three `item-*` kinds give the item seed with clip and soundbite null,
  `add-by-rss` and `livestream` give null. Same as mobile `currentAutoQueueSeed`.
- `isPlayablePlaylistResource`: web's function as it stands in
  `apps/web/src/lib/playlist/playablePlaylistResource.ts`.
- `autoQueueRowFromPlaylistResource`: null when not playable; otherwise clip row
  (`item: clip.item`, `channel: clip.item.channel ?? null`), else soundbite row, else item row.
  Narrow with checks; no `as`.
- `autoQueueRowFromItem`: `{ item, clip: null, item_soundbite: null, channel: item.channel ?? null }`.
- `dedupeAutoQueueResources`: the loaders' random-mode dedupe — walk keys ascending, keep the first
  clip `id_text`, soundbite `id_text`, or item `id_text` (three separate seen-sets, a row counts
  by its clip when present, else its soundbite, else its item), renumber kept rows from 0.
- `resolveAutoQueueSource`: `config.disabled` gives null. A non-empty `playlist_id_text` gives
  `playlist-shuffle` when `random`, else `playlist-list-position`. Otherwise `channel-shuffle` when
  `random`, `channel-season` when `seed.channel.medium_id === MediumEnum.Music`, else
  `channel-pub-date`, all with `seed.channel.id_text`. Neither loader checks `disabled` today; no
  web config sets it outside the embed, which never applies its config, so this changes nothing on
  web and matches mobile's `computeHasAutoQueueNext`.

### Contract (`src/autoQueueWalk.ts`)

```typescript
export type AutoQueueDirection = 'forward' | 'backward';

/** Each surface implements these with its own transport. Return the row arrays, not response wrappers. */
export type AutoQueueSourceFetchers = {
  fetchPlaylistResourcesByListPosition: (playlistIdText: string, cursor: PlaylistResourceIdTextOptions, direction: AutoQueueDirection) => Promise<DTOPlaylistResource[]>;
  fetchPlaylistResourcesByShuffle: (playlistIdText: string, params: { page: number; shuffleHash: string }) => Promise<DTOPlaylistResource[]>;
  fetchPlaylistResourcesFirstPage: (playlistIdText: string) => Promise<DTOPlaylistResource[]>;
  fetchChannelItemsByShuffle: (channelIdText: string, params: { page: number; shuffleHash: string }) => Promise<DTOItemQueueItem[]>;
  fetchItemsBySeason: (itemIdText: string, direction: AutoQueueDirection) => Promise<DTOItemQueueItem[]>;
  fetchChannelItemsBySeasonFirstPage: (channelIdText: string) => Promise<DTOItemQueueItem[]>;
  fetchItemsByPubDate: (itemIdText: string, direction: AutoQueueDirection) => Promise<DTOItemQueueItem[]>;
  fetchChannelItemsRecentFirstPage: (channelIdText: string) => Promise<DTOItemQueueItem[]>;
};

export type AutoQueueFillInput = {
  config: AutoQueueConfig;
  seed: AutoQueueSeed | null;
  resources: AutoQueueResourcesMap;
  fetchers: AutoQueueSourceFetchers;
};
export type AutoQueueFillResult = {
  resources: AutoQueueResourcesMap;
  /** `nextPage` advanced for shuffle sources; otherwise the input config. */
  config: AutoQueueConfig;
  /** Rows the source returned, after the repeat wrap, before the playable filter and dedupe. */
  fetchedCount: number;
  /** New keys in `resources` after mapping and dedupe. */
  appendedCount: number;
  /** The source has nothing further: no source, or it returned no rows after the repeat wrap. */
  exhausted: boolean;
};
export function fillAutoQueueForward(input: AutoQueueFillInput): Promise<AutoQueueFillResult>;

export type AutoQueueFillAheadInput = AutoQueueFillInput & {
  activeRow: number | null;
  minRowsAhead: number;
  /** Upper bound on source requests in one call. Default 3. */
  maxFetches?: number;
};
export function fillAutoQueueAhead(input: AutoQueueFillAheadInput): Promise<AutoQueueFillResult>;

export type AutoQueuePreviousInput = {
  config: AutoQueueConfig;
  seed: AutoQueueSeed;
  activeRow: number;
  fetchers: AutoQueueSourceFetchers;
};
export type AutoQueuePreviousDecision =
  | { kind: 'step-back-row'; row: number }
  | { kind: 'load-previous'; resource: AutoQueueResourcesMapRow & { channel: DTOChannel } }
  | { kind: 'restart' };
export function resolveAutoQueuePrevious(input: AutoQueuePreviousInput): Promise<AutoQueuePreviousDecision>;
```

`PlaylistResourceIdTextOptions` is the type from `@podverse/helpers`.

#### `fillAutoQueueForward`

1. `seed === null`: return `resources: {}`, the input config, counts 0, `exhausted: true`. Both
   loaders empty the buffer here.
1. Start from a copy of `resources`. When key 0 is missing, put the seed at key 0 (both loaders).
1. `resolveAutoQueueSource(config, seed)`; null returns the seeded map, counts 0, `exhausted: true`,
   with no fetch.
1. The **cursor** is the row at the highest key. Web walks from the playing item, and both
   surfaces fill only when the active row is the highest key or the buffer is empty (Shuffle and
   Repeat clear first), so the two are the same on every current path. Walking from the highest
   key is what lets `fillAutoQueueAhead` fetch more than one page.
1. Fetch by source, with the repeat wrap applied only when `config.repeat` and the first fetch
   returned no rows:
   - `playlist-list-position`: `fetchPlaylistResourcesByListPosition(id, { item_id_text, clip_id_text, item_soundbite_id_text }, 'forward')`
     from the cursor row (`clip_id_text` and `item_soundbite_id_text` only when present); wrap with
     `fetchPlaylistResourcesFirstPage(id)`. Config unchanged.
   - `playlist-shuffle` and `channel-shuffle`: page `config.nextPage` with `config.shuffleHash`;
     result config `nextPage + 1`. On wrap, page 1 and result config `nextPage: 2`. The hash stays.
   - `channel-season`: `fetchItemsBySeason(cursor.item.id_text, 'forward')`; wrap with
     `fetchChannelItemsBySeasonFirstPage(channelIdText)`.
   - `channel-pub-date`: `fetchItemsByPubDate(cursor.item.id_text, 'forward')`; wrap with
     `fetchChannelItemsRecentFirstPage(channelIdText)`. This is web's wrap as it stands: the
     recent list is newest first, so a repeating podcast resumes from the newest episode.
1. Map playlist rows with `autoQueueRowFromPlaylistResource` (skip null) and item rows with
   `autoQueueRowFromItem`; append at `max key + 1` onward with no gaps.
1. When `config.random`, apply `dedupeAutoQueueResources` to the whole map, as both loaders do.
   Rows that dedupe drops are always appended ones, so keys at or below the active row never move.
   Because the whole buffer is deduped, a shuffle that wraps under repeat appends nothing once
   every row has played. That matches web as it stands.
1. `appendedCount` is the final key count minus the starting key count (after seeding).
   `exhausted` is `fetchedCount === 0`.

Fetcher errors propagate. Callers decide whether a failed fill reads as "no next row".

#### `fillAutoQueueAhead`

Loop `fillAutoQueueForward`, feeding each result's `resources` and `config` into the next call,
while `countAutoQueueRowsAhead(resources, activeRow) < minRowsAhead`, the last result was not
exhausted, the last result appended at least one row, and fewer than `maxFetches` fills ran.
Return the last `resources`, `config`, and `exhausted`, with `fetchedCount` and `appendedCount`
summed. Stopping on zero appended rows keeps a page of removed playlist rows, or a shuffle page of
duplicates, from repeating the same request. When the target is already met, return the input
without fetching (`exhausted: false`, counts 0).

This is the window entry point for area D: fill, then `selectAutoQueueRowsAhead(result.resources, activeRow, n)`.

#### `resolveAutoQueuePrevious`

Web's `runCorePreviousTrack`, without the chapter and 3-second rules (those stay with each
surface's track button):

1. `activeRow > 0`: `{ kind: 'step-back-row', row: activeRow - 1 }`. No fetch.
1. `config.random`: `restart`. No fetch.
1. `resolveAutoQueueSource(config, seed)` null: `restart`.
1. `playlist-list-position`: `fetchPlaylistResourcesByListPosition(id, seedCursor, 'backward')`;
   the first row where `autoQueueRowFromPlaylistResource` is non-null.
1. `channel-season`: `fetchItemsBySeason(seed.item.id_text, 'backward')[0]`;
   `channel-pub-date`: `fetchItemsByPubDate(seed.item.id_text, 'backward')[0]`; mapped with
   `autoQueueRowFromItem`.
1. A found row with a non-null `channel` gives `load-previous`; anything else gives `restart`
   (web requires both item and channel before it loads).

What the caller does with `load-previous` stays per surface. Web loads it with
`musicIntent: 'explicit_play'`, keeps the config, and clears the buffer.

## Constraints

- Pure TypeScript: no React, DOM, React Native, timers, or module state.
- TypeScript strict, no `any`, no `as` (other than `as const`), `===` only, named exports,
  separate `import type` lines, semicolons, single quotes.
- Comments describe the code as it stands; no plan numbers, no "ported from".
- `src/index.ts`: add the new exports as one block after the `resolveQueueAdvance` export, in the
  file's existing style. The `cross-device-playback` set also edits this file; whichever merges
  second keeps both blocks.
- `PACKAGES-PLAYBACK-CORE.md` § What lives here: add one bullet for the auto-queue policy (source
  choice, walks, mapping, dedupe, config transitions, fetcher interface) and one sentence saying
  each surface supplies `AutoQueueSourceFetchers`. Drop "(later)" from the intro, since mobile
  already imports this package.

## Tests

Vitest, `packages/playback-core/src/__tests__/`, behavior-focused (**unit-test-design-no-overgranularity**).
Build fixtures with small local factory functions typed against the helpers DTOs; no `as`.

`autoQueue.test.ts`:

- `resolveAutoQueueSource` gives each of the five sources, null when `disabled`, and a channel
  source when `playlist_id_text` is `''`.
- `isPlayablePlaylistResource` rejects a removed resource, a removed clip, a clip with no item,
  and a soundbite with no item; accepts a plain item row.
- `autoQueueRowFromPlaylistResource` prefers clip, then soundbite, then item, and takes the
  channel from the nested item.
- `dedupeAutoQueueResources` keeps first occurrences per kind and renumbers from 0.
- Rows-ahead selectors: count, `limit`, a gap stops the walk, a null active row counts from 0.
- Config transitions: explicit play keeps `random` and `repeat` and mints a hash; shuffle toggle
  mints a hash; repeat toggle keeps it.
- `autoQueueSeedFromPlaybackTarget` for clip, soundbite, chapter, an item kind, Add by RSS, and
  livestream.

`autoQueueWalk.test.ts` (fake fetchers that record calls and return queued arrays):

- Null seed empties the buffer; an empty buffer seeds key 0 and appends from key 1.
- List-position playlist walks forward from the highest-key row's ids, skips unplayable rows
  without gaps, wraps to the first page only with repeat, and reports `exhausted` without it.
- Shuffle sources request `nextPage`, advance it, wrap to page 1 with `nextPage: 2`, keep the hash.
- Season and publish-date sources walk from the highest-key item and wrap to their first pages.
- Random mode dedupes appended rows.
- Disabled config seeds key 0 and fetches nothing.
- `fillAutoQueueAhead` stops when the target is met, at `maxFetches`, on `exhausted`, and on a fill
  that appended nothing, and feeds the advanced `nextPage` into the next fill.
- `resolveAutoQueuePrevious`: steps back a row without fetching; restarts under shuffle without
  fetching; loads the first playable playlist row backward; loads the first season or publish-date
  item backward; restarts on no rows and on a row with no channel.
- A rejecting fetcher rejects `fillAutoQueueForward`.

## Release scratchpad

```markdown
## Shared auto-queue policy in playback-core

- Surfaces: packages (`@podverse/playback-core`)
- Change: new exports for auto-queue source choice (playlist in order or shuffled, music by season, podcast by publish date, channel shuffle), the forward fill with repeat wrap and shuffle paging, the backward walk Previous uses, playlist row mapping and the playable-row check, shuffle dedupe, config transitions, and `fillAutoQueueAhead` for filling a bounded window. Each client passes its own fetch functions (`AutoQueueSourceFetchers`). Available from the package root and the `./autoQueue` and `./autoQueueWalk` subpaths. No caller changes in this entry.
- Who notices: developers of web, mobile, and other clients; no user-visible change on its own
- Operator steps: none
```
