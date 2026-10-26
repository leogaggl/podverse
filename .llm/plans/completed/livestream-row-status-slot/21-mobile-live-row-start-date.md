**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 21 — Mobile livestream rows inside a channel: date from the start time

## Rows

R3, R18, R19

## Runs after

none

## Files

apps/mobile/src/lib/rows/liveItemRows.ts
apps/mobile/src/lib/rows/liveItemRows.test.ts
apps/mobile/src/lib/addByRss/liveRows.ts
apps/mobile/src/lib/addByRss/liveRows.test.ts
apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx
apps/mobile/src/screens/album/AlbumDetailScreen.tsx

## Goal

A livestream row's date line under the title shows a date whenever one is known. Home, Browse,
and the Add by RSS library already do this: `toUpcomingLiveRow` falls back to the stream's start
time when the item has no publish date. Two channel lists do not:

- A directory podcast's episode list (`PodcastEpisodesSection`) builds live rows with
  `toChannelLiveRow`, which keeps `updatedAt = item.pub_date` only. A `podcast:liveItem` often has
  no `pubDate`, so the row shows no date.
- An Add by RSS feed's episode list (`toAddByRssFeedLiveRows`) builds Ended rows without
  `toUpcomingLiveRow`, and the base row has no `updatedAt`, so an Ended row never shows a date.

An album's livestreams also build their rows with `toChannelLiveRow`, so they get the same
fallback. Plan 23 renders them as full episode rows, which show that date under the title.

This plan gives all three the same fallback. It does not change the precedence (publish date
first, then start time) or any other row field. Plan 20 moves the badges, plan 22 removes Play
from Scheduled and Ended rows, and this plan only fills the date.

## Decisions (settled — transcribe, do not revisit)

The operator settled 2 and 3 in the first review (`00-REQUEST.md` § Review of the first planning
pass, D9 and D10).

1. Fallback order matches `toUpcomingLiveRow`: keep a non-empty `updatedAt`; otherwise use the
   start time in epoch ms when it parses to a positive number; otherwise leave `updatedAt` as it is.
2. Album livestreams take the start-time date too: `AlbumDetailScreen` passes
   `item.live_item.start_time`. Plan 23 then replaces the album's row builder with one that keeps
   this call.
3. No new-content dot on podcast or album livestream rows. A scheduled stream's start is in the
   future, so with a start-time date its dot would stay on every visit until the stream started.
   This plan turns the dot off on a podcast's live rows. Album rows never receive
   `itemLastSeenAtMs` (`AlbumTrackRow` passes none), and plan 23 keeps it off album livestream
   rows. Add by RSS feed live rows already show no dot (`AddByRssLiveFeedRow` passes no
   `itemLastSeenAtMs`).

## Step 1 — `toChannelLiveRow`

`apps/mobile/src/lib/rows/liveItemRows.ts`:

- Add a required third parameter `startTime: Date | string | number | null | undefined`.
- Body:

  ```typescript
  export const toChannelLiveRow = (
    row: HomeFeedRowData,
    statusId: LiveItemStatusEnum | null | undefined,
    startTime: Date | string | number | null | undefined
  ): HomeFeedRowData & { liveStatusId: LiveItemStatusEnum | null } => {
    const startTimeMs = startTimeMsFrom(startTime);
    return {
      ...row,
      liveStatusId: statusId ?? null,
      metadata: statusId === LiveItemStatusEnum.Live ? LIVE_ROW_METADATA : row.metadata,
      updatedAt:
        !rowHasUpdatedAt(row.updatedAt) && startTimeMs !== null ? startTimeMs : row.updatedAt,
    };
  };
  ```

- Doc comment: `A live row inside a channel: the Live badge only while on the air; the row keeps
  the status, and dates itself by the start time when it has no publish date.`

## Step 2 — callers of `toChannelLiveRow`

- `apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx`, `toLiveRows` (~line 93):
  `toChannelLiveRow(mapItemToHomeFeedRow(item), item.live_item?.live_item_status_id, item.live_item?.start_time)`.
- `apps/mobile/src/screens/album/AlbumDetailScreen.tsx`, `toTrackRows` (~line 196):
  `toChannelLiveRow(base, item.live_item.live_item_status_id, item.live_item.start_time)`. No
  comment.

## Step 3 — no new-content dot on directory live rows

`PodcastEpisodesSection.tsx`, `renderRow` (~line 327): pass
`itemLastSeenAtMs={row.liveStatusId === undefined ? visitLastSeenAtMs : null}`. Episode rows from
`mapItemsToHomeFeedRows` never set `liveStatusId`; every row from `toLiveRows` does (null when the
status is missing). Extend the `liveDisplayRows` doc comment with one sentence: `Live rows carry no
new-content dot: a scheduled start lies in the future.`

## Step 4 — Add by RSS Ended rows

`apps/mobile/src/lib/addByRss/liveRows.ts`, `toAddByRssFeedLiveRows`, the `Ended` branch
(~line 176): compute `const startTimeMs = toRowStartTimeMs(liveItem.start_time);` and push

```typescript
row: {
  ...base,
  liveStatusId: LiveItemStatusEnum.Ended,
  playable: false,
  startTimeMs,
  updatedAt: startTimeMs,
},
```

`base` never carries `updatedAt`, so this matches the fallback order. Leave the Live and Scheduled
branches alone; `toUpcomingLiveRow` already dates them.

## Tests

- `apps/mobile/src/lib/rows/liveItemRows.test.ts`, `describe('toChannelLiveRow')`: pass `null` as
  the new third argument in the existing calls, and add an `it` "dates a row by its start time only
  when it has no publish date" covering: no `updatedAt` plus an ISO start → `updatedAt` is
  `Date.parse(start)`; an existing `updatedAt` plus a start → `updatedAt` unchanged; no
  `updatedAt` and a `0` or missing start → `updatedAt` stays undefined.
- `apps/mobile/src/lib/addByRss/liveRows.test.ts`, the `toAddByRssFeedLiveRows` case: add
  `expect(ended?.updatedAt).toBe(Date.parse(iso(-3 * hourMs)))` (the `just-ended` start).
- No Maestro change: the Add by RSS fixture has no Ended item and the directory E2E seed opens no
  livestream channel. Plan 20's `add-by-rss-livestream.yaml` steps already assert the Scheduled
  row's date.

## Release scratchpad

```markdown
## Mobile livestream rows inside a podcast show a date

- Surfaces: mobile
- Change: On a podcast's episode list and an Add by RSS feed's episode list, a livestream row with
  no publish date shows its start date under the title, as the Home and Browse livestream lists
  already do. Ended Add by RSS streams now show their start date too. Live rows in a podcast's
  episode list no longer show the new-content dot, since a scheduled start lies in the future.
- Who notices: listeners opening a podcast that has livestreams
- Operator steps: none
```
