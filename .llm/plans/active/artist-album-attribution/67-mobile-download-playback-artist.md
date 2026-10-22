**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 67 — Phone playback from a download shows the album's artist

A download of a by-channel item (an album track) plays on the phone with the channel
`playbackContentRepository.getLocalChannelForItem` returns. The stored `channel_item` copy has no
embedded channel, so that method falls through to `buildChannelFromDownload`, which builds a
channel from the download row with no `verified_publishers`. `PlaybackProvider.ensureChannel` and
`adoptEngineSource` use that channel without calling `GET /channel`, and the episode and track
screens use it until (or, in Offline Mode, instead of) the network copy. So the full player, mini
player, lock screen (all read `playbackTargetArtists` from plans 60–64), and the track byline
(plan 63) show no artist for a downloaded track whenever its channel comes from the download row.

This plan reads the album's channel-wide publishers from the stored album item through the
existing download to `channel_item` join, and puts them on the channel built from the download.
Plan 68 uses the same read for the car's Downloads list.

## Rows

R63, R64, R65

## Runs after

12

## Files

apps/mobile/src/data/repositories/channelItemsRepository.ts
apps/mobile/src/data/repositories/downloadsRepository.ts
apps/mobile/src/data/repositories/playbackContentRepository.ts
apps/mobile/src/lib/playback/buildChannelFromDownload.ts
apps/mobile/src/lib/playback/buildChannelFromDownload.test.ts
release-notes/scratchpad.md

## Decisions this plan fixes

- **No SQLite column.** `download.item_id_text` joins `channel_item.item_id_text`, and the stored
  `channel_item.payload_json` is the by-channel list item, which carries
  `channel_wide_verified_publishers` once plan 12 ships. The read needs nothing the join does not
  already reach, so the `download` table and its migrations stay as they are.
- **"Unsubscribed" means no `subscribed_channel` row for the album.** The read inner-joins
  `subscribed_channel` on `channel_item.channel_id_text` and keeps rows whose `medium` is
  `'music'`. Unsubscribing on this device deletes the album's `channel_item` rows
  (`channelItemsRepository.removeChannel`), and unsubscribing on another device removes the
  `subscribed_channel` row while `retainChannels` keeps `channel_item` rows for channels with
  downloads; both leave the read empty. The `medium = 'music'` filter also keeps the read from
  parsing podcast payloads.
- **Only the download-row fallback is gated.** An item copy that already embeds its channel
  (`getStoredItemByIdText` returning a queue or list copy with `channel`) keeps that channel's
  publishers, as today. The gate applies where the channel comes from the download row.
- **A stored item from before plan 12 shows no artist** until the album's next item sync rewrites
  it (R37).
- **A single-item refresh keeps the stored channel-wide publishers.** The episode and track
  screens call `channelItemsRepository.updateStoredItem(fresh)` with the `GET /item` copy, which
  has no `channel_wide_verified_publishers` (only by-channel lists set it). Without a guard, opening
  a track page would erase the album's artist from that stored row until the next channel sync.
  `updateStoredItem` carries the stored value over when the incoming item lacks the field.
- **The reader prefers an embedded channel.** A stored payload with `channel` (a `GET /item` copy
  that merged it) uses `channel.verified_publishers`; otherwise `channel_wide_verified_publishers`.
  That is the same order plan 65's `itemArtistNames` uses.

## `src/data/repositories/channelItemsRepository.ts`

`updateStoredItem`:

- Add `payloadJson: schema.channelItem.payloadJson` to the `existing` select.
- Before `const record = toChannelItemRecord(current.channelIdText, item);`, add

  ```typescript
    const storedChannelWide = rowToItem(current)?.channel_wide_verified_publishers;
    const next: DTOItem =
      item.channel_wide_verified_publishers === undefined && storedChannelWide !== undefined
        ? { ...item, channel_wide_verified_publishers: storedChannelWide }
        : item;
  ```

  and pass `next` to `toChannelItemRecord`.
- Add one sentence to the method's doc comment: a single-item copy has no channel-wide publishers,
  so the stored ones are kept.

## `src/data/repositories/downloadsRepository.ts`

Add `import type { DTOVerifiedPublisher } from '@podverse/helpers/dto';` beside the `DTOItem`
import (merge into that import line if the file style allows two names in one `import type`).

Add a module-level reader directly above `refreshNativeCacheProjection` (plan 68 calls it from
there):

