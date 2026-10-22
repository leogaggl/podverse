**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 46 — Item rows and detail play buttons show what plays on another device

List rows (`PlayButtonRow`) and detail headers (`PlayButtonLarge`) mark the item in the player:
active cluster style, pause icon, and, for rows, a thin progress line. In the `remote` role the
local player is cleared, so nothing would be marked. This plan matches rows against the remote
state's resource too, so the item playing on another device or tab shows as playing everywhere
on the site, with its row progress moving.

Clicking such a row already does the right thing: callers see the item as not local and call
`mediaPlayerResourceUpdate` or `playAddByRSS`, and plan 25 turns a pick of the item already
playing there into `play` or `pause`. This plan changes display only.

The local match is the parity source: the same identity rules (item, clip, soundbite, Add by RSS)
in the same precedence order as `PlayButtonRow` and `PlayButtonLarge` use today.

Before editing, confirm plan 42's `useRemotePlayerDisplay` and plan 43's
`useRemotePlaybackPositionSeconds` exist. If not, stop and report.

## Rows

R64

## Runs after

43

## Files

apps/web/src/lib/crossDevicePlayback/remotePlaybackRowMatch.ts
apps/web/src/lib/crossDevicePlayback/remotePlaybackRowMatch.test.ts
apps/web/src/hooks/useRemoteRowPlayback.ts
apps/web/src/components/MediaPlayer/Buttons/PlayButtonRow.tsx
apps/web/src/components/MediaPlayer/Buttons/PlayButtonLarge.tsx
apps/web/src/components/AddByRSS/Item/AddByRSSItemHeaderPlaySection.tsx
apps/web/src/components/AddByRSS/Podcast/Episode/AddByRSSEpisodeRow.tsx
apps/web/src/components/AddByRSS/Podcast/Episode/AddByRSSEpisodeDetailHeader.tsx
apps/web/src/components/AddByRSS/Artist/Album/Track/AddByRSSTrackDetailHeader.tsx
apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamRow.tsx
apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamDetailHeader.tsx

## Decisions this plan fixes

- **Views that show remote state:** the player bar, its mobile layout, and the modal (plans
  42–44), every list row and detail header that uses `PlayButtonRow` or `PlayButtonLarge`, and
  so the queue page's rows. Track rows that show no playing state today (`ListTrackRow`,
  `CommonTrackListRow`, `AddByRSSTrackRow`) still show none.
- **Chapter rows never match remotely.** A chapter plays as its item with a start position
  (plan 10), so the state cannot say which chapter row is current. The item's own row and header
  match.
- **An item row does not match a remote clip or soundbite of that item**, as `PlayButtonLarge`
  does locally (`item && !mpClip && !mpItemSoundbite`).
- **Add by RSS rows match by hash.** The remote ref carries `add_by_rss_hash_id`; rows compute
  `getAddByRSSHashIds(indexItem)` (feed form and legacy form, from `@podverse/parser-mapping`)
  and match when the list contains the ref's hash.
- **Playing** means the displayed status is not `paused` (`playing` or `loading`), the same rule
  plan 25's transport uses for the play button.
- **Live remote rows** get the active style and the pause icon but no progress line.
- **The queue page does not refetch** when the playing device changes items. Its rows re-mark
  from the remote state; the list itself updates on its next load, as it does today when another
  device changes the queue.

## `remotePlaybackRowMatch.ts`

```typescript
import type { DTOPlaybackResourceRef } from '@podverse/helpers';

export type PlaybackRowIdentity = {
  itemIdText: string | null;
  clipIdText: string | null;
  soundbiteIdText: string | null;
  isChapter: boolean;
  addByRSSHashIds: readonly string[] | null;
};

export function matchesRemotePlaybackResource(
  ref: DTOPlaybackResourceRef,
  identity: PlaybackRowIdentity
): boolean;
```

First rule that applies decides:

1. `addByRSSHashIds` non-null → `ref.kind === 'add_by_rss' && addByRSSHashIds.includes(ref.add_by_rss_hash_id)`.
2. `isChapter` → false.
3. `soundbiteIdText` non-null → `ref.kind === 'soundbite' && ref.item_soundbite_id_text === soundbiteIdText`.
4. `clipIdText` non-null → `ref.kind === 'clip' && ref.clip_id_text === clipIdText`.
5. `itemIdText` non-null → `ref.kind === 'item' && ref.item_id_text === itemIdText`.
6. Otherwise false.

Narrow on `ref.kind` before reading the kind's field; no `as`.

## `useRemoteRowPlayback.ts`

```typescript
export type RemoteRowPlayback = {
  isCurrent: boolean;
  isPlaying: boolean;
  showsProgress: boolean;
};

export function useRemoteRowPlayback(identity: PlaybackRowIdentity): RemoteRowPlayback;
```

