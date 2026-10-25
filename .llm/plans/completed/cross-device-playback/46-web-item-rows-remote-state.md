**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 46 — Item rows, chapter rows, and detail play buttons show what plays on another device

List rows (`PlayButtonRow`) and detail headers (`PlayButtonLarge`) mark the item in the player:
active cluster style, pause icon, and, for rows, a thin progress line. Chapter rows
(`ListItemChapterRow`) also highlight the current chapter's title. In the `remote` role the local
player is cleared, so nothing would be marked. This plan matches rows against the remote state's
resource too, so the item playing on another device or tab shows as playing everywhere on the
site, with its row progress moving, and the chapter that device is in is highlighted on the
episode's Chapters tab and on the chapter page.

The local match is the parity source: the same identity rules (item, chapter, clip, soundbite,
Add by RSS) in the same precedence order as `PlayButtonRow` and `PlayButtonLarge` use today.

**Where the remote chapter comes from.** Plan 49's `remotePlayerResourceStore` holds the remote
item's chapters (`reqItemParseAndGetChapters`, loaded by the player's `useRemotePlayerResource`
in plan 42), and plan 49's `useRemoteActiveChapterIdText` picks the chapter at the playing
device's estimated position (plan 11's estimate through plan 49's shared clock) with the local
rule, `selectItemChapterForTime`. Rows only read the store; they never start a load.

Clicking an item row already does the right thing: callers see the item as not local and call
`mediaPlayerResourceUpdate` or `playAddByRSS`, and plan 25 turns a pick of the item already
playing there into `play` or `pause`. A chapter pick carries the chapter's start, which plan 25
sends as `play_item` (a restart at that chapter), so the current remote chapter's own play button
toggles through `usePlayerTransport().togglePlayPause()` instead, as the local current chapter
toggles `mpIsPlaying` today.

Before editing, confirm plan 42's `useRemotePlayerDisplay`, plan 49's
`useRemotePlaybackPositionSeconds`, `useRemoteActiveChapterIdText`, and
`remotePlayerResourceStore`, and plan 25's `usePlayerTransport` exist. If not, stop and report.

## Rows

R64, R82

## Runs after

42, 49

## Files

apps/web/src/lib/crossDevicePlayback/remotePlaybackRowMatch.ts
apps/web/src/lib/crossDevicePlayback/remotePlaybackRowMatch.test.ts
apps/web/src/hooks/useRemoteRowPlayback.ts
apps/web/src/components/MediaPlayer/Buttons/PlayButtonRow.tsx
apps/web/src/components/MediaPlayer/Buttons/PlayButtonLarge.tsx
apps/web/src/components/List/ItemChapters/ListItemChapterRow.tsx
apps/web/src/components/Media/ItemChapter/ItemChapterHeaderPlaySection.tsx
apps/web/src/components/AddByRSS/Item/AddByRSSItemHeaderPlaySection.tsx
apps/web/src/components/AddByRSS/Podcast/Episode/AddByRSSEpisodeRow.tsx
apps/web/src/components/AddByRSS/Podcast/Episode/AddByRSSEpisodeDetailHeader.tsx
apps/web/src/components/AddByRSS/Artist/Album/Track/AddByRSSTrackDetailHeader.tsx
apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamRow.tsx
apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamDetailHeader.tsx

## Decisions this plan fixes

- **Views that show remote state:** the player bar, its mobile layout, and the modal (plans
  42–44), every list row and detail header that uses `PlayButtonRow` or `PlayButtonLarge`, chapter
  rows and the chapter page header, and so the queue page's rows. Track rows that show no playing
  state today (`ListTrackRow`, `CommonTrackListRow`, `AddByRSSTrackRow`) still show none.
- **Chapter rows match the playing device's current chapter.** A chapter row is current when the
  remote ref is an `item` and the remote active chapter id (plan 49) equals the row's chapter id.
  Chapter ids are unique and the active id is picked from the remote item's own chapters, so the
  item id needs no separate check. The highlight moves as the estimate crosses chapter starts,
  with no event from the playing device. No chapter is current for a remote clip or official
  clip, a live item, or an Add by RSS item: plan 49 loads no chapters for those, as the local
  player follows none for them.
- **The item's own row and header still match** while one of its chapters plays, as locally.
- **An item row does not match a remote clip or soundbite of that item**, as `PlayButtonLarge`
  does locally (`item && !mpClip && !mpItemSoundbite`).
- **Add by RSS rows match by hash.** The remote ref carries `add_by_rss_hash_id`; rows compute
  `getAddByRSSHashIds(indexItem)` (feed form and legacy form, from `@podverse/parser-mapping`)
  and match when the list contains the ref's hash.
- **Playing** means the displayed status is not `paused` (`playing` or `loading`), the same rule
  plan 25's transport uses for the play button.
- **Live remote rows** get the active style and the pause icon but no progress line.
- **Row actions are unchanged.** Rows' own Add to Playlist, Share, and More actions use the row's
  data, not the player, so they already work while another device plays.
- **The queue page does not refetch** when the playing device changes items. Its rows re-mark
  from the remote state; the list itself updates on its next load, as it does today when another
  device changes the queue.

## `remotePlaybackRowMatch.ts`

```typescript
import type { DTOPlaybackResourceRef } from '@podverse/helpers';

export type PlaybackRowIdentity = {
  itemIdText: string | null;
  chapterIdText: string | null;
  clipIdText: string | null;
  soundbiteIdText: string | null;
  addByRSSHashIds: readonly string[] | null;
};

export function matchesRemotePlaybackResource(
  ref: DTOPlaybackResourceRef,
  identity: PlaybackRowIdentity,
  activeChapterIdText: string | null
): boolean;
```

First rule that applies decides:

