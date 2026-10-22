**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 11 — Artist endpoint: verified albums, Not Yet Added, tracks from verified albums

`GET /publisher-feed/channel/:idOrIdText` backs the web artist page (`/artist/[channel_id]`) and
mobile `ArtistDetailScreen`. Today it trusts the artist feed's own list: any album whose guid or
URL matches a Podverse channel is shown, and the Tracks tab lists the artist feed's item-level
references. After this plan:

- **Albums (`channelsAdded`)**: only albums verified to this publisher (plan 02's links), in the
  artist feed's order.
- **Not Yet Added (`channelsUnadded`)**: albums the artist feed lists that Podverse has not parsed,
  enriched from Podcast Index as today. References Podcast Index does not know stay hidden.
- **Albums that are parsed but do not point back** appear in neither list.
- **Tracks (`itemsAdded`)**: tracks on the verified albums, plus items credited to this publisher
  by an item-level link (none until feeds can express them). The artist feed's own item-level
  references are not shown. `itemsUnadded` is always `[]`.

Areas D and E render the sections; this plan only changes the data and keeps the E2E seed working.

## Rows

R2, R8, R18, R20, R23, R25, R26

## Runs after

10

## Files

packages/orm/src/services/publisherFeed.ts
packages/orm/src/services/publisherFeed.helpers.ts
packages/orm/src/services/publisherFeed.helpers.test.ts
packages/orm/src/services/channel/channelVerifiedPublisher.ts
apps/api/src/controllers/publisherFeed.ts
apps/api/src/lib/remoteItems.test.ts
packages/helpers/src/dtos/remoteItem.ts
apps/api/openapi.yml
apps/api/src/test/category-channel-item-read.test.ts
apps/api/src/test/publisher-feed-verified.integration.test.ts
tools/web/seed-e2e.mjs
release-notes/scratchpad.md

## Decisions this plan fixes

- **Field names stay.** Installed mobile builds read `channelsAdded`, `channelsUnadded`,
  `itemsAdded`, and `itemsUnadded`. Keeping them means an older app shows verified albums, Not Yet
  Added rows, and verified tracks with no client change. `itemsUnadded` is always `[]`.
  `PublisherRemoteItemsResponse` in `packages/helpers/src/dtos/remoteItem.ts` keeps its shape and
  gains doc comments stating each field's meaning (below).
- **"Parsed" means the matched Podverse channel has `channel_about`.** That is the same test the
  channel and item reads use (`isParsedReadyChannel`). A reference that matches a channel row still
  waiting for its first parse stays in Not Yet Added.
- **A reference matches a Podverse channel** by `podcast_guid` (case-insensitive), else by exact
  trimmed `feed.url` (today's `promoteUnmatchedAlbumsByFeedUrl` lookup). A parsed match that is
  verified goes to Albums; a parsed match that is not verified is dropped (R25).
- **Album order** is the artist feed's order: `channel_remote_item` rows sorted by `id` ascending,
  first matching reference wins. A verified album no reference reaches (possible only through a
  URL alias the exact lookup misses) is appended after the others, by channel id.
- **Tracks are inline, newest first, capped.** One query loads items on the verified albums plus
  credited items: not live items, flag status active, channel parsed; ordered `pub_date DESC`,
  then `id DESC`; at most `PUBLISHER_FEED_TRACKS_MAX = 500`. The main alternative, a paginated
  tracks endpoint, would need new client paging on both apps; a publisher feed rarely lists enough
  albums to reach the cap.
- **Albums and tracks carry `verified_publishers`** through plan 10's `attachVerifiedPublishers`,
  so a track played from the artist page shows every co-credited artist.
- **Not Yet Added stays Podcast Index backed.** `buildRemoteItemsFinalResult` with
  `enrichUnaddedChannelsByFeedUrl: true` is unchanged: only feeds Podcast Index returns (by guid,
  then by URL) are listed, so unknown references stay hidden (R26). Each row keeps the Podcast
  Index `id` the clients use to open the preview (web `/podcast-index/feed/[id]`, mobile
  `SearchResultDetail`), where a member can add the feed (R23). The podroll endpoint, which shares
  `buildRemoteItemsFinalResult`, is untouched.

## ORM

### `packages/orm/src/services/channel/channelVerifiedPublisher.ts`

Add to `ChannelVerifiedPublisherService`:

```typescript
  /**
   * What a publisher is verified on: content channels credited as a whole, and single items
   * credited by an item-level link. Content channels are in channel id order.
   */
  async getCatalogForPublisher(
    publisherChannelId: number
  ): Promise<{ albumChannelIds: number[]; creditedItemIds: number[] }>
```

One query on `AppDataSourceRead`:
`SELECT channel_id, item_id FROM channel_verified_publisher WHERE publisher_channel_id = $1 ORDER BY channel_id, item_id NULLS FIRST`.
Rows with `item_id` null go to `albumChannelIds` (distinct); the rest to `creditedItemIds`
(distinct). Typed row reader, no `as`.

### `packages/orm/src/services/publisherFeed.helpers.ts`

Keep `isPublisherAlbumRemoteRef` and `feedUrlsForPublisherAlbumUrlLookup`. Add a pure partition:

```typescript
export type PublisherAlbumMatchMaps = {
  /** Lowercased trimmed podcast_guid → parsed Podverse channel id. */
  parsedChannelIdByGuid: ReadonlyMap<string, number>;
  /** Trimmed feed URL → parsed Podverse channel id. */
  parsedChannelIdByFeedUrl: ReadonlyMap<string, number>;
};

/**
 * Splits an artist feed's album references (in feed order) into verified albums and albums not
 * yet in Podverse. A reference matching a parsed channel that is not verified is dropped: the
 * album exists but does not name this publisher back.
 */
export function partitionPublisherAlbumRefs<T extends PublisherAlbumRemoteRef>(args: {
  refs: readonly T[];
  matches: PublisherAlbumMatchMaps;
  verifiedAlbumChannelIds: ReadonlySet<number>;
}): { verifiedChannelIds: number[]; notYetAddedRefs: T[] }
```

Rules, in order, for each ref with `isPublisherAlbumRemoteRef(ref)` true:

1. Matched id = guid map lookup (lowercased trimmed `feed_guid`), else URL map lookup (trimmed
   `feed_url`).
2. Matched and in `verifiedAlbumChannelIds`: push the id to `verifiedChannelIds` once.
3. Matched and not verified: drop.
4. Not matched: push to `notYetAddedRefs`, once per lowercased guid, or per trimmed URL when the
   guid is empty.

Then append verified ids not yet pushed, ascending. Refs failing `isPublisherAlbumRemoteRef`
(item-level references) are ignored.

### `packages/orm/src/services/publisherFeed.ts`

Rewrite `getPublisherFeedRemoteItemsForChannel`. Keep the `channelGetOneRelations` load of the
artist channel and its comment, and the not-found return. New return type:

```typescript
export type PublisherFeedRemoteItemsResult = {
  channel: Channel | null;
  /** Verified albums, artist feed order. */
  verifiedAlbums: Channel[];
  /** Album references to parsed-nothing feeds, for Podcast Index enrichment. */
  notYetAddedAlbumRefs: ChannelRemoteItem[];
  /** Tracks on verified albums plus item-credited tracks, newest first. */
  tracks: Item[];
};

export const PUBLISHER_FEED_TRACKS_MAX = 500;
```

Steps:

1. `albumRefs` = `channel.channel_remote_items` sorted by `id`, filtered by
   `isPublisherAlbumRemoteRef`.
2. `catalog = await new ChannelVerifiedPublisherService().getCatalogForPublisher(channel.id)`.
3. Guid matches: `channelService.getAllByPodcastGuids({ relations: { channel_about: true } }, guids)`
   for the refs' non-empty guids; keep channels with `channel_about` and a `podcast_guid`, keyed by
   lowercased guid.
4. URL matches: for refs with no guid match, reuse the `feedService.getByUrl` + `channelService.get`
   loop from `promoteUnmatchedAlbumsByFeedUrl` (keep only channels with `channel_about`), keyed by
   trimmed URL. Replace `promoteUnmatchedAlbumsByFeedUrl` with this lookup; it no longer adds to an
   albums list.
5. `partitionPublisherAlbumRefs` with `new Set(catalog.albumChannelIds)`.
6. `verifiedAlbums`: load `verifiedChannelIds` with
   `AppDataSourceRead.getRepository(Channel).find({ where: { id: In(ids), channel_about: { id: Not(IsNull()) } }, relations: { channel_about: true, channel_images: true } })`,
   then reorder to `verifiedChannelIds` order. Empty ids: `[]` without a query.
7. `tracks`: when both `catalog.albumChannelIds` (filtered to the loaded `verifiedAlbums` ids) and
   `catalog.creditedItemIds` are empty, `[]`. Otherwise
   `AppDataSourceRead.getRepository(Item).find` with
   - `where`: an array of up to two branches, each with `live_item: { id: IsNull() }`,
     `item_flag_status: { id: ItemFlagStatusStatusEnum.Active }`, and
     `channel: { channel_about: { id: Not(IsNull()) } }`; one branch adds
     `channel: { id: In(albumIds), channel_about: … }`, the other `id: In(creditedItemIds)`.
   - `relations: itemGetManyRelationsWithChannel`, `order: { pub_date: 'DESC', id: 'DESC' }`,
     `take: PUBLISHER_FEED_TRACKS_MAX`.
   Match how `ItemService.getManyByChannels` builds its `where` (same file family) for the exact
   option shapes; import `itemGetManyRelationsWithChannel` from `./item/item.js`.
8. Return `{ channel, verifiedAlbums, notYetAddedAlbumRefs, tracks }`.

Delete `getPublisherFeedChannels` and `getPublisherFeedItems` if nothing else imports them (grep
`packages/` and `apps/` first; keep any that are still used).

## API

### `apps/api/src/controllers/publisherFeed.ts`

```typescript
const result = await …getPublisherFeedRemoteItemsForChannel(idOrIdText);
await attachVerifiedPublishers({ channels: result.verifiedAlbums, items: result.tracks });
const finalRemoteItemsResult = await buildRemoteItemsFinalResult(
  result.verifiedAlbums …,
  result.notYetAddedAlbumRefs,
  result.tracks …,
  [],
  { enrichUnaddedChannelsByFeedUrl: true }
);
res.json({ channel: result.channel, ...finalRemoteItemsResult });
```

Keep the existing `DTOChannel[]` / `DTOItem[]` conversion the file uses today (it is the only place
the ORM entities meet the shared DTO type here); do not add new assertions.

### `packages/helpers/src/dtos/remoteItem.ts`

Add doc comments to `PublisherRemoteItemsResponse` fields only:

- `channelsAdded`: "Albums verified to this publisher (both feeds reference each other), in the
  publisher feed's order."
- `channelsUnadded`: "Albums the publisher feed lists that Podverse has not parsed, as Podcast Index
  feeds. References Podcast Index does not know are left out."
- `itemsAdded`: "Tracks on the verified albums, plus tracks credited to this publisher alone,
  newest first."
- `itemsUnadded`: "Always empty. Item references in a publisher feed are not shown; nothing can
  verify them."

### `apps/api/openapi.yml`

Find `PublisherFeedRemoteItemsResponse:` under `components.schemas`. Add a `description` with the
four meanings above (one sentence each). Find `/publisher-feed/channel/{id_or_id_text}:` and replace
its `description` with: "Public endpoint. Returns the publisher channel, its verified albums, albums
its feed lists that Podverse has not parsed (Podcast Index data), and tracks on the verified
albums."

## E2E seed (`tools/web/seed-e2e.mjs`)

The mobile `artist.yaml` flow opens `artist/e2eMusicChnl01` and taps album row 0 and track row 0.
That artist has no `podcast_guid` and its album has no publisher claim, so without this change the
flow finds no rows. Mobile E2E reuses this seed (`make mobile_e2e_seed`).

- Add beside `E2E_MUSIC_ALBUM_PODCAST_GUID`:
  `const E2E_MUSIC_ARTIST_PODCAST_GUID = '11111111-2222-4333-8444-555555555502';`
- Artist insert (`INSERT INTO channel (id_text, feed_id, medium_id, title)` for
  `E2E_MUSIC_CHANNEL_ID_TEXT`): medium becomes `publisher-music`, and add `podcast_guid` =
  `E2E_MUSIC_ARTIST_PODCAST_GUID`. Update the constant's comment above `E2E_MUSIC_CHANNEL_ID_TEXT`
  if it calls the artist a music channel. The web artist route redirects non-artist mediums, and
  the player artist link resolves its route from this medium.
- After the artist's `channel_remote_item` insert, add:
  1. `INSERT INTO channel_publisher (channel_id) VALUES ($1) RETURNING id` for the album
     (`musicChannelId`).
  2. `INSERT INTO channel_publisher_remote_item (channel_publisher_id, feed_guid, feed_url, item_guid, title, medium_id)`
     with the artist guid, `E2E_MUSIC_ARTIST_FEED_URL`, `NULL`, `'E2E Music Artist'`, and the
     `publisher-music` medium id.
  3. `INSERT INTO channel_verified_publisher (channel_id, publisher_channel_id, item_id, claim_position) VALUES ($1, $2, NULL, 0)`
     (album, artist). The seed does not run the recompute, so it writes the row it would produce.
- Leave the two track references on the artist feed: they now show only as the album's tracks.
- Update the `console.log` after the artist block to mention the verified album link.
- Re-running the seed deletes the feeds first; the new rows cascade from `channel`.

## Must stay true

- `GET /podroll/channel/:idOrIdText` output is unchanged.
- An album appears in at most one of `channelsAdded` / `channelsUnadded`.
- Add by RSS content never reaches this endpoint (directory only).
- No `as` added, no `any`, strict equality only.

## Tests

- `packages/orm/src/services/publisherFeed.helpers.test.ts`: add a `describe('partitionPublisherAlbumRefs')`
  with one `it` each:
  - Verified matches come back in reference order.
  - A guid match that is parsed but not verified is in neither list.
  - A URL match to a verified channel counts as verified; a URL match that is not verified is
    dropped.
  - A reference with no match goes to `notYetAddedRefs`, once even when listed twice.
  - Item-level references are ignored.
  - A verified id no reference reaches is appended at the end.
- `apps/api/src/lib/remoteItems.test.ts`: add `it('leaves out a reference Podcast Index knows by neither guid nor URL')`
  to the `enrichMissedChannelsUnaddedByFeedUrl` block (lookup returns null → no extras).
- `apps/api/src/test/category-channel-item-read.test.ts`: change `defaultPublisherFeedGet` to the
  new result shape (`verifiedAlbums: []`, `notYetAddedAlbumRefs: []`, `tracks: []`), and extend the
  publisher-feed case to assert `itemsUnadded` is `[]`.
- `apps/api/src/test/publisher-feed-verified.integration.test.ts` (new; real database, harness of
  `channel-merge.integration.test.ts`; unique guids and id_texts per run so Valkey `pi:feed:<guid>`
  cache keys never collide). `vi.mock('../factories/podcastIndexService.js')`: `podcastsBatchByFeedGuid`
  returns one feed for the "known" unparsed guid only, `podcastGetByFeedUrl` returns null,
  `episodeGetByGuid` throws (must not be called). Seed an artist (publisher-music, guid, parsed),
  album A (parsed, claim naming the artist, listed by the artist), album B (parsed, listed, no
  claim), two items on A, and artist remote items for A, B, a known unparsed guid C, an unknown
  unparsed guid D, and one track reference on A. Run
  `new ChannelVerifiedPublisherService().recomputeForChannel(artistId)`. Then
  `GET /publisher-feed/channel/:artist`:
  - `channelsAdded` is exactly [A], and A has `verified_publishers` naming the artist.
  - `channelsUnadded` has one feed, C's; D is absent.
  - B appears in neither list.
  - `itemsAdded` is A's two items, newest first, each `channel.verified_publishers` naming the
    artist; `itemsUnadded` is `[]`.
  - After deleting A's claim and recomputing A, `channelsAdded` is empty and A is in neither list.

## Release scratchpad

```markdown
## Artist pages list only verified albums

- Surfaces: api (web artist page and mobile artist screen read it)
- Change: `GET /publisher-feed/channel/:idOrIdText` now returns as `channelsAdded` only albums
  whose feed names the artist back (verified link), in the artist feed's order. `channelsUnadded`
  lists albums the artist feed names that Podverse has not parsed, from Podcast Index; unknown
  references stay hidden. Albums Podverse has parsed that do not name the artist back are no
  longer shown. `itemsAdded` is now the tracks on the verified albums (newest first, at most 500)
  instead of the artist feed's own track references; `itemsUnadded` is always empty. Field names
  are unchanged, so installed apps pick this up without an update.
- Who notices: listeners on artist pages; albums that never named the artist disappear, and the
  Tracks tab fills with every track on the artist's verified albums.
- Operator steps: run the verified-link backfill (`ormVerifiedPublisherLinksBackfill`) after the
  migration and before this API ships, or artist pages show no albums until each feed is reparsed.
```