```typescript
/**
 * Channel-wide verified publishers stored on the followed music channel item behind each
 * completed download, keyed by item id_text. Reads the download to channel_item join; a download
 * whose channel this device does not follow, or whose stored item has no publishers, has no entry.
 */
const readFollowedMusicPublishers = async (
  itemIdTexts: readonly string[] | null
): Promise<Map<string, DTOVerifiedPublisher[]>> => {
  const byItem = new Map<string, DTOVerifiedPublisher[]>();
  if (itemIdTexts !== null && itemIdTexts.length === 0) {
    return byItem;
  }
  const rows = await getDb()
    .select({
      itemIdText: schema.download.itemIdText,
      payloadJson: schema.channelItem.payloadJson,
    })
    .from(schema.download)
    .innerJoin(schema.channelItem, eq(schema.channelItem.itemIdText, schema.download.itemIdText))
    .innerJoin(
      schema.subscribedChannel,
      eq(schema.subscribedChannel.idText, schema.channelItem.channelIdText)
    )
    .where(
      and(
        eq(schema.download.status, 'complete'),
        eq(schema.subscribedChannel.medium, 'music'),
        itemIdTexts === null ? undefined : inArray(schema.download.itemIdText, [...itemIdTexts])
      )
    );
  for (const row of rows) {
    const item = safeJsonParse<DTOItem>(row.payloadJson);
    const publishers = item?.channel?.verified_publishers ?? item?.channel_wide_verified_publishers;
    if (Array.isArray(publishers) && publishers.length > 0) {
      byItem.set(row.itemIdText, publishers);
    }
  }
  return byItem;
};
```

Match the existing `innerJoin` calls in this file (`listCompleteByChannel` and its neighbors) for
formatting. `safeJsonParse<T>(raw: string): T | null` and `channel_item.payload_json` is
`notNull`, so the code above type-checks as written. `and`, `eq`, and `inArray` are already
imported.

Add a repository method after `getByItemIdText`:

```typescript
  /**
   * The album's channel-wide verified publishers for a completed download whose channel this device
   * follows. Empty when the channel is not followed or the stored item has none.
   */
  followedMusicPublishers: async (itemIdText: string): Promise<DTOVerifiedPublisher[]> => {
    await initializeDatabase();
    const byItem = await readFollowedMusicPublishers([itemIdText]);
    return byItem.get(itemIdText) ?? [];
  },
```

## `src/lib/playback/buildChannelFromDownload.ts`

- Signature: `buildChannelFromDownload(record: DownloadRecord, verifiedPublishers?: DTOVerifiedPublisher[])`.
- Add `verified_publishers: verifiedPublishers,` to the returned object, after `title`.
- Import `DTOVerifiedPublisher` in the existing `import type { DTOChannel } from '@podverse/helpers/dto';`.
- Doc comment: add one sentence: "`verifiedPublishers` are the album's channel-wide publishers
  when the caller found them on the stored item."

## `src/data/repositories/playbackContentRepository.ts`

`getLocalChannelForItem`: replace the last line with

```typescript
    if (download === null) {
      return null;
    }
    const verifiedPublishers = await downloadsRepository.followedMusicPublishers(itemIdText);
    return buildChannelFromDownload(download, verifiedPublishers);
```

Update the repository doc comment's last sentence to say the download row's channel carries the
album's verified publishers when this device follows the album.

## Must stay true

- A podcast download plays exactly as today: its built channel gets `verified_publishers: []`, and
  readers treat empty like absent.
- A download of an album this device does not follow shows no artist from the download row.
- No new column, migration, or `download` table change.
- `updateStoredItem` still writes every other field from the incoming item, and still skips items
  this device does not store.
- One extra SQLite read per `getLocalChannelForItem` call that reaches the download row, none
  otherwise.
- No `as`, no `any`, strict equality only.

## Tests

- `buildChannelFromDownload.test.ts`: the existing toEqual case stays as is (an `undefined`
  property does not affect `toEqual`). Add `it('carries the verified publishers it is given')`:
  pass `[{ id_text: 'e2eMusicChnl01', title: 'E2E Music Artist', medium_id: MediumEnum.PublisherMusic }]`
  (the seeded artist `apps/mobile/e2e/artist.yaml` opens) and assert `verified_publishers` equals
  that array.
- `readFollowedMusicPublishers`, `followedMusicPublishers`, and the `updateStoredItem` carry-over
  are SQLite reads and writes; mobile repositories have no unit harness, so the device check below
  covers them (**mobile-test-economics**).
- Device check (operator): follow the E2E Music Album, pull to refresh it, download a track, turn
  on Offline Mode, open it from Library → Downloads, and play it. The full player, mini player
  ("E2E Music Artist · E2E Music Album"), lock screen, and the track page byline name the artist.
  Turn Offline Mode off, open the track page once, turn it back on, and play again: the artist is
  still there. Unfollow the album and play the same download: no artist.

## Release scratchpad

```markdown
## Downloaded album tracks show the artist on the phone

- Surfaces: mobile
- Change: playing a downloaded album track shows the album's verified artist in the full player,
  mini player, lock screen, and track page, including in Offline Mode. The artist comes from the
  album's stored track list, so it shows only while this device follows the album; downloads of
  albums you no longer follow show no artist. Track lists stored before this update show the
  artist after the album's next refresh.
- Who notices: listeners who download music
- Operator steps: none
```
