**Cursor model:** Opus 5.5 · **Reasoning:** high

# 02 — Verified publisher match rule and recompute service

The match rule as a pure function, and an ORM service that recomputes a content channel's
`channel_verified_publisher` rows (table from plan 01) from what is stored for both feeds. Plan
03 calls it on every parse, plan 04 reads it for notifications, plan 06 runs it over existing
data, and area B reads the rows for artist pages, players, and track pages.

## Rows

R1, R2, R3, R4, R5, R8, R9, R10, R11, R12, R13, R15, R16

## Runs after

01

## Files

packages/orm/src/lib/verifiedPublisherMatch.ts
packages/orm/src/lib/verifiedPublisherMatch.test.ts
packages/orm/src/services/channel/channelVerifiedPublisher.ts
packages/orm/src/index.ts
apps/api/src/test/channel-verified-publisher.integration.test.ts
release-notes/scratchpad.md

## How Podverse handles artists, albums, and tracks (answers to the question rows)

- **R1, how it is set up today.** An artist is a channel whose medium is a publisher medium
  (`PublisherMusic` 22, routed to `/artist`). Its feed lists albums as channel-level
  `podcast:remoteItem` rows in `channel_remote_item` (no `item_guid`), and sometimes single tracks
  (with `item_guid`). An album is a channel with medium `music`; its `<podcast:publisher>` pointer
  is stored in `channel_publisher` / `channel_publisher_remote_item`. Today the artist page
  (`PublisherFeedService.getPublisherFeedRemoteItemsForChannel`) trusts the artist's list alone,
  matching albums by guid and then by feed URL, and never reads the album's pointer.
- **R2, querying "all tracks by an artist".** With links stored, it is a join:
  `channel_verified_publisher (publisher_channel_id = artist, item_id IS NULL)` gives the verified
  albums, and their items are the tracks. Item-level rows (future) add single credited tracks.
  Area B writes those reads.
- **R3, an album with no artist feed.** The album's claim is stored whether or not the publisher
  feed exists in Podverse. No link exists until the publisher feed is parsed and lists the album
  back; then the publisher's parse recomputes the album's links. Until then the album has no
  verified artist and the player hides the artist line (settled design).
- **R4, R9, R11, integrity.** A link needs both feeds to point at each other. Guid-only matching
  is not enough: `channel.podcast_guid` is unique and the first feed parsed keeps it, so a
  squatting feed could hold a real artist's guid. The `feedUrl` checks below close that hole
  whenever a pointer carries a URL.
- **R5, what the spec says.** The Podcast Index publisher doc has the content feed name its
  publisher in `<podcast:publisher>` and says apps should confirm that claim against the
  publisher feed's `podcast:remoteItem` list. Requiring the reference in both directions before
  showing either side is Podverse display policy and needs no spec approval. The draft in
  `docs/proposals/podcast-namespace/PUBLISHER-ATTRIBUTION.md` (written by another set) proposes
  making it explicit.
- **R8, surfaces.** Links are computed server-side for directory content only and read by web and
  mobile through the same API. Add by RSS content never writes them; its matching is by guid on
  the device (areas H and I).
- **R16.** Names stay generic ("verified publisher"); the artist reading is a medium check in
  `packages/helpers/src/lib/medium.ts`.

## The match rule

A content channel C (the claimant) has a verified publisher P for a claim when all hold:

1. C has a `podcast_guid`, and C's feed lifecycle is `active` or `pending_archive`.
2. P is a different channel whose `podcast_guid` equals the claim's `feed_guid`, and P's feed
   lifecycle is `active` or `pending_archive`. A feed with no lifecycle row counts as `active`
   (the parser treats it that way).
3. When the claim has a `feed_url`, it matches one of P's feed URLs.
4. P's `channel_remote_item` rows include one whose `feed_guid` is C's guid and whose `item_guid`
   is empty for a channel-level claim, or equals the claimed item's `guid` for an item-level claim.
5. When that remote item has a `feed_url`, it matches one of C's feed URLs.
6. The claim's own `item_guid` (the itemGuid attribute inside `<podcast:publisher>`) is empty.
   A channel-level pointer to a publisher's item is malformed and is ignored.

**Feed URLs of a channel** are its `feed.url` plus the `feed.url` of every channel merged into it
(`channel_merge` with `status = 'applied'`, `mode = 'absorb'`, `to_channel_id` = the channel).
Those are the redirects Podverse knows.

**URLs match** when their match keys are equal. The key is: lowercased host, then `:port` when the
URL has a non-default port, then the path with one trailing `/` removed (except the root `/`),
then the query string as is. The scheme is ignored (http and https match). Userinfo and the
fragment are dropped. An unparseable URL has no key and matches nothing.

Do not reuse `hostAndPath` from `packages/orm/src/lib/duplicateFeedMatch.ts`. It drops the query
string on purpose for its self-link heuristic. Here two feeds on one host can differ only by
query (`feed.php?id=1` versus `?id=2`), and a looser key would let one claim the other.

