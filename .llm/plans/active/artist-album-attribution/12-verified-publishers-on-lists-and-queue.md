**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 12 — Verified publishers on item lists, queue resources, and playlist resources

Plan 10 attaches `verified_publishers` on single channel and item reads. Players also take their
item and channel from item lists (Home, Browse, album track lists, auto-queue), the queue resources
(web restore and the mobile queue cache), and playlist resources. This plan calls plan 10's
`attachVerifiedPublishers` in each of those handlers, so the artist line has its data wherever
playback starts, and mobile stores the field with the rest of the payload (older stored rows show
no artist line until they refresh).

Album track lists (`/item/channel/...`) return items with no embedded `channel`, and mobile stores
those items verbatim as its `channel_item` rows, which feed car album track lists and downloads.
So each item in a by-channel list also carries its channel's channel-wide publishers in a new
field, `channel_wide_verified_publishers`, separate from the item-only `verified_publishers`.

No new endpoint. Responses gain `verified_publishers` on items and embedded channels, and
by-channel item lists also gain `channel_wide_verified_publishers` on each item. `verified_publishers`
reaches OpenAPI through the `Item` and `Channel` schemas (plan 10), which `QueueResource` and
`PlaylistResource` reference; this plan adds the new item field to `Item`.

## Rows

R7, R8, R21, R61

## Runs after

10

## Files

packages/helpers/src/dtos/item/item.ts
packages/orm/src/entities/item/item.ts
apps/api/openapi.yml
apps/api/src/lib/verifiedPublishers.ts
apps/api/src/controllers/item.ts
apps/api/src/controllers/queue/queueResource.ts
apps/api/src/controllers/playlist/playlistResource.ts
apps/api/src/test/verified-publisher-reads.integration.test.ts
apps/api/src/test/queue.test.ts
apps/api/src/test/playlist.test.ts
release-notes/scratchpad.md

## Decisions this plan fixes

- **Which endpoints attach.** Every item list in `ItemController` (global, category, subscribed,
  by channel, auto-queue), the queue resource reads, and the playlist resource reads. Clip,
  soundbite, and live item list endpoints do not attach in this set: playback of a music track
  starts from the lists above, and those endpoints rarely carry music. A clip of a track played
  from a clip list shows no artist line until a later change attaches there too.
- **By-channel item lists carry the channel's credits on each item, in their own field.** The six
  `getManyByChannel*` handlers set `channel_wide_verified_publishers` on every item to the
  channel-wide publishers of the channel the list is for, and `verified_publishers` to the
  item-only list as everywhere else. A separate field keeps `verified_publishers` meaning "this
  item alone" on every response, so no reader counts a channel credit twice. Other item lists do
  not set the new field: their items embed `channel`, which already carries the channel-wide list.
- **The shared resolver does not read the new field.** `resolveVerifiedPublishers` (plan 10) keeps
  its `{ channel, item }` inputs. A reader holding a by-channel item and no channel object passes
  `{ verified_publishers: item.channel_wide_verified_publishers }` as the channel (mobile does this
  in `itemArtistNames`, plan 65, and in the download read, plan 67). Web album pages already hold
  the album channel and need nothing new.
- **Old stored rows heal on refresh.** Mobile `channel_item` rows written before this ship have no
  `channel_wide_verified_publishers` and show no artist until the channel's next item sync rewrites
  them (**dto-changes-are-device-data-migrations**; R37).

## `packages/helpers/src/dtos/item/item.ts`

Add to `DTOItem`, directly after the `verified_publishers` field plan 10 added:

```typescript
  /**
   * Publishers verified on this item's whole channel, primary first. Set only by by-channel item
   * lists, whose items carry no embedded `channel`; absent elsewhere and on items stored before
   * the field existed.
   */
  channel_wide_verified_publishers?: DTOVerifiedPublisher[];
```

Not on `DTOItemQueueItem`: queue resources embed the channel. The `DTOVerifiedPublisher` import is
already there from plan 10.

## `packages/orm/src/entities/item/item.ts`

Directly after the undecorated `verified_publishers` property plan 10 added:

```typescript
  /** Filled by by-channel list reads; not a column. The channel's channel-wide publishers. */
  channel_wide_verified_publishers?: DTOVerifiedPublisher[];
```

No decorator, so no column or migration.

## `apps/api/openapi.yml`

