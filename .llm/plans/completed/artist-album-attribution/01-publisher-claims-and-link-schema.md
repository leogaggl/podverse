**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 01 — Publisher claims as lists, and the verified publisher link table

Schema and ORM groundwork for verified publisher links. After this plan:

- An album (any content channel) can store several publisher claims, in feed order, at the
  channel level or for one of its items.
- A new table, `channel_verified_publisher`, holds the links that plan 02 computes: content
  channel, publisher channel, an optional item for a track-level credit, and the claim's position.
- Nothing writes link rows yet. Plan 02 adds the match rule and the recompute; plan 03 calls it
  from the parser; plan 06 backfills existing data.

Other work is landing in the tree. Before editing, confirm these anchors still exist and adjust if
they moved: `ChannelPublisher` and `ChannelPublisherRemoteItem` in
`packages/orm/src/entities/channel/`, `getChannelOneToOneRelations` in
`packages/orm/src/services/channel/channel.ts`, `CHANNEL_DETAIL_DELETE_QUERIES` in
`packages/orm/src/services/archiver.ts`, and `API_EXPECTED_MIGRATION_FILENAME` in
`infra/k8s/base/api/source/api.env` and `infra/k8s/base/ops/kustomization.yaml`.

## Rows

R8, R12, R14, R15, R16, R17

## Runs after

none

## Files

infra/k8s/base/ops/source/database/linear-migrations/app/0022_channel_verified_publisher.sql
infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
infra/k8s/base/api/source/api.env
infra/k8s/base/ops/kustomization.yaml
packages/orm/src/entities/channel/channel.ts
packages/orm/src/entities/channel/channelPublisher.ts
packages/orm/src/entities/channel/channelPublisherRemoteItem.ts
packages/orm/src/entities/channel/channelVerifiedPublisher.ts
packages/orm/src/db/entities.ts
packages/orm/src/index.ts
packages/orm/src/services/channel/channel.ts
packages/orm/src/services/channel/channelPublisherRemoteItem.ts
packages/orm/src/services/archiver.ts
packages/orm/src/services/archiver.test.ts
packages/helpers/src/dtos/channel/channelPublisherRemoteItem.ts
release-notes/scratchpad.md

## Decisions this plan fixes

- **The link is named "verified publisher", never "artist".** Table `channel_verified_publisher`,
  entity `ChannelVerifiedPublisher`. `channel_id` is the content channel (an album today; any
  medium the namespace lets name a publisher), `publisher_channel_id` is the publisher feed's
  channel. Whether a publisher shows as an artist stays in `getChannelRouteKind` /
  `isArtistMediumId` in `packages/helpers/src/lib/medium.ts`. A later record-label experience
  changes that helper and no data. (R16)
- **Links are many-to-many.** One album can have several verified publishers and one publisher
  many albums. Unique on `(channel_id, publisher_channel_id, item_id)` with nulls not distinct, so
  each pair has at most one album-level row and one row per credited item. (R12, R15)
- **`item_id` is the track-level credit.** Null means the publisher is credited on the whole
  channel. Set means one item of that channel is credited. Nothing writes item-level rows until
  feeds can express them (see the claims bullet below), but the recompute in plan 02 already
  handles them, so only the parser changes when they arrive. (R15, R17)
- **`claim_position` keeps "first is primary".** It is the claim's index among the content
  feed's claims in the same scope (channel level, or one item), counting from 0. Readers order
  by it, so "A, B" lists the primary publisher first.
- **Claims become lists, at channel and item level.** `channel_publisher_remote_item` drops its
  one-row-per-`channel_publisher` constraint and gains a nullable `item_id`: the item whose own
  `<podcast:publisher>` made the claim, null for the channel's `<podcast:publisher>`. Today's
  feeds still produce at most one channel-level claim, because partytime reads one remote item.
  The anticipated namespace shape (several remote items in one `<podcast:publisher>`, and
  `<podcast:publisher>` inside `<item>`) then fits with no migration. (R14, R15)
