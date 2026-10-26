**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 22 — Mobile channel livestream rows: only Live can start from the list

## Rows

R17

## Runs after

21

## Files

apps/mobile/src/lib/rows/liveItemRows.ts
apps/mobile/src/lib/rows/liveItemRows.test.ts
apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx

## Goal

A Scheduled or Ended livestream row shows no Play and cannot be started from the list, on every
mobile list. Only a Live row can start from the list. Pressing a livestream row opens its
livestream page.

## What the code does today

Every mobile livestream row renders through `HomeFeedRow`, which shows Play only when
`row.playable !== false` (`isPlayable`). The row data decides:

| List | Builder | Scheduled / Ended playable today | Row press |
| --- | --- | --- | --- |
| Home Livestreams chip | `mapItemsToUpcomingLiveRows` → `toUpcomingLiveRow` | no (Ended dropped) | `EpisodeDetail`, or `AddByRssLivestreamDetail` |
| Browse Livestreams chip | `toUpcomingLiveRow` | no (Ended dropped) | `EpisodeDetail` |
| Add by RSS library | `toAddByRssLiveRows` → `toUpcomingLiveRow` | no | `AddByRssLivestreamDetail` |
| Add by RSS feed page | `toAddByRssFeedLiveRows` | no (Ended sets `playable: false`) | `AddByRssLivestreamDetail` |
| Directory podcast episode list | `toChannelLiveRow` | **yes** | `EpisodeDetail` |
| Directory album track list | `toChannelLiveRow` | **yes** | starts playback (plan 23 changes this) |

`EpisodeDetail` is the mobile livestream page for directory content: the web
`/podcast/livestream/` and `/music/livestream/` deep links both map to it
(`deepLinking.test.ts`). The episode list's live rows already open it.

`toChannelLiveRow` in `apps/mobile/src/lib/rows/liveItemRows.ts` copies `row.playable` through
unchanged, so this plan changes only that builder. The podcast row press needs no change. The
album row press moves to the livestream page in plan 23.

The stored episode window (`channelItemsRepository`) never holds a live item: the server's
channel item list excludes them (`live_item.id IS NULL` in `getManyByChannelBySeason`). So
`PodcastEpisodesSection`'s dedupe cannot leave a Scheduled stream as an ordinary playable
episode row.

## Decisions (settled — transcribe, do not revisit)

The operator settled Scheduled and Ended losing Play in the first review (`00-REQUEST.md`
§ Review of the first planning pass, D8), and the missing-status and More-menu choices in the
second-pass review (E2, E3).

1. `toChannelLiveRow` sets `playable: false` when the status is `Pending` (Scheduled) or `Ended`.
   For `Live`, and for a missing status (null or undefined), it keeps `row.playable`. A live item
   with no status is invalid for new parses (plan 30). A row already saved that way stays
   playable, like an ordinary episode. This plan does not delete those rows.
2. More menu: Share only. Plan 20's `isShareOnlyLivestreamRow` drops Queue Next, Queue Last, Add
   to Playlist, and Mark as Played when `liveStatusId !== undefined`, which is every row this
   builder returns. This plan does not change `PodcastEpisodesSection`'s handlers. Playing still
   writes history. Plan 20 puts the badge at the leading edge of the band and More at the
   trailing edge when Play is hidden.
3. Item and livestream detail headers are out of scope; this plan changes list rows only.

## Step 1 — `toChannelLiveRow`

In `apps/mobile/src/lib/rows/liveItemRows.ts`, inside the returned object of `toChannelLiveRow`
(as plan 21 left it, with the `startTime` parameter), add after `metadata`:

```typescript
playable:
  statusId === LiveItemStatusEnum.Pending || statusId === LiveItemStatusEnum.Ended
    ? false
    : row.playable,
```

Keep the keys in alphabetical order as the function has them (`liveStatusId`, `metadata`,
`playable`, `updatedAt`).

Replace its doc comment with:

```typescript
/**
 * A live row inside a channel: the Live badge only while on the air, and only a stream on the air
 * can start from the list. The row keeps the status, and dates itself by the start time when it
 * has no publish date.
 */
```

## Step 2 — `PodcastEpisodesSection` comments

In `apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx`:

- The `PodcastEpisodesSection` doc comment: replace the last sentence, "A stream on the air
  carries the Live badge; a scheduled or ended one states its status on the row.", with: "Every
  livestream row states Live, Scheduled, or Ended. Only a stream on the air can start from the
  list, and pressing any livestream row opens its page."
- The `liveDisplayRows` doc comment (after plan 21 added its dot sentence): replace "Only a stream
  on the air gets the Live badge, and a scheduled or ended one states its status on its row."
  with "Only a stream on the air can start from the list; a scheduled or ended row has no Play."
  Keep the first sentence (stored ids are subtracted) and plan 21's dot sentence.

No code in this file changes.

## Tests

- `apps/mobile/src/lib/rows/liveItemRows.test.ts`, `describe('toChannelLiveRow')`: add
  `it('lets only a stream on the air start from the list', …)`. Use `baseRow(...)` with the
  third argument `null`, as plan 21's updated calls do:
  - `Live` → `playable` is `undefined` (the base row's value).
  - `Pending` → `playable` is `false`.
  - `Ended` → `playable` is `false`.
  - `null` and `undefined` status → `playable` is `undefined`.
  - A base row with `playable: false` and status `Live` stays `false`.
- No Maestro change. The directory E2E seed has a Scheduled item (`e2eLiveSched01`, channel
  `e2eLiveAvChn01`), but no mobile flow opens that podcast. Plan 20's `browse.yaml` steps already
  assert a Scheduled row has no Play (`home-row-play-e2eLiveSched01`), which proves `HomeFeedRow`
  hides Play for an unplayable livestream row.

## Release scratchpad

```markdown
## Mobile scheduled and ended livestreams cannot start from a podcast's episode list

- Surfaces: mobile
- Change: On a podcast's episode list and an album's track list, a Scheduled or Ended livestream
  row no longer shows Play and cannot be started from the list. Only a Live row has Play.
  Pressing the row opens the livestream page. Home, Browse, and Add by RSS lists already worked
  this way.
- Who notices: listeners opening a podcast or album that has scheduled or ended livestreams
- Operator steps: none
```