Find `^    Item:` under `components.schemas` (search; do not page through the file). In
`Item.properties`, directly after the `verified_publishers` property plan 10 added:

```yaml
        channel_wide_verified_publishers:
          type: array
          description: Publishers verified on this item's whole channel, primary first. Present only on by-channel item lists, whose items have no embedded channel.
          items:
            $ref: "#/components/schemas/VerifiedPublisher"
```

## `apps/api/src/lib/verifiedPublishers.ts`

Add a helper for by-channel lists below `attachVerifiedPublishers`:

```typescript
/**
 * For items listed under one channel, which carry no embedded channel: sets each item's
 * item-only `verified_publishers` and its `channel_wide_verified_publishers` from `channel`.
 * One query per call.
 */
export async function attachChannelListVerifiedPublishers(args: {
  channel: Channel;
  items: readonly (Item | null | undefined)[];
}): Promise<void>
```

Body: `await attachVerifiedPublishers({ channels: [args.channel], items: args.items });` then, for
every non-null item, `item.channel_wide_verified_publishers = args.channel.verified_publishers ?? [];`.
Setting `verified_publishers` on the handler's `channel` object is harmless: the handlers do not
send that object.

Add a collector for queue and playlist resources beside `attachVerifiedPublishers`:

```typescript
type MediaResourceLike = {
  item?: Item | null;
  clip?: { item?: Item | null } | null;
  item_soundbite?: { item?: Item | null } | null;
};

/** The items a queue or playlist resource plays: its item, its clip's item, or its soundbite's item. */
export function itemsOfMediaResources(
  resources: Iterable<MediaResourceLike | null | undefined>
): Item[]
```

It returns the non-null `item`, `clip.item`, and `item_soundbite.item` of each resource. Add-by-RSS
resources have none of these and contribute nothing. Check the relation property names against
`QueueResource` and `PlaylistResource` in `packages/orm/src/entities/` (`item`, `clip`,
`item_soundbite`; `Clip.item`, `ItemSoundbite.item`) and type the parameter so both entities are
accepted without `as`.

## `apps/api/src/controllers/item.ts`

Right before the `ApiListResponse` / `res.json` in each handler below, add the call the table
names (with whatever the local array is named). Items loaded with
`itemGetManyRelationsWithChannel` / `subItemGetManyRelationsWithChannel` carry `channel`, which
`attachVerifiedPublishers` covers automatically. Each `getManyByChannel*` handler already holds
the list's channel in the local `channel` (from `episodeListChannel`).

| Handler | Call |
| --- | --- |
| `getManyGlobalRecent` | `attachVerifiedPublishers({ items })` on the filtered array (attach before the `.filter(Boolean)` result is placed in `data`) |
| `getManyGlobalTop` | `attachVerifiedPublishers({ items })` on the loaded items |
| `getManyCategoryRecent` | `attachVerifiedPublishers({ items })` on the loaded items |
| `getManyCategoryTop` | `attachVerifiedPublishers({ items })` on the loaded items |
| `getManySubscribedRecent` | `attachVerifiedPublishers({ items })` (skip on the empty early return) |
| `getManySubscribedTop` | `attachVerifiedPublishers({ items })` (skip on the empty early return) |
| `getManyByChannelRecent` | `attachChannelListVerifiedPublishers({ channel, items })` |
| `getManyByChannelOldest` | `attachChannelListVerifiedPublishers({ channel, items })` |
| `getManyByChannelTop` | `attachChannelListVerifiedPublishers({ channel, items })` on the `loadFilledTopItems` result |
| `getManyByChannelBySeasonForward` | `attachChannelListVerifiedPublishers({ channel, items })` |
| `getManyByChannelBySeasonBackward` | `attachChannelListVerifiedPublishers({ channel, items })` |
| `getManyByChannelShuffle` | `attachChannelListVerifiedPublishers({ channel, items })` |
| `getManyForQueueByPubDate` | `attachVerifiedPublishers({ items })` |
| `getManyForQueueBySeason` | `attachVerifiedPublishers({ items })` |

Read each handler before editing; a few build the array under another name or inside a helper
(`loadFilledTopItems`). Attach in the handler on the final array that goes into the response, not
inside `loadFilledTopItems`. Do not change ordering, pagination, or `meta`.

## `apps/api/src/controllers/queue/queueResource.ts`

Before each `res.status(200).json(...)`:

