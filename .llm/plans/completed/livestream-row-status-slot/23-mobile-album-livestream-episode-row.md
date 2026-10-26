**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 23 — Mobile album livestreams use the podcast livestream row

## Rows

R15, R17, R18, R19, R20

## Runs after

21

## Files

apps/mobile/src/screens/album/albumTrackRows.ts
apps/mobile/src/screens/album/albumTrackRows.test.ts
apps/mobile/src/screens/album/AlbumDetailScreen.tsx

## Goal

A livestream in an album's track list renders with the same row a podcast's episode list uses
for its livestreams: the episode row, with a date under the title, the description, and the play
band. Ordinary tracks keep the compact track row. The player does not change.

The operator settled this in the first review (`00-REQUEST.md` § Review of the first planning
pass, D6): "livestreams are a distinct type of entity that we want to be consistent. they are not
the same as a album or music track." Web already uses one livestream row for both mediums.

## What the code does today

`apps/mobile/src/screens/album/AlbumDetailScreen.tsx`:

- `loadTracks` merges `reqLiveItemGetManyByChannel(albumId)` before the season page
  (`removeDuplicateItems([...liveItems, ...seasonResponse.data])`), so livestreams sit at the top.
  Offline, the stored window (`channelItemsRepository`) holds no live items.
- `toTrackRows` maps every item with `mapItemToHomeFeedRow(item, { compact: true })` (title and
  album only, no date, duration, or description), sets `channelId`, `channelKind`, and
  `subtitle: albumTitle`, and wraps live items in `toChannelLiveRow` (after plan 21, with
  `item.live_item.start_time` as the third argument).
- `AlbumTrackRow` renders every row as `HomeFeedRow mediaType="tracks"`, with
  `onPress={onPlay}`. A row press starts playback, More is inline with Queue Next, Queue Last,
  Go to Track, and Go to Album, and there is no play band.

The parity source is the podcast's livestream row in
`apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx`:

- `toLiveRows`: `toChannelLiveRow(mapItemToHomeFeedRow(item), status, startTime)`. That is a full
  row, not compact.
- `PodcastEpisodeRow`: `HomeFeedRow` with `mediaType="episodes"` and `showChannelContext={false}`.
  A row press opens `EpisodeDetail`, which is the mobile livestream page for both mediums (the
  `/music/livestream/` deep link maps to it, see `deepLinking.test.ts`). Play runs
  `runPlayAction`.

## Decisions (settled — transcribe, do not revisit)

1. **A row is a livestream row when `row.liveStatusId !== undefined`.** Only `toChannelLiveRow`
   sets that key (null when the status is missing), and ordinary track rows never carry it. This
   is the same test plan 21 uses in `PodcastEpisodesSection`.
2. **Livestream rows use the full item mapping**, as the podcast does:
   `toChannelLiveRow(mapItemToHomeFeedRow(item), item.live_item.live_item_status_id,
   item.live_item.start_time)`. They do not get `channelId`, `channelKind`, or the album-title
   `subtitle` override; the podcast's live rows don't set them either, and the context line is
   hidden.
3. **They render as `HomeFeedRow mediaType="episodes"` with `showChannelContext={false}`**, so
   plan 20's band, badge, and date line apply exactly as on a podcast. They have no artwork and no
   context line, the date sits under the title, the description below it, and the band below
   that.
4. **The row press opens the livestream page:**
   `navigation.navigate(CHANNEL_BROWSE_STACK_ROUTES.EpisodeDetail, { episodeId: row.id })`, for
   every status. Play is shown only when the row is playable; plan 22 makes Scheduled and Ended
   rows unplayable in `toChannelLiveRow`.
5. **Share only.** Play calls the album's existing `handlePlayTrack`
   (`runPlayAction(row, 'tracks')`; play resolves the same item either way). The livestream row
   does not pass `onQueuePress`, `onAddToPlaylistPress`, or `onMarkAsPlayedPress`. It passes
   `onSharePress` that calls `shareResolvedUrl(buildPublicShareUrl('episode', row.id))`, the same
   share the podcast episode list and Browse livestream rows use. The screen already imports
   those two helpers for the album header. Plan 20 also drops queue, playlist, and mark as played
   when `liveStatusId` is set. Go to Track and Go to Album stay on ordinary tracks only. Playing
   still writes history. The player does not change.
6. **No new-content dot.** The livestream row passes no `itemLastSeenAtMs`, as `AlbumTrackRow`
   already does.
7. **The download control** gets the same item and test id the track row passes
   (`downloadItem={track}`, `downloadTestID={`album-track-download-${index}`}`). As on the
   podcast, the control renders nothing for an item with nothing to download.
8. **Test id:** `album-livestream-row-${index}`. Ordinary tracks keep `album-track-row-${index}`.
   The Play button keeps the `HomeFeedRow` default `home-row-play-${row.id}`, as on the podcast.

## Step 1 — row builder

Create `apps/mobile/src/screens/album/albumTrackRows.ts`, a sibling of the screen. It holds the
mapping that `toTrackRows` holds today, so it can be unit-tested.