1. `addByRSSHashIds` non-null → `ref.kind === 'add_by_rss' && addByRSSHashIds.includes(ref.add_by_rss_hash_id)`.
2. `chapterIdText` non-null → `ref.kind === 'item' && activeChapterIdText === chapterIdText`.
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
- `const resourceState = useSyncExternalStore(remotePlayerResourceStore.subscribe, remotePlayerResourceStore.getState, getServerResourceState);`
  (`getServerResourceState` is a file-local constant returning `{ status: 'none', key: null }`).
  Read only: the player's `useRemotePlayerResource` (plan 42) starts the load.
- `const chapters = identity.chapterIdText !== null && remote !== null && resourceState.status === 'ready' && resourceState.key === playbackResourceRefKey(remote.resource.ref) && resourceState.resource.kind === 'database' ? resourceState.resource.itemChapters : null;`
- `const activeChapterIdText = useRemoteActiveChapterIdText(chapters, chapters !== null);`
  Only chapter rows of the remote item subscribe to the clock, and each re-renders only when the
  active chapter id changes.
- `isCurrent` = `remote !== null && matchesRemotePlaybackResource(remote.resource.ref, identity, activeChapterIdText)`.
- `isPlaying` = `isCurrent && remote.state.status !== 'paused'`.
- `showsProgress` = `isCurrent && remote.controls.showsProgress`.
- `useMemo` keyed on `remote`, `activeChapterIdText`, and the identity's primitive fields plus the
  `addByRSSHashIds` reference (callers memoize the array).

## `PlayButtonRow.tsx`

- New optional prop, documented like `addByRSSIdText`:
  `/** Add by RSS hash ids for this row (getAddByRSSHashIds), to match playback on another device. */ addByRSSHashIds?: readonly string[];`
- Call `useRemoteRowPlayback` **before** the `if (!item && !addByRSSIdText) return null;` early
  return, with `{ itemIdText: item?.id_text ?? null, chapterIdText: item_chapter?.id_text ?? null,
  clipIdText: clip?.id_text ?? null, soundbiteIdText: item_soundbite?.id_text ?? null,
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
- `useRemoteRowPlayback` with `{ itemIdText: item?.id_text ?? null, chapterIdText: item_chapter?.id_text ?? null,
  clipIdText: clip?.id_text ?? null, soundbiteIdText: item_soundbite?.id_text ?? null,
  addByRSSHashIds: addByRSSHashIds ?? null }` (hooks are already all before the error branch;
  keep that order).
- Existing computed flag renamed `isLocalMatch`; `isPlaying = (isLocalMatch && mpIsPlaying) || remoteRow.isPlaying`.
- The playback-error branch keeps using `isLocalMatch` only (errors are local).

## `ListItemChapterRow.tsx`

- `const remoteChapter = useRemoteRowPlayback({ itemIdText: null, chapterIdText: item_chapter.id_text, clipIdText: null, soundbiteIdText: null, addByRSSHashIds: null });`
  (memoize the identity on `item_chapter.id_text`).
- `const { togglePlayPause } = usePlayerTransport();`
- `const isCurrentChapter = mpItemChapter?.id_text === item_chapter.id_text || remoteChapter.isCurrent;`
  drives the existing `highlighted-text` class (still only when `!showItemInfo`).
- `playButtonOnClick`: a new first branch, `if (remoteChapter.isCurrent) { togglePlayPause(); return; }`;
  the existing branches follow unchanged.

`PlayButtonRow` computes its own remote match for the button's icon and active style, so the
button and the title agree.

## `ItemChapterHeaderPlaySection.tsx`

- The same `useRemoteRowPlayback` call and `usePlayerTransport()`.
- `isActiveItem = item_chapter.id_text === mpItemChapter?.id_text || remoteChapter.isCurrent`.
  It already decides the play click (toggle) and hides "load with source".
- `playButtonOnClick`: when `remoteChapter.isCurrent`, `togglePlayPause()`; else the existing
  code (local toggle or load).

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
play); leave them. Add by RSS chapter rows (`onPlayChapter`) have no chapter match remotely,
since plan 49 loads no Add by RSS chapters.

If a hook call would land after an early return in a caller, move the `useMemo` above it.

## Must stay true

- With no remote view (roles `idle` and `active`), every row, chapter row, and header renders and
  clicks exactly as before.
- Display only, except the current remote chapter's play toggle, which goes through plan 25's
  transport: no row writes the MediaPlayer context, history, or position, and none calls
  `runLocalClick`.
- Rows never start a remote resource load.

## Tests

Vitest, `remotePlaybackRowMatch.test.ts`:

- Item row matches an `item` ref with its id and not a `clip` ref of that item.
- Clip row matches its `clip` ref only; soundbite row its `soundbite` ref only.
- Chapter row matches an `item` ref when the active chapter id equals its id; not when the
  active id is another chapter or null; not for a `clip` ref even with a matching active id.
- Add by RSS row matches an `add_by_rss` ref whose hash is the legacy (second) entry of its
  list, and not one outside the list.
- No ids → false.

Plan 47's Playwright spec checks that the episode page's play button shows Pause while the
episode plays in another browser context, that clicking it pauses the playing context, and that
the Chapters tab highlights the chapter the playing context reached after Skip to Next.

## Release scratchpad

```markdown
## Web item rows show playback from another device

- Surfaces: web
- Change: The item playing on another signed-in device or another tab is marked as playing in
  web lists, the queue page, and detail pages, with its row progress moving. Clicking its play
  button there pauses or resumes it on the playing device. On the episode's Chapters tab and the
  chapter page, the chapter that device is in is highlighted and follows its position; its play
  button pauses or resumes that device.
- Who notices: members with more than one device or tab open
- Operator steps: none
```