- **`ChannelPublisherRemoteItemService.updateMany` replaces only channel-level claims**
  (`item_id IS NULL`). Item-level claims, once a parser writes them, are owned by that parser
  step and survive a channel-level refresh.
- **Links are directory data only.** Add by RSS feeds never reach these tables; their artist
  matching is by guid on the device (areas H and I). Web and mobile read the same rows through
  the API (area B). (R8)
- **No backfill SQL in the migration.** The match rule lives in TypeScript (plan 02), and plan 06's
  worker command fills links for existing rows with that same code, so the rule has one
  implementation.

## Migration

Create `infra/k8s/base/ops/source/database/linear-migrations/app/0022_channel_verified_publisher.sql`.
`0021_channel_may_have_live_items.sql` is the latest today. Another set (realtime-banner
notifications) also plans a `0022_*`. Use the next free number when this runs, and use that same
filename in `api.env`, `kustomization.yaml`, and the release entry. Every
`0022_channel_verified_publisher.sql` below means the filename you used.

Greenfield only (**linear-sql-greenfield-only**): no `IF EXISTS` / `IF NOT EXISTS`. The dropped
constraint and indexes are created in `0001_app_schema.sql` and no later file touches them.
Postgres is 18.3, so `NULLS NOT DISTINCT` is available (`0013_membership_billing_ledger.sql` uses
it).

```sql
-- Publisher claims are lists. A content feed's <podcast:publisher> may name several publisher
-- feeds, and an item's own <podcast:publisher> may credit a publisher on that item alone.
-- item_id is that item; it is null for a claim made at the channel level. Within one scope the
-- claim with the lowest id is the primary publisher.
ALTER TABLE public.channel_publisher_remote_item
    DROP CONSTRAINT channel_publisher_remote_item_channel_publisher_id_key;

DROP INDEX public.uq_channel_publisher_remote_item_feed_guid_item_guid;

DROP INDEX public.uq_channel_publisher_remote_item_feed_guid_no_item_guid;

ALTER TABLE public.channel_publisher_remote_item
    ADD COLUMN item_id integer;

ALTER TABLE public.channel_publisher_remote_item
    ADD CONSTRAINT channel_publisher_remote_item_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX uq_channel_publisher_remote_item_claim
    ON public.channel_publisher_remote_item
    USING btree (channel_publisher_id, item_id, feed_guid, item_guid) NULLS NOT DISTINCT;

CREATE INDEX idx_channel_publisher_remote_item_item_id
    ON public.channel_publisher_remote_item USING btree (item_id)
    WHERE item_id IS NOT NULL;

-- A publisher feed and a content feed that reference each other. The content feed's
-- <podcast:publisher> names the publisher's guid, and the publisher feed's podcast:remoteItem
-- names the content feed's guid; when either side's pointer carries a feedUrl, it matches the
-- other feed's URL. The parser recomputes a content channel's rows whenever it or a publisher it
-- names is parsed, so a reference dropped from either feed removes the row.
--
-- channel_id is the content channel (an album). item_id is set when the credit is for one item
-- of that channel. claim_position is the claim's order in the content feed, 0 being primary.
CREATE TABLE public.channel_verified_publisher (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    channel_id integer NOT NULL,
    publisher_channel_id integer NOT NULL,
    item_id integer,
    claim_position smallint NOT NULL,
    CONSTRAINT channel_verified_publisher_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE,
    CONSTRAINT channel_verified_publisher_publisher_channel_id_fkey
        FOREIGN KEY (publisher_channel_id) REFERENCES public.channel(id) ON DELETE CASCADE,
    CONSTRAINT channel_verified_publisher_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE,
    CONSTRAINT channel_verified_publisher_not_self_check
        CHECK (channel_id <> publisher_channel_id),
    CONSTRAINT channel_verified_publisher_claim_position_check
        CHECK (claim_position >= 0)
);

CREATE UNIQUE INDEX uq_channel_verified_publisher
    ON public.channel_verified_publisher
    USING btree (channel_id, publisher_channel_id, item_id) NULLS NOT DISTINCT;

CREATE INDEX idx_channel_verified_publisher_publisher_channel_id
    ON public.channel_verified_publisher USING btree (publisher_channel_id);

CREATE INDEX idx_channel_verified_publisher_item_id
    ON public.channel_verified_publisher USING btree (item_id)
    WHERE item_id IS NOT NULL;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.channel_verified_publisher TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_verified_publisher TO podverse_app_read;
```