**Positions.** A claim's `claim_position` is its index among C's claims in the same scope
(channel level, or one `item_id`), in `channel_publisher_remote_item.id` order, counting
unverified claims too. One publisher appears once per scope, at its lowest position.

Medium is not checked on either side. A publisher feed whose medium is mis-detected (the separate
`publisher-medium-and-namespace-draft` set fixes one such bug) still links; readers decide how a
publisher is shown.

## `packages/orm/src/lib/verifiedPublisherMatch.ts` (new, pure)

No database access. Exports:

```typescript
export type PublisherClaim = {
  feedGuid: string;
  feedUrl: string | null;
  /** The itemGuid attribute inside podcast:publisher. A valid claim has none. */
  itemGuid: string | null;
  /** The content item whose own podcast:publisher made the claim; null at channel level. */
  itemId: number | null;
  /** That item's guid, read with the claim. Null when itemId is null or the item is gone. */
  claimItemGuid: string | null;
};

export type ClaimantFeed = {
  channelId: number;
  podcastGuid: string | null;
  feedUrls: readonly string[];
  /** In channel_publisher_remote_item id order. */
  claims: readonly PublisherClaim[];
};

export type PublisherRemoteItemRef = {
  feedGuid: string;
  feedUrl: string | null;
  itemGuid: string | null;
};

export type PublisherFeedRefs = {
  channelId: number;
  podcastGuid: string | null;
  feedUrls: readonly string[];
  /** The publisher's remote items that name the claimant's guid. */
  remoteItems: readonly PublisherRemoteItemRef[];
};

export type VerifiedPublisherLinkRow = {
  publisherChannelId: number;
  itemId: number | null;
  claimPosition: number;
};

export function feedUrlMatchKey(url: string): string | null;
export function feedUrlMatchesAny(url: string, urls: readonly string[]): boolean;
export function computeVerifiedPublisherLinks(
  claimant: ClaimantFeed,
  publishers: readonly PublisherFeedRefs[]
): VerifiedPublisherLinkRow[];
```

- Parse URLs with `parseHttpOrHttpsUrl` from `@podverse/helpers-validation` (already an ORM
  dependency).
- Compare guids case-insensitively after trimming (they come from `uuid` columns, but the function
  must not depend on that).
- Treat an empty string `itemGuid` the same as null.
- Return rows in claim order. Rows are unique by `(publisherChannelId, itemId)`.

## `packages/orm/src/services/channel/channelVerifiedPublisher.ts` (new)

`export class ChannelVerifiedPublisherService`, using `AppDataSourceRead` /
`AppDataSourceReadWrite` from `@orm/db/index.js` and raw SQL with typed row readers. Read rows the
way `archiver.ts` does (`Reflect.get` plus a type check, `finiteInteger`-style helpers); no `as`.
Use `FeedLifecycleStateKeyEnum`, `ChannelMergeStatus`, and `ChannelMergeMode` values as query
parameters, not string literals in SQL.

### Write path

- `async recomputeForChannel(channelId: number): Promise<{ links: number; contentChannelsRechecked: number }>`
  - Runs `recomputeForContentChannel(channelId)` (the channel as a claimant).
  - Then finds every content channel whose links can involve this channel as publisher: channels
    whose claims name this channel's `podcast_guid`, plus channels that already have a row with
    `publisher_channel_id` = this channel. Exclude this channel. Sort ascending, and run
    `recomputeForContentChannel` for each.
  - A channel is often both: a publisher feed with a `<podcast:publisher>` of its own. Running
    both passes always is simpler and cheap for feeds with neither (two indexed queries).

- `async recomputeForContentChannel(channelId: number): Promise<number>` — returns the number of
  rows now stored for that channel. One `AppDataSourceReadWrite.transaction` per call:
  1. `SELECT pg_advisory_xact_lock($1, $2)` with a namespace constant and `channelId`. Name it
     `VERIFIED_PUBLISHER_ADVISORY_LOCK_NAMESPACE`. Use `744`; grep `pg_advisory` first and pick
     another unused value if 744 is taken (`743` is queue replay in `queueResource.ts`).
  2. Read, inside the transaction and after the lock, the claimant: `podcast_guid`, `feed.url`,
     lifecycle `state_key` (left joins, null counts as `active`), its claims
     (`channel_publisher` join `channel_publisher_remote_item`, ordered by
     `channel_publisher_remote_item.id`, left join `item` on `item.id = item_id AND
     item.channel_id = channel_publisher.channel_id` for `claimItemGuid`), and its merged-in feed
     URLs.
  3. Read possible publishers: channels with `podcast_guid = ANY(<claim guids>)`, `id <> channelId`,
     lifecycle allowed. For them, read their `feed.url`, merged-in feed URLs, and only the
     `channel_remote_item` rows with `feed_guid` = the claimant's guid.
  4. `computeVerifiedPublisherLinks`. Skip steps 3–4 (empty result) when the claimant has no guid,
     no claims, or a lifecycle not allowed.
  5. Read the current rows for `channel_id`. When they equal the computed set (same publisher,
     item, and position), write nothing. Otherwise delete the channel's rows and insert the
     computed ones in one statement (`INSERT … SELECT … FROM unnest($2::int[], $3::int[],
     $4::smallint[])`).

  Why the lock is enough: a pair (P, C) is only ever written by `recomputeForContentChannel(C)`.
  Two recomputes for the same C serialize on C's lock, and each reads committed state after
  taking it, so the last one to run sees the final state of both feeds. Plan 03 calls the
  recompute after the parse's own transaction commits. Each call holds one lock, so there is no
  lock ordering to get wrong.