- `const remote = useRemotePlayerDisplay();`
- `isCurrent` = `remote !== null && matchesRemotePlaybackResource(remote.resource.ref, identity)`.
- `isPlaying` = `isCurrent && remote.state.status !== 'paused'`.
- `showsProgress` = `isCurrent && remote.controls.showsProgress`.
- `useMemo` keyed on `remote` and the identity's primitive fields plus the `addByRSSHashIds`
  reference (callers memoize the array).

## `PlayButtonRow.tsx`

- New optional prop, documented like `addByRSSIdText`:
  `/** Add by RSS hash ids for this row (getAddByRSSHashIds), to match playback on another device. */ addByRSSHashIds?: readonly string[];`
- Call `useRemoteRowPlayback` **before** the `if (!item && !addByRSSIdText) return null;` early
  return, with `{ itemIdText: item?.id_text ?? null, clipIdText: clip?.id_text ?? null,
  soundbiteIdText: item_soundbite?.id_text ?? null, isChapter: item_chapter !== undefined,
  addByRSSHashIds: addByRSSHashIds ?? null }`.
- Rename the existing computed flag to `isLocalMatch` (same code). Then:
  - `const isCurrentlyInPlayer = isLocalMatch || remoteRow.isCurrent;`
  - `const isPlaying = (isLocalMatch && mpIsPlaying) || remoteRow.isPlaying;`
- Progress: `isLocalMatch ? <PlayButtonRowProgress /> : remoteRow.showsProgress ? <RemotePlayButtonRowProgress /> : null`.
- New file-local `RemotePlayButtonRowProgress`: `useRemotePlayerDisplay()` for
  `duration_seconds`, `useRemotePlaybackPositionSeconds(true)` for the position; ratio
  `duration > 0 ? clampRatio(position / duration) : 0`; the same markup, classes, and
  `data-testid="play-button-row-progress"` as `PlayButtonRowProgress`.

Only the matching row mounts `RemotePlayButtonRowProgress`, so only it runs the position tick.

## `PlayButtonLarge.tsx`

- Same new optional prop `addByRSSHashIds`.
- `useRemoteRowPlayback` with `{ itemIdText: item?.id_text ?? null, clipIdText: clip?.id_text ?? null,
  soundbiteIdText: item_soundbite?.id_text ?? null, isChapter: item_chapter !== undefined,
  addByRSSHashIds: addByRSSHashIds ?? null }` (hooks are already all before the error branch;
  keep that order).
- Existing computed flag renamed `isLocalMatch`; `isPlaying = (isLocalMatch && mpIsPlaying) || remoteRow.isPlaying`.
- The playback-error branch keeps using `isLocalMatch` only (errors are local).

## Callers that pass `addByRSSHashIds`

Each computes `const addByRSSHashIds = useMemo(() => (X ? getAddByRSSHashIds(X) : undefined), [X]);`
with `getAddByRSSHashIds` from `@podverse/parser-mapping` (already a web dependency:
`apps/web/src/hooks/usePlayAddByRSS.tsx` imports it), and passes it next to `addByRSSIdText`:

- `AddByRSSEpisodeRow.tsx` — `X` = `indexItem`, on its `PlayButtonRow`.
- `AddByRSSLivestreamRow.tsx` — `X` = `item`, on its `PlayButtonRow`.
- `AddByRSSLivestreamDetailHeader.tsx` — `X` = `indexItem`, on its `PlayButtonLarge`.
- `AddByRSSItemHeaderPlaySection.tsx` — new optional prop `addByRSSHashIds?: readonly string[]`
  passed through to `PlayButtonLarge`.
- `AddByRSSEpisodeDetailHeader.tsx` and `AddByRSSTrackDetailHeader.tsx` — `X` = `indexItem`, on
  their `AddByRSSItemHeaderPlaySection`.

`AddByRSSEpisodeHeader.tsx` and `AddByRSSTrackHeader.tsx` pass no identity today (placeholder
play); leave them.

If a hook call would land after an early return in a caller, move the `useMemo` above it.

## Must stay true

- With no remote view (roles `idle` and `active`), every row and header renders exactly as
  before.
- Display only: no row writes the MediaPlayer context, history, or position.

## Tests

Vitest, `remotePlaybackRowMatch.test.ts`:

- Item row matches an `item` ref with its id and not a `clip` ref of that item.
- Clip row matches its `clip` ref only; soundbite row its `soundbite` ref only.
- Chapter row (`isChapter: true` with an item id) never matches, even an `item` ref with the
  same id.
- Add by RSS row matches an `add_by_rss` ref whose hash is the legacy (second) entry of its
  list, and not one outside the list.
- No ids → false.

Plan 47's Playwright spec checks that the episode page's play button shows Pause while the
episode plays in another browser context, and that clicking it pauses the playing context.

## Release scratchpad

```markdown
## Web item rows show playback from another device

- Surfaces: web
- Change: The item playing on another signed-in device or another tab is marked as playing in
  web lists, the queue page, and detail pages, with its row progress moving. Clicking its play
  button there pauses or resumes it on the playing device. Chapter rows are not marked for
  playback on another device; the episode's own row is.
- Who notices: members with more than one device or tab open
- Operator steps: none
```