The unique index leads with `channel_id`, so it also serves lookups by content channel. The
`item_id` indexes keep the `ON DELETE CASCADE` cheap when the archiver deletes items.

### Baselines and readiness marker

Per **linear-baseline-0004** and **migration-readiness-marker-sync**:

1. Run `make db_regen_linear_baseline`, then `make db_verify_linear_baseline`, from the repo root.
   Leave the regenerated `0004_app_linear_baseline.sql.gz` and `0005_management_linear_baseline.sql.gz`
   in the working tree. This generates committed files; it is not a test run. If either target
   fails because Docker or the database container is unavailable, finish everything else and
   report it as a blocker in the final message, with the two commands for the operator.
1. In `infra/k8s/base/api/source/api.env`, set
   `API_EXPECTED_MIGRATION_FILENAME=0022_channel_verified_publisher.sql` (or the renumbered name).
   Leave `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` alone.
1. In `infra/k8s/base/ops/kustomization.yaml`, move the `API_EXPECTED_MIGRATION_FILENAME=` literal
   under `podverse-ops-migration-scripts` to the new filename, and add
   `source/database/linear-migrations/app/<new filename>` to the `podverse-ops-app-linear-migrations`
   file list directly after the current last app migration line.
1. Confirm `infra/k8s/base/api/deployment.yaml` reads the marker from the env var (it does today:
   `'$API_EXPECTED_MIGRATION_FILENAME'`). Change nothing there.

## Entities

### `packages/orm/src/entities/channel/channelPublisher.ts`

Mirror `ChannelPodroll` (`channelPodroll.ts`), which already has one parent row and many remote
items. Replace the `@OneToOne` remote-item relation and its "only ONE remote item" comment with:

```typescript
  @OneToMany(
    'ChannelPublisherRemoteItem',
    (remoteItem: ChannelPublisherRemoteItem) => remoteItem.channel_publisher
  )
  channel_publisher_remote_items!: ChannelPublisherRemoteItem[];
```

Add `OneToMany` to the `typeorm` value import; keep `OneToOne` (the `channel` relation uses it).
Keep `Relation` only if still used.

### `packages/orm/src/entities/channel/channelPublisherRemoteItem.ts`

- Change the `channel_publisher` relation from `@OneToOne` to `@ManyToOne`, same arguments and
  `@JoinColumn({ name: 'channel_publisher_id' })`, like `ChannelPodrollRemoteItem.channel_podroll`.
- Add after `medium_id`, following the column-plus-relation pattern in `channelMerge.ts`
  (`from_channel_id` / `from_channel`):

```typescript
  /** The item whose own podcast:publisher made this claim. Null for a channel-level claim. */
  @Column({ type: 'int', name: 'item_id', nullable: true })
  item_id!: number | null;

  @ManyToOne('Item', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item> | null;
```

Import `Item` with `import type` from `@orm/entities/item/item.js`. Update the `typeorm` import
(`Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn`).

### `packages/orm/src/entities/channel/channelVerifiedPublisher.ts` (new)

