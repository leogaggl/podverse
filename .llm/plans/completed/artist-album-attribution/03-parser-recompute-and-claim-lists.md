**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 03 — Recompute links on every parse, and map publisher claims as a list

The parser recomputes verified publisher links each time it stores a feed's channel tables, and
parser-mapping turns `<podcast:publisher>` into a list of claims instead of at most one.

## Rows

R13, R14, R15

## Runs after

02

## Files

packages/parser/src/lib/rss/channel/channelVerifiedPublisher.ts
packages/parser/src/lib/rss/channel/channelVerifiedPublisher.test.ts
packages/parser/src/lib/rss/channel/channel.ts
packages/parser-mapping/src/types/partytime.ts
packages/parser-mapping/src/compat/partytime/channel.ts
packages/parser-mapping/src/compat/partytime/channel.publisherClaims.test.ts
release-notes/scratchpad.md

## Reuses

- `ChannelVerifiedPublisherService.recomputeForChannel` from plan 02 (exported by `@podverse/orm`).
- `loggerService` from `@parser/factories/loggerService.js`, as the other `channel/*.ts` handlers
  use it.
- The existing `handleParsedChannelPublisher` and `ChannelPublisherRemoteItemService.updateMany`
  (plan 01 made it list-aware); no change to `channelPublisher.ts` here.

## Parser hook

### `packages/parser/src/lib/rss/channel/channelVerifiedPublisher.ts` (new)

```typescript
import { loggerService } from '@parser/factories/loggerService.js';

import type { Channel } from '@podverse/orm';
import { ChannelVerifiedPublisherService } from '@podverse/orm';

/**
 * Recomputes verified publisher links for the channel as a content feed and for every content
 * feed that names it as publisher. Runs after the channel tables commit, so it reads both feeds'
 * stored references. A failure is logged and parsing continues; the links are derived data, and
 * the next parse or the backfill command recomputes them.
 */
export const handleParsedChannelVerifiedPublisher = async (channel: Channel): Promise<void> => {
  try {
    const service = new ChannelVerifiedPublisherService();
    await service.recomputeForChannel(channel.id);
  } catch (error) {
    loggerService.logError(
      `handleParsedChannelVerifiedPublisher channel_id=${channel.id}`,
      error
    );
  }
};
```

`logError(message: string, error?: Error | unknown)` is the signature in
`packages/helpers-backend/src/logger.ts`; it takes no context object, so the channel id goes in the
message. Match the import grouping of `channelPublisher.ts`.

### `packages/parser/src/lib/rss/channel/channel.ts`

In `handleParsedChannel`, after `newRemoteItems` is computed (both the `shouldLogTimer` branch and
the transaction branch) and before `timerManager.end('handleParsedChannel')`:

```typescript
  await handleParsedChannelVerifiedPublisher(channel);
```

Import it beside the other `@parser/lib/rss/channel/*` imports, in alphabetical position (after
`channelValue.js`).

Why here and not in `parser.ts`: the four `parser.*.test.ts` files mock `handleParsedChannel`
wholesale, and the call must run after the channel-table transaction commits so the recompute's
own transaction reads this parse's claims and remote items. It runs before items are parsed and
before `handleNewRemoteItemNotifications` in `parser.ts`, so plan 04's verified check sees links
from this parse.

When the feed hash is unchanged, `handleParsedFeed` throws `FeedNoChangesSinceLastParsedError`
before `handleParsedChannel`, so no recompute runs. That is fine: nothing stored changed.

## Claims as a list (parser-mapping)

### `packages/parser-mapping/src/types/partytime.ts`

Change the `podcastPublisher` field of `FeedObject` to accept one claim or several:

```typescript
export type PodcastPublisherClaim = {
  feedGuid: string;
  feedUrl?: string;
  itemGuid?: string;
  title?: string;
  medium?: string;
};
```

and `podcastPublisher?: PodcastPublisherClaim | PodcastPublisherClaim[] | null;`. Partytime's own
type (`Phase7Publisher`, one object) still assigns to it, and a later partytime that returns an
array assigns too.

### `packages/parser-mapping/src/compat/partytime/channel.ts`

Rewrite `compatChannelPublisherRemoteItemDtos`:

- Normalize `parsedFeed.podcastPublisher` to an array: `null`/`undefined` gives `[]`, one object
  gives `[it]`, an array is used as is (use `Array.isArray`, no `as`).
- Map each entry with a `feedGuid` exactly as today (same `slice` limits, `isValidHttpUrl` check,
  `getMediumEnumValue`).
- Drop later entries whose `feed_guid` (lowercased) and `item_guid` equal an earlier one, so the
  first stays primary and the unique index from plan 01 never rejects a feed.
- Return the list in feed order, typed `RemoteItemDto[]`. Add `RemoteItemDto` to the existing
  `import type { DescriptionLengthTierEnum, PreparedDescription } from '@podverse/helpers';` line.

Do not touch `detectDuckTypedPublisherMediumId` in `publisher.ts` (the
`publisher-medium-and-namespace-draft` set owns it). `compatFull.ts` already carries
`publisherRemoteItems` from this function; leave it.

Area C reads publisher claims in parser-mapping too (for Add by RSS). This plan only changes the
shape of `compatChannelPublisherRemoteItemDtos` and the `podcastPublisher` type; if area C's plan
has already edited the same function when this runs, keep its changes and apply only the list
normalization and dedupe above.

## Must stay true

- A feed with one `<podcast:publisher>` stores exactly what it stored before (one claim, same
  fields).
- A recompute failure never fails the feed parse.
- No `as`, no `any`; strict equality.

## Tests

- `packages/parser-mapping/src/compat/partytime/channel.publisherClaims.test.ts` (Vitest; follow
  `channel.lastPubDate.test.ts` for building a minimal `FeedObject`):
  - No `podcastPublisher`: `[]`.
  - One object: one dto with the same fields as before.
  - An array of two different guids: two dtos in feed order.
  - An array repeating a guid with different case: one dto, the first.
  - An entry with no `feedGuid` is skipped.
- `packages/parser/src/lib/rss/channel/channelVerifiedPublisher.test.ts` (Vitest; mock
  `@podverse/orm` and `@parser/factories/loggerService.js` with `vi.mock`, the way the parser's
  other unit tests mock them):
  - Calls `recomputeForChannel` with the channel id.
  - When `recomputeForChannel` rejects, the handler resolves and logs once.

## Release scratchpad

```markdown
## Parser keeps verified publisher links current

- Surfaces: workers (parser)
- Change: after storing a feed's channel tables, the parser recomputes verified publisher links
  for that feed as a content feed and for every content feed that names it as publisher, so a
  reference dropped from either feed removes the link on that feed's next parse. A failed
  recompute is logged and does not fail the parse. `<podcast:publisher>` is now mapped as a list
  of claims (first is primary); feeds with one publisher store the same data as before.
- Who notices: no one directly; artist pages and players read the links once their changes ship.
- Operator steps: none. Feeds whose content has not changed are not reparsed; run the
  verified publisher backfill command once to fill links for existing feeds.
```
