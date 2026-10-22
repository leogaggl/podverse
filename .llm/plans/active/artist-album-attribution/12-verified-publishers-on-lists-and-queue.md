**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 12 — Verified publishers on item lists, queue resources, and playlist resources

Plan 10 attaches `verified_publishers` on single channel and item reads. Players also take their
item and channel from item lists (Home, Browse, album track lists, auto-queue), the queue resources
(web restore and the mobile queue cache), and playlist resources. This plan calls plan 10's
`attachVerifiedPublishers` in each of those handlers, so the artist line has its data wherever
playback starts, and mobile stores the field with the rest of the payload (older stored rows show
no artist line until they refresh).

No new endpoint, no response shape change beyond the added field. OpenAPI already gets the field
through the `Item` and `Channel` schemas (plan 10), which `QueueResource` and `PlaylistResource`
reference.

## Rows

R7, R8, R21

## Runs after

10

## Files

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
- **Items without an embedded channel still get item-level credits.** Album track lists
  (`/item/channel/...`) return items without `channel`; the player uses the album channel from
  `GET /channel` (plan 10) and the helper sets each item's item-only list.

## `apps/api/src/lib/verifiedPublishers.ts`

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

Add `await attachVerifiedPublishers({ items })` (with whatever the local array is named) right
before the `ApiListResponse` / `res.json` in each of these handlers. Items loaded with
`itemGetManyRelationsWithChannel` / `subItemGetManyRelationsWithChannel` carry `channel`, which the
helper covers automatically.

| Handler | Items variable |
| --- | --- |
| `getManyGlobalRecent` | `items` (attach before the `.filter(Boolean)` result is placed in `data`; attach on the filtered array) |
| `getManyGlobalTop` | the loaded items |
| `getManyCategoryRecent` | the loaded items |
| `getManyCategoryTop` | the loaded items |
| `getManySubscribedRecent` | `items` (skip on the empty early return) |
| `getManySubscribedTop` | `items` (skip on the empty early return) |
| `getManyByChannelRecent` | `items` |
| `getManyByChannelOldest` | the loaded items |
| `getManyByChannelTop` | the loaded items |
| `getManyByChannelBySeasonForward` | the loaded items |
| `getManyByChannelBySeasonBackward` | the loaded items |
| `getManyByChannelShuffle` | the loaded items |
| `getManyForQueueByPubDate` | `items` |
| `getManyForQueueBySeason` | `items` |

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
  `verified_publishers` on items and their embedded channels.
- One extra query per response at most (the helper skips the query when there are no ids).
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
  item has `verified_publishers` (the item-level row on the seeded item, `[]` on others).
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

- Surfaces: api (web player and mobile player and queue cache read it)
- Change: item list endpoints (global, category, subscribed, by channel, auto-queue), queue
  resource reads (now playing, upcoming, history, promote, replay), and playlist resource reads
  now include `verified_publishers` on each item and its embedded channel, the same field
  `GET /channel` and `GET /item` carry. Clip, soundbite, and live item lists do not include it yet.
- Who notices: no one until the player artist line ships; mobile stores the field with queue and
  list payloads, and rows stored earlier show no artist until they refresh.
- Operator steps: none.
```