```typescript
import type { Channel } from '@orm/entities/channel/channel.js';
import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A publisher feed and a content feed that reference each other. Rows are derived: the parser
 * recomputes a content channel's rows from both feeds' references, so never edit them by hand.
 * Whether a publisher reads as an artist is decided by the publisher channel's medium, not here.
 */
@Entity({ name: 'channel_verified_publisher' })
export class ChannelVerifiedPublisher {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  /** The content channel the publisher is credited on (an album today). */
  @Column({ type: 'int', name: 'channel_id' })
  channel_id!: number;

  @ManyToOne('Channel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @Column({ type: 'int', name: 'publisher_channel_id' })
  publisher_channel_id!: number;

  @ManyToOne('Channel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publisher_channel_id' })
  publisher_channel!: Relation<Channel>;

  /** Set when the credit is for one item of the content channel; null for the whole channel. */
  @Column({ type: 'int', name: 'item_id', nullable: true })
  item_id!: number | null;

  @ManyToOne('Item', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item> | null;

  /** The claim's order in the content feed within its scope; 0 is the primary publisher. */
  @Column({ type: 'smallint', name: 'claim_position' })
  claim_position!: number;
}
```

`@PrimaryGeneratedColumn('identity')` matches the identity column, as in `channelMerge.ts`.

### `packages/orm/src/entities/channel/channel.ts`

Add beside `channel_remote_items`:

```typescript
  @OneToMany(
    'ChannelVerifiedPublisher',
    (link: ChannelVerifiedPublisher) => link.channel
  )
  channel_verified_publishers!: ChannelVerifiedPublisher[];
```

with `import type { ChannelVerifiedPublisher } from '@orm/entities/channel/channelVerifiedPublisher.js';`
next to the `ChannelRemoteItem` type import. No other relation in `channelGetOneRelations` loads
it; area B decides which reads load it.

### Registration and exports

- `packages/orm/src/db/entities.ts`: import `ChannelVerifiedPublisher` and add it to the list
  after `ChannelRemoteItem`.
- `packages/orm/src/index.ts`: add `export * from './entities/channel/channelVerifiedPublisher.js';`
  after the `channelRemoteItem.js` entity export.

## ORM services

### `packages/orm/src/services/channel/channel.ts`

In `getChannelOneToOneRelations`, change
`{ channel_publisher: { channel_publisher_remote_item: true } }` to
`{ channel_publisher: { channel_publisher_remote_items: true } }`.

### `packages/orm/src/services/channel/channelPublisherRemoteItem.ts`

Rewrite `updateMany` so it replaces channel-level claims only and keeps feed order. Rename the
`getAll` parameter from `channel_podroll` to `channel_publisher` while there.

```typescript
  /**
   * Replaces the channel-level claims (item_id null) with `dtos`, in feed order. Deleting first
   * keeps ids in feed order, and the lowest id is the primary publisher. Item-level claims are
   * left alone.
   */
  async updateMany(
    channel_publisher: ChannelPublisher,
    dtos: RemoteItemDto[]
  ): Promise<ChannelPublisherRemoteItem[]> {
    const filteredDtos = filterInvalidFeedUuids(dtos);
    const existing = (await this.getAll(channel_publisher)).filter(
      (claim) => claim.item_id === null
    );
    if (existing.length > 0) {
      await this.repositoryReadWrite.remove(existing);
    }

    const results: ChannelPublisherRemoteItem[] = [];
    for (const dto of filteredDtos) {
      const entity = await this.update(channel_publisher, dto);
      results.push(entity);
    }
    return results;
  }
```

This keeps today's `getAll` plus `remove` approach and only filters to channel-level rows. No
typeorm import changes. The base `update` upserts by `feed_guid`/`feed_url`/`item_guid` within the
parent, so while no item-level claims exist every dto inserts. A later parser step that writes
item-level claims must insert them with `item_id` set rather than call `update`, or `update` could
reuse an item-level row for a channel-level claim with the same guid. Say this in the method's
doc comment.

## Archive and takedown cleanup

