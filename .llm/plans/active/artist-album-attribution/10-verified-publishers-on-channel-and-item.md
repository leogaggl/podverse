**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 10 — Verified publishers on channel and item responses

Adds one render-ready field, `verified_publishers`, to the channel and item DTOs, a shared resolver
every reader calls, an ORM read that fills it from `channel_verified_publisher` (plans 01–02), and
an API helper that attaches it. This plan wires it into `GET /channel/:idOrIdText` and
`GET /item/:idOrIdText`, which the track pages (web and mobile) and the album pages read. Plan 11
uses the helper on the artist endpoint; plan 12 on item lists, queue resources, and playlist
resources.

Areas F, G, H, and I build on this shape. Keep names and semantics exactly as written here.

## Rows

R7, R8, R21

## Runs after

02

## Files

packages/helpers/src/dtos/channel/verifiedPublisher.ts
packages/helpers/src/dtos/index.ts
packages/helpers/src/dtos/channel/channel.ts
packages/helpers/src/dtos/item/item.ts
packages/helpers/src/lib/verifiedPublishers.ts
packages/helpers/src/lib/verifiedPublishers.test.ts
packages/helpers/src/index.ts
packages/orm/src/entities/channel/channel.ts
packages/orm/src/entities/item/item.ts
packages/orm/src/services/channel/channelVerifiedPublisher.ts
apps/api/src/lib/verifiedPublishers.ts
apps/api/src/controllers/channel.ts
apps/api/src/controllers/item.ts
apps/api/openapi.yml
apps/api/src/test/verified-publisher-reads.integration.test.ts
apps/api/src/test/category-channel-item-read.test.ts
release-notes/scratchpad.md

## Decisions this plan fixes

- **The response carries a render-ready list, not raw link rows.** `channel.verified_publishers`
  lists the publishers verified on the whole channel (link rows with `item_id IS NULL`).
  `item.verified_publishers` lists publishers credited on that item alone (rows with
  `item_id = item.id`); it is empty until a parser writes item-level claims. Both are ordered by
  `claim_position` (primary first). The raw `channel_verified_publishers` relation from plan 01 is
  never loaded into API responses.
- **Present and empty means "checked, none".** Every channel or item the helper sees gets an array,
  `[]` when there are no links. Absent (`undefined`) means the response did not attach it, or the
  payload was stored before this shipped (mobile keeps item and channel JSON on disk;
  **dto-changes-are-device-data-migrations**). Readers treat absent like empty: no artist line.
- **Readers call one resolver.** `resolveVerifiedPublishers({ channel, item })` in
  `@podverse/helpers` returns channel-level publishers first, then item-level ones not already
  listed, deduped by `id_text`, dropping entries whose title is empty after trim. Whether a
  publisher shows as an artist, and its link route, stays with `getChannelRouteKind(medium_id)` in
  `packages/helpers/src/lib/medium.ts`; the resolver does not filter by medium.
- **"A, B" comes from one helper.** `joinVerifiedPublisherTitles(publishers)` joins titles with
  `', '`. The player line, the track byline, and the OS artist field (areas F and G) use it.
- **Only publishers whose feed is live are returned.** The read joins the publisher's feed
  lifecycle and keeps `active`, `pending_archive`, or no lifecycle row, the same states the match
  rule in plan 02 allows. A publisher archived after its links were computed drops out at read
  time, before any recompute or slimming runs.
- **Directory data only.** The helper reads `channel_verified_publisher`, which Add by RSS never
  writes. Add by RSS payloads (`add_by_rss_resource_data`) are untouched; areas H and I fill the
  artist line for Add by RSS content on the device.

## DTOs (`packages/helpers`)

### `packages/helpers/src/dtos/channel/verifiedPublisher.ts` (new)

```typescript
/**
 * A publisher feed credited on a channel or item, after both feeds were checked to reference
 * each other. `medium_id` decides how it is shown and linked (`getChannelRouteKind`).
 */
export interface DTOVerifiedPublisher {
  id_text: string;
  title: string | null;
  medium_id: number;
}
```