- `getNowPlayingByQueueIdText`: `await attachVerifiedPublishers({ items: itemsOfMediaResources([queueResources]) })`
  (the service returns one resource or null).
- `promoteFirstUpcomingToNowPlaying`: same, on `[queueResource]`.
- `getAllUpcomingByQueueIdText`: on `queueResources`.
- `getHistoryResourcesByQueueIdText`: on `queueResources[0]`.
- `replayPlaybackEvents`: on `queueResources`.

Leave `getAllByAccountAbridged` alone (abridged rows carry ids only).

## `apps/api/src/controllers/playlist/playlistResource.ts`

Before each success `json(...)` in `getAllByPlaylistIdTextPrivate`, `getManyForQueueByListPosition`,
`getManyByPlaylistShuffle`, and `getManyByPlaylistIdText`:
`await attachVerifiedPublishers({ items: itemsOfMediaResources(playlistResources) });`

## Must stay true

- Every touched endpoint returns the same fields, order, and status codes as before, plus
  `verified_publishers` on items and their embedded channels, plus
  `channel_wide_verified_publishers` on items of the six by-channel lists only.
- One extra query per response at most (the helpers skip the query when there are no ids).
- No `as`, no `any`, strict equality only.

## Tests

`queue.test.ts` and `playlist.test.ts` mock `@podverse/orm` with `...actual` and a live test
database, so the real `ChannelVerifiedPublisherService` would query with the mocked item ids. In
each file's `vi.mock('@podverse/orm', …)` factory, add the same stub plan 10 adds to
`category-channel-item-read.test.ts`:

```typescript
class MockChannelVerifiedPublisherService {
  getPublisherSummaries = vi.fn(async () => []);
}
```

and return it as `ChannelVerifiedPublisherService: MockChannelVerifiedPublisherService` beside the
other mocked services. Copy the method name and return shape from plan 10's stub exactly. Change
no assertions in those files; if one fails because the body now has `verified_publishers: []`,
match the response with `toMatchObject` for that assertion only.

Extend `apps/api/src/test/verified-publisher-reads.integration.test.ts` (plan 10's file; reuse its
seeded artist, album, and links). Add cases:

- `GET /item/channel/recent/:album` (match the route path in `apps/api/src/routes/item.ts`): each
  item has `verified_publishers` (the item-level row on the seeded item, `[]` on others), and each
  item's `channel_wide_verified_publishers` names the seeded artist (`id_text` and `title`).
- `GET /item/channel/recent/:podcast` for a seeded channel with no links (any existing seeded
  podcast): every item has `channel_wide_verified_publishers: []`.
- `GET /item/global/recent?medium=music&page=1` (use the medium query value the route's schema
  accepts for music): the seeded album item, when present in the page, has
  `channel.verified_publishers` naming the artist. If the global list cannot be made to include
  the seeded item deterministically, use the subscribed list with a followed album instead
  (follow it through `AccountFollowingChannel` rows in the seed) and say which in a comment.
- Queue: seed a queue for the test account with one `queue_resource` on the album item, then
  `GET /queue/:queueIdText/resources/upcoming-all` (authenticated, same helpers other queue tests
  use, for example `queue-resource-delete.integration.test.ts`): the resource's
  `item.channel.verified_publishers` names the artist.
- Unit-level: add `apps/api/src/lib/verifiedPublishers.test.ts` only if `itemsOfMediaResources`
  cannot be covered through the queue case; otherwise no separate unit test
  (**unit-test-design-no-overgranularity**). If you add it, list it in your final message.

## Release scratchpad

```markdown
## Verified publishers on item lists, queue, and playlists

- Surfaces: api (web player and mobile player and queue cache read it); OpenAPI `Item` schema
- Change: item list endpoints (global, category, subscribed, by channel, auto-queue), queue
  resource reads (now playing, upcoming, history, promote, replay), and playlist resource reads
  now include `verified_publishers` on each item and its embedded channel, the same field
  `GET /channel` and `GET /item` carry. By-channel item lists (`/item/channel/...`), whose items
  have no embedded channel, also include `channel_wide_verified_publishers` on each item: the
  publishers verified on the whole channel. Clip, soundbite, and live item lists do not include
  either field yet.
- Who notices: no one until the player artist line ships; mobile stores both fields with queue
  and list payloads (including its stored album track lists, which car album track lists and
  downloads read), and rows stored earlier show no artist until they refresh.
- Operator steps: none.
```