- `async computeForContentChannel(channelId: number): Promise<VerifiedPublisherLinkRow[]>` — steps
  2–4 without the lock or writes, on `AppDataSourceRead`. Plan 06's dry run uses it. Factor
  steps 2–4 into one private loader that takes an `EntityManager` so both paths share it.

### Read path (minimal; area B adds what pages need)

- `async isVerified(publisherChannelId: number, channelId: number): Promise<boolean>` — an
  album-level row (`item_id IS NULL`) exists. Plan 04 uses it.
- `async getForContentChannels(channelIds: number[]): Promise<ChannelVerifiedPublisher[]>` — rows
  for those content channels, ordered by `channel_id`, `item_id` nulls first, `claim_position`.
  Empty input returns `[]` without a query.
- `async getForPublisher(publisherChannelId: number): Promise<ChannelVerifiedPublisher[]>` —
  album-level rows for one publisher, ordered by `channel_id`.

Use TypeORM `find` on `AppDataSourceRead.getRepository(ChannelVerifiedPublisher)` for the read
path. Do not load relations; callers join what they need.

In `packages/orm/src/index.ts`, add
`export * from './services/channel/channelVerifiedPublisher.js';` after the
`./services/channel/channelRemoteItem.js` export, and
`export * from './lib/verifiedPublisherMatch.js';` after the `./lib/billingLimits.js` export.

## Must stay true

- Only `recomputeForContentChannel` writes `channel_verified_publisher` rows (plan 01's archiver
  delete and plan 05's merge delete are removals of whole channels' rows, not recomputes).
- A dropped reference on either side removes the link on the next recompute of that content
  channel. (R13)
- A claim with a `feed_url` that does not match the publisher's URLs never links, even when guids
  match both ways. (R10, R11)
- Recompute never throws for a channel that does not exist; it stores nothing and returns 0.
- No `as`, no `any`, strict equality only.

## Tests

- `packages/orm/src/lib/verifiedPublisherMatch.test.ts` (Vitest). One `it` each:
  - Guids match both ways with no URLs: one link at position 0.
  - The album's claim names a guid with no publisher in the list: no link.
  - The publisher does not list the album back: no link.
  - The claim's `feedUrl` names another host: no link (the squatted-guid case).
  - The claim's `feedUrl` differs only by http versus https, a trailing slash, or host case: links.
  - The claim's `feedUrl` equals a merged-in URL of the publisher: links.
  - The publisher's remote item `feedUrl` names another album URL: no link.
  - Query strings differ (`?id=1` versus `?id=2`): no link.
  - Two claims to two publishers that both list the album: two links, positions 0 and 1.
  - The same publisher claimed twice: one link at the lower position.
  - An item-level claim whose item guid the publisher lists with that `itemGuid`: a link with
    `itemId` set; the same claim when the publisher lists only the album: no item link.
  - A claim with its own `itemGuid` set: ignored.
  - The claimant has no guid: no links.
- `apps/api/src/test/channel-verified-publisher.integration.test.ts` (new; real database, same
  harness as `channel-merge.integration.test.ts`: `startTestApp`, seed with repositories and
  `manager.query`, unique ids per run). Cases:
  - An album and an artist that reference each other: `recomputeForChannel(album)` stores one
    row; `recomputeForChannel(artist)` leaves it unchanged.
  - The artist's remote item for the album is deleted, then `recomputeForChannel(artist)`: the row
    is gone.
  - The album's claim `feed_url` is set to an unrelated URL, then `recomputeForChannel(album)`: no
    row.
  - The artist's feed lifecycle is set to `takedown`, then `recomputeForChannel(album)`: no row.
  - `isVerified`, `getForContentChannels`, and `getForPublisher` return the stored row.
  Clean up the rows the test seeded in `afterAll` the way the merge test scopes its data.

## Release scratchpad

```markdown
## Verified publisher match rule

- Surfaces: workers (parser), api
- Change: an album is linked to a publisher (artist) feed only when both feeds reference each
  other: the album's `<podcast:publisher>` names the publisher's guid and the publisher feed's
  `podcast:remoteItem` names the album's guid. When either pointer carries a `feedUrl`, it must
  match the other feed's URL; http versus https, host case, and one trailing slash are ignored,
  and URLs of duplicate feeds merged into a channel count as that channel's. Both feeds must be
  active or pending archive. Links are stored in `channel_verified_publisher` and recomputed from
  stored references.
- Who notices: no one yet; readers ship separately.
- Operator steps: none.
```