Export it from `packages/helpers/src/dtos/index.ts` beside `./channel/channelRemoteItem.js`:
`export * from './channel/verifiedPublisher.js';`

### `packages/helpers/src/dtos/channel/channel.ts`

Add after `channel_values`:

```typescript
  /**
   * Publishers verified on the whole channel, primary first. Empty when there are none. Absent
   * when the response did not include it, including channels stored before the field existed.
   */
  verified_publishers?: DTOVerifiedPublisher[];
```

with `import type { DTOVerifiedPublisher } from './verifiedPublisher.js';` in the sorted import block.

### `packages/helpers/src/dtos/item/item.ts`

Add the same optional field to `DTOItem` (after `channel`) and to `DTOItemQueueItem` (after
`channel`), with this doc comment:

```typescript
  /**
   * Publishers credited on this item alone, primary first. Channel-wide publishers live on the
   * channel; read both through `resolveVerifiedPublishers`.
   */
  verified_publishers?: DTOVerifiedPublisher[];
```

Import: `import type { DTOVerifiedPublisher } from '../channel/verifiedPublisher.js';`

### `packages/helpers/src/lib/verifiedPublishers.ts` (new)

```typescript
import type { DTOVerifiedPublisher } from '../dtos/channel/verifiedPublisher.js';

type VerifiedPublisherHolder = {
  verified_publishers?: DTOVerifiedPublisher[];
};

/**
 * Publishers to show for a channel, or for an item on that channel: channel-wide first, then
 * item-only credits, each once, primary first. Untitled publishers are left out.
 */
export const resolveVerifiedPublishers = (args: {
  channel?: VerifiedPublisherHolder | null;
  item?: VerifiedPublisherHolder | null;
}): DTOVerifiedPublisher[] => { … };

/** "A, B" for a publisher list. Empty string for an empty list. */
export const joinVerifiedPublisherTitles = (
  publishers: readonly DTOVerifiedPublisher[]
): string => { … };
```

- `resolveVerifiedPublishers`: concatenate `channel?.verified_publishers ?? []` and
  `item?.verified_publishers ?? []`, skip an entry whose `id_text` was already taken, skip an entry
  whose `title` is null or empty after trim. Return new objects only if you must; returning the
  input objects is fine.
- `joinVerifiedPublisherTitles`: trimmed titles joined with `', '`, skipping empty ones.

Export from `packages/helpers/src/index.ts` next to `export * from './lib/remoteItem.js';`:
`export * from './lib/verifiedPublishers.js';`

## ORM

### Entities

`packages/orm/src/entities/channel/channel.ts`, after the `channel_verified_publishers` relation that
plan 01 adds:

```typescript
  /**
   * Filled by API reads from channel_verified_publisher; not a column. Channel-wide publishers,
   * primary first.
   */
  verified_publishers?: DTOVerifiedPublisher[];
```

`packages/orm/src/entities/item/item.ts`, after the `channel` relation:

```typescript
  /** Filled by API reads from channel_verified_publisher; not a column. Item-only publishers. */
  verified_publishers?: DTOVerifiedPublisher[];
```

Both import `import type { DTOVerifiedPublisher } from '@podverse/helpers';` (entities already
import from `@podverse/helpers`, for example `billingCheckoutChannel.ts`). No decorator: TypeORM
ignores undecorated properties, so no column or migration follows.

### `packages/orm/src/services/channel/channelVerifiedPublisher.ts`

Add to `ChannelVerifiedPublisherService` (created by plan 02), in the read-path section, using the
same raw-SQL-plus-typed-row-reader style plan 02 uses (no `as`):