In `packages/orm/src/services/archiver.ts`, add one entry to `CHANNEL_DETAIL_DELETE_QUERIES`,
directly before `...CHANNEL_OWNED_DETAIL_TABLES.map(...)`:

```typescript
  {
    table: 'channel_verified_publisher',
    sql: `DELETE FROM channel_verified_publisher
            WHERE channel_id = $1 OR publisher_channel_id = $1`,
    params: (channelId) => [channelId],
    byteFrom: `channel_verified_publisher t INNER JOIN channel c ON c.id = t.channel_id`,
  },
```

Archived slimming (`slimArchivedChannels`) and takedown (`removeAllItemsForTakedownFeeds`) both run
this list, so an archived or taken-down show stops being anyone's verified album or publisher.
The slim report counts bytes on the content side only; the table is small.

Update the doc comment above `CHANNEL_DETAIL_DELETE_QUERIES` to say verified publisher links are
removed on either side.

## DTO

`packages/helpers/src/dtos/channel/channelPublisherRemoteItem.ts`: add
`item_id: number | null;` after `item_guid`. Nothing imports this type today; it mirrors the
entity.

## API response shape

`GET /channel/:idOrIdText` and the item read that uses `channelGetOneRelations` return the channel
entity as loaded, so `channel.channel_publisher.channel_publisher_remote_item` (one object)
becomes `channel.channel_publisher.channel_publisher_remote_items` (an array). OpenAPI does not
document `channel_publisher`, and no web, mobile, or management code reads it (searched
`apps/web/src`, `apps/mobile/src`, `apps/management-web`, `packages/ui`). Mobile may hold old copies
in stored channel or item JSON; nothing reads the field, so they are harmless
(**dto-changes-are-device-data-migrations** checked). Note it in the release entry.

## Must stay true

- No reader of the link table yet; behavior of every page and endpoint is unchanged except the
  renamed relation above.
- `handleParsedChannelPublisher` keeps working unchanged: it still calls `updateMany` with the
  channel's claims and deletes the `channel_publisher` row when the feed has none.
- No `as` added outside the existing test fixture style.

## Tests

- `packages/orm/src/services/archiver.test.ts`: add
  `it('removes verified publisher links on either side of an archived show')` asserting the
  `channel_verified_publisher` entry exists in `CHANNEL_DETAIL_DELETE_QUERIES`, its `sql` matches
  `/channel_id = \$1 OR publisher_channel_id = \$1/`, and `params(7)` returns `[7]`.
- `packages/orm/src/services/base/baseRemoteItemsService.test.ts`: unchanged; it must still pass
  (it covers `getAll` / `getByFeedGuid` on `ChannelPublisherRemoteItemService`).
- The migration is exercised by `make db_regen_linear_baseline` / `make db_verify_linear_baseline`
  in this plan, and by the API integration tests in plans 02 and 05, which run against the
  migrated schema.

## Release scratchpad

```markdown
## Verified publisher links: schema

- Surfaces: api, workers, ops
- Change: new app migration `0022_channel_verified_publisher.sql`. Publisher claims
  (`channel_publisher_remote_item`) may now hold several rows per feed and gain a nullable
  `item_id` for item-level claims. New table `channel_verified_publisher` holds links between a
  publisher feed and a content feed that reference each other (content channel, publisher
  channel, optional item, claim position). Archiving or taking down a show removes its links on
  either side. `GET /channel` and item reads that embed the channel now return
  `channel_publisher.channel_publisher_remote_items` (array) instead of
  `channel_publisher.channel_publisher_remote_item` (object); no Podverse client reads it.
- Who notices: no one yet; nothing reads the links until the artist page and player changes ship.
- Operator steps: run app linear migrations before rolling the API. The API readiness marker
  `API_EXPECTED_MIGRATION_FILENAME` moves to `0022_channel_verified_publisher.sql`; a GitOps
  overlay that pins it must move with it.
```