```typescript
import type { DTOItem } from '@podverse/helpers';

import { toChannelLiveRow } from '../../lib/rows/liveItemRows';
import type { HomeFeedRowData } from '../home/homeFeedData';
import { mapItemToHomeFeedRow } from '../home/homeFeedData';

/**
 * Rows for an album's track list.
 *
 * A livestream gets the full item row a podcast's livestream gets, with its date, description,
 * and status, never the compact track row. Ordinary tracks stay compact and carry the album as
 * their channel, so More can open it.
 */
export const toAlbumTrackRows = (
  items: readonly DTOItem[],
  albumId: string,
  albumTitle: string | null
): HomeFeedRowData[] => {
  return items
    .map((item) => {
      if (item.live_item) {
        return toChannelLiveRow(
          mapItemToHomeFeedRow(item),
          item.live_item.live_item_status_id,
          item.live_item.start_time
        );
      }
      const compact = mapItemToHomeFeedRow(item, { compact: true });
      return {
        ...compact,
        channelId: compact.channelId ?? albumId,
        channelKind: compact.channelKind ?? 'albums',
        subtitle: albumTitle,
      };
    })
    .filter((row) => row.id.length > 0);
};

/** True for a row `toAlbumTrackRows` built from a livestream. */
export const isAlbumLivestreamRow = (row: HomeFeedRowData): boolean => {
  return row.liveStatusId !== undefined;
};
```

Match `AlbumDetailScreen`'s import style for `DTOItem` (`@podverse/helpers`). Keep the
truthiness check on `item.live_item`, as `toTrackRows` has it (`live_item` is
`DTOLiveItem | null | undefined`).

## Step 2 — `AlbumDetailScreen`

In `apps/mobile/src/screens/album/AlbumDetailScreen.tsx`:

- Delete `toTrackRows` and the `toChannelLiveRow` import. Import
  `{ isAlbumLivestreamRow, toAlbumTrackRows }` from `'./albumTrackRows'`, with the other relative
  imports. Replace both `toTrackRows(...)` calls in `loadTracks` with `toAlbumTrackRows(...)` (same
  arguments).
- Remove `mapItemToHomeFeedRow` from the `'../home/homeFeedData'` import if nothing else in the
  file uses it.
- Add a `handleOpenLivestream` callback next to `handleGoToTrack`:

  ```typescript
  const handleOpenLivestream = useCallback(
    (nextRow: HomeFeedRowData) => {
      navigation.navigate(CHANNEL_BROWSE_STACK_ROUTES.EpisodeDetail, { episodeId: nextRow.id });
    },
    [navigation]
  );
  ```

- Add `handleShareLivestream` next to `handleOpenLivestream`:

  ```typescript
  const handleShareLivestream = useCallback((nextRow: HomeFeedRowData) => {
    shareResolvedUrl(buildPublicShareUrl('episode', nextRow.id));
  }, []);
  ```

- `AlbumTrackRow`: add required props `onOpenLivestream` and `onShareLivestream` (props stay
  alphabetical). At the top of the function body, when `isAlbumLivestreamRow(row)`, return:

  ```tsx
  <HomeFeedRow
    downloadItem={track}
    downloadTestID={`album-track-download-${index}`}
    mediaType="episodes"
    onPlayPress={onPlay}
    onPress={onOpenLivestream}
    onSharePress={onShareLivestream}
    row={row}
    showChannelContext={false}
    testID={`album-livestream-row-${index}`}
  />
  ```

  Otherwise render the existing track `HomeFeedRow` unchanged.
- `renderTrackItem`: pass `onOpenLivestream={handleOpenLivestream}` and
  `onShareLivestream={handleShareLivestream}`, and add both to the
  `useCallback` deps.
- Give `AlbumTrackRow` a one-sentence doc comment: `An album track, or a livestream on the same
  row a podcast's livestream uses.`

Nothing else in the screen changes: loading, merge order, sort and range chips, and offline
behavior stay as they are.

## Tests

- New `apps/mobile/src/screens/album/albumTrackRows.test.ts` (vitest). Build `DTOItem` fixtures
  the way `apps/mobile/src/screens/home/homeFeedData.test.ts` does (`itemFixture`), adding an
  optional `live_item` (`DTOLiveItem`: `id`, `item_id`, `live_item_status: { id }`,
  `live_item_status_id`, `start_time`). Import types as that test does
  (`import type { DTOItem } from '@podverse/helpers/dto';`, `MediumEnum` from
  `@podverse/helpers/medium`) and `LiveItemStatusEnum` from `@podverse/helpers`, as
  `liveItemRows.test.ts` does. Cases, as `it` sentences:
  - "keeps an ordinary track compact and carries the album": no `updatedAt`, no `description`,
    `channelId` is the album id, `channelKind` is `'albums'`, `subtitle` is the album title, and
    `isAlbumLivestreamRow` is false.
  - "gives a livestream the full item row a podcast livestream gets": the item has a `pub_date`
    and a description. The row has `liveStatusId` set, `updatedAt` equal to the `pub_date`, the
    description preview, no `channelKind`, and `isAlbumLivestreamRow` is true.
  - "dates a livestream with no publish date by its start time": `updatedAt` is
    `Date.parse(start_time)`.
  - "drops an item with an empty id": an item with `id_text: ''` yields no row.
- Playability (`playable: false` for Scheduled and Ended) is covered by plan 22's
  `toChannelLiveRow` test. Do not assert it here, so this test does not depend on plan 22's
  order.
- No Maestro change. The E2E seed (`tools/web/seed-e2e.mjs`) has no music-medium live item, and
  the seed is shared with web E2E. `album.yaml` keeps covering the ordinary track rows.

## Release scratchpad

```markdown
## Mobile album livestreams use the livestream row

- Surfaces: mobile
- Change: A livestream in an album's track list renders like a podcast's livestream: the date
  (the start date when there is no publish date) and description under the title, and a play band
  with the Live, Scheduled, or Ended badge. Pressing the row opens the livestream page instead of
  starting playback. Only a Live stream has Play. Ordinary tracks keep the compact track row. The
  livestream row's More menu is Share only: no queue, playlist, or mark as played.
- Who notices: listeners opening an album that has livestreams
- Operator steps: none
```