```typescript
export type VerifiedPublisherSummaryRow = {
  channelId: number;
  /** Null for a channel-wide credit. */
  itemId: number | null;
  publisher: DTOVerifiedPublisher;
};

  /**
   * Channel-wide links for `channelIds` plus item-only links for `itemIds`, with the publisher's
   * id_text, title, and medium. Publishers whose feed is not active or pending archive are left
   * out. Ordered by channel, then item (channel-wide first), then claim position.
   */
  async getPublisherSummaries(args: {
    channelIds: readonly number[];
    itemIds: readonly number[];
  }): Promise<VerifiedPublisherSummaryRow[]>
```

- Both lists empty: return `[]` without a query.
- Query on `AppDataSourceRead` (`.query(sql, params)`):

```sql
SELECT cvp.channel_id, cvp.item_id, p.id_text, p.title, p.medium_id
FROM channel_verified_publisher cvp
JOIN channel p ON p.id = cvp.publisher_channel_id
JOIN feed pf ON pf.id = p.feed_id
LEFT JOIN feed_lifecycle_state pfls ON pfls.feed_id = pf.id
LEFT JOIN feed_lifecycle_state_type pflst ON pflst.id = pfls.feed_lifecycle_state_type_id
WHERE ((cvp.item_id IS NULL AND cvp.channel_id = ANY($1::int[]))
       OR cvp.item_id = ANY($2::int[]))
  AND (pflst.state_key IS NULL OR pflst.state_key = ANY($3::text[]))
ORDER BY cvp.channel_id, cvp.item_id NULLS FIRST, cvp.claim_position, cvp.id
```

  `$3` is `[FeedLifecycleStateKeyEnum.Active, FeedLifecycleStateKeyEnum.PendingArchive]` (the enum
  is in `packages/orm/src/entities/feed/feedLifecycleStateType.ts`; reuse the allowed-states
  constant plan 02 defined if it exported one). Rows with a non-string `id_text` or non-integer
  `channel_id` / `medium_id` are skipped by the row reader.

## API

### `apps/api/src/lib/verifiedPublishers.ts` (new)

```typescript
import type { DTOVerifiedPublisher } from '@podverse/helpers';
import type { Channel, Item } from '@podverse/orm';
import { ChannelVerifiedPublisherService } from '@podverse/orm';

const channelVerifiedPublisherService = new ChannelVerifiedPublisherService();

/**
 * Sets `verified_publishers` on every channel and item passed, and on each item's embedded
 * channel when it is loaded: channel-wide publishers on channels, item-only publishers on items.
 * Objects with no links get `[]`. One query per call.
 */
export async function attachVerifiedPublishers(args: {
  channels?: Iterable<Channel | null | undefined>;
  items?: Iterable<Item | null | undefined>;
}): Promise<void>
```

- Collect channel objects: every non-null entry of `channels`, plus `item.channel` for every
  non-null item whose `channel` is set. Collect item objects: every non-null entry of `items`.
- Distinct channel ids and item ids go to `getPublisherSummaries`. Both empty: return.
- Build `Map<number, DTOVerifiedPublisher[]>` for channel-wide rows (`itemId === null`) and one for
  item rows; rows already arrive in order.
- Assign `channel.verified_publishers = byChannel.get(channel.id) ?? []` on **every** collected
  channel object (the same channel id can be embedded in several items), and
  `item.verified_publishers = byItem.get(item.id) ?? []` on every collected item.
- Errors propagate to the controller's existing `handleGenericErrorResponse`.

This is real logic, not a re-export (**avoid-reexport-wrappers**).

### `apps/api/src/controllers/channel.ts` — `ChannelController.getByIdOrIdText`

After `parsedReadyChannel` is computed and before `handleReturnDataOrNotFound`, when it is not
null: `await attachVerifiedPublishers({ channels: [parsedReadyChannel] });`. Leave
`getbyPodcastIndexId` and the list handlers unchanged.

### `apps/api/src/controllers/item.ts` — `ItemController.getByIdOrIdText`

There are two success paths today: `data` alone (channel not merged) and `{ ...data, channel }`.
Before each `handleReturnDataOrNotFound` that sends an item:

- `data` alone: `await attachVerifiedPublishers({ items: [data] });`
- With `channel`: `await attachVerifiedPublishers({ channels: [channel], items: [data] });` before
  building `{ ...data, channel }` (the spread copies the assigned property).

Do not change what the endpoint returns otherwise.

### `apps/api/openapi.yml`

Find `^    Channel:` under `components.schemas` (search; do not page through the file). Add a sibling
schema directly above it:

```yaml
    VerifiedPublisher:
      type: object
      required:
        - id_text
        - medium_id
      properties:
        id_text:
          type: string
        title:
          type: string
          nullable: true
        medium_id:
          type: integer
```

Add to `Channel.properties` (after `channel_description`):

```yaml
        verified_publishers:
          type: array
          description: Publishers verified on the whole channel, primary first. Both feeds reference each other. Present on channel and item reads that attach it.
          items:
            $ref: "#/components/schemas/VerifiedPublisher"
```

Add to `Item.properties` (after `channel`):

```yaml
        verified_publishers:
          type: array
          description: Publishers credited on this item alone, primary first. Channel-wide publishers are on the channel.
          items:
            $ref: "#/components/schemas/VerifiedPublisher"
```

`QueueResource`, `PlaylistResource`, and `RemoteItemsResultResponse` reference `Item` / `Channel`,
so they pick the field up without edits.

## Must stay true

- `GET /channel/:idOrIdText` and `GET /item/:idOrIdText` keep every existing field and status code;
  they only gain `verified_publishers`.
- No reader filters links by medium.
- No `as`, no `any`, strict equality only.

## Tests

- `packages/helpers/src/lib/verifiedPublishers.test.ts` (Vitest), one `it` each:
  - Channel-wide publishers come first, then item-only ones.
  - A publisher on both lists appears once, at its channel-wide place.
  - An entry with a null or blank title is left out.
  - Absent fields on both sides give `[]`.
  - `joinVerifiedPublisherTitles` gives `'A, B'`, and `''` for an empty list.
- `apps/api/src/test/verified-publisher-reads.integration.test.ts` (new; real database, same
  harness as `channel-merge.integration.test.ts`: `startTestApp`, seed with repositories and
  `manager.query`, unique ids and guids per run, clean up in `afterAll`). Seed an artist channel
  (medium `publisher-music`, parsed: `channel_about` row), an album channel (parsed) with one
  item, and insert `channel_verified_publisher` rows directly (channel-wide album→artist at
  position 0, plus an item-level row album item→second publisher at position 0). Cases:
  - `GET /channel/:album` returns `verified_publishers` with the artist's `id_text`, `title`, and
    `medium_id`.
  - A parsed channel with no links returns `verified_publishers: []`.
  - `GET /item/:albumItem` returns `verified_publishers` with only the item-level publisher.
  - After setting the artist feed's lifecycle to `takedown`, `GET /channel/:album` returns `[]`.
- `apps/api/src/test/category-channel-item-read.test.ts`: its `vi.mock('@podverse/orm')` factory
  spreads `actual`. Add `class MockChannelVerifiedPublisherService { getPublisherSummaries =
  vi.fn(async () => []); }` and return it as `ChannelVerifiedPublisherService`, so the channel and
  item read cases do not depend on the new table. Existing assertions stay unchanged.

## Release scratchpad

```markdown
## Verified publishers on channel and item responses

- Surfaces: api, helpers (web and mobile clients read it)
- Change: `GET /channel/:idOrIdText` and `GET /item/:idOrIdText` add `verified_publishers`, an
  ordered list of `{ id_text, title, medium_id }`. On a channel it lists publishers (artists)
  verified on the whole channel, meaning both feeds reference each other; on an item it lists
  publishers credited on that item alone (empty until feeds can express item credits). Publishers
  whose feed is not active or pending archive are left out. `@podverse/helpers` adds
  `DTOVerifiedPublisher`, `resolveVerifiedPublishers`, and `joinVerifiedPublisherTitles`.
- Who notices: no one until the player and track page changes ship; API consumers see a new field.
- Operator steps: none.
```
