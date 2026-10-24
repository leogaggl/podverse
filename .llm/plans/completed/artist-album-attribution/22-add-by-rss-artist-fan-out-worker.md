**Cursor model:** Opus 5.5 · **Reasoning:** high

# 22 — Adding an Add by RSS artist also parses the albums it lists

When the Add by RSS worker parses a publisher (artist) feed, it resolves every feed the artist
lists: albums already in the directory are linked, the rest are parsed for this member as their
own Add by RSS parses on the background queue, and the artist's parse entry returns the list
(R41, R42, R43). Credentials travel only to the artist feed's own domain (R54). Nothing is written
that another member or a public page sees (R40).

## Rows

R8, R19, R40, R41, R42, R43, R54

## Runs after

20, 21

## Files

apps/workers/src/lib/addByRSS/fanOutAddByRSSPublisherListedFeeds.ts
apps/workers/src/lib/addByRSS/fanOutAddByRSSPublisherListedFeeds.test.ts
apps/workers/src/commands/mq/rss/runAddByRSSParser.ts
apps/workers/src/lib/addByRSS/resolveAddByRSSMessageCredentials.ts
apps/workers/src/lib/addByRSS/resolveAddByRSSMessageCredentials.test.ts
apps/workers/src/lib/startup/categoriesForCommand.ts
apps/workers/src/lib/startup/categoriesForCommand.test.ts
packages/mq/src/types/mq.ts
packages/mq/src/functions/mq/rss/addByRSS.ts
packages/mq/src/functions/mq/rss/addByRSS.test.ts
apps/workers/ENV.md
docs/features/ADD-BY-RSS.md
.cursor/rules/add-by-rss-client-held-credentials.mdc
release-notes/scratchpad.md

## Reuses

- Plan 20: `getAddByRSSResourceTypeFromParsedFeed`, `addByRSSResourceTypeListsFeeds`,
  `collectAddByRSSPublisherListedFeedRefs`, `planAddByRSSPublisherListedFeeds` (all
  `@podverse/parser-mapping`), and `AddByRSSPublisherListedFeed` (`@podverse/helpers`).
- Plan 21: `ChannelAddByRSSDirectoryMatchService.getForListedFeeds` (`@podverse/orm`).
- `mqAddByRSSAdd` (`@podverse/mq`) and `MQ_QUEUES['add-by-rss-background']`. The background
  queue already has a consumer in every environment (`parser-add-by-rss-ondemand-background`
  deployment, `dev:workers:parsers` `abrss-bg`); nothing enqueues to it today.
- `sealAddByRssCredentials` (`@podverse/helpers-backend`, the primitive under the API's
  `sealAddByRssCredentialsForParse`) with `getAddByRSSConfig().credentialsEncryptionKey`.
- `resolveCredentialScope` (`@podverse/helpers`), the only scope check.
- `PodcastIndexService.podcastsBatchByFeedGuid` via `getPodcastIndexService()`
  (`apps/workers/src/factories/podcastIndexService.ts`); `apps/api/src/lib/remoteItems.ts` shows
  the response shape (`feeds[]` with `podcastGuid`, `url`).
- `processOpmlImport` already enqueues `mqAddByRSSAdd` from inside a consumer with
  `closeAfterSend: false`; follow that pattern for the shared `activeMQArtemisService`.

## Decisions this plan fixes

- **Each album is its own queue message on `add-by-rss-background`,** not fetched inline. An
  artist with dozens of albums (and the 5-second Wavlake delay in `parseRSSFeedForAddByRSS`) would
  otherwise hold the on-demand consumer for minutes and stall other members' adds. The artist's
  own parse returns as soon as its list is resolved.
- **Album messages send with dedupe off** (`dedupeCacheTimeMS: null`). Broker dedupe for Add by
  RSS keys on the feed URL alone (`resolveMqDedupeValue`), so with it on, a second member's artist
  listing the same album inside the window would drop that member's album message and leave its
  entry `queued` until it expires.
- **Album messages never fan out.** A message with `publisherRequestId` set parses its feed and
  stops, even if the feed is itself a publisher feed. No recursion across artists.
- **Credentials are re-sealed per album, in scope only.** The worker already holds the artist's
  opened credentials in memory. For each album URL where
  `resolveCredentialScope(artistFeedUrl, albumUrl, { allowInsecure })` is `send`, it seals a new
  envelope bound to that album's `accountId | requestId | feedUrl` with the same transit key and
  the standard 15-minute lifetime. Out-of-scope albums get no envelope; their message carries
  `credentialsWithheld` with the decision, so the album's entry reports `withheld_other_domain`
  (or `withheld_insecure`) and a private album there lands in the existing Needs username and
  password state.
- **Podcast Index fills missing album URLs, only for public artist feeds.** A channel-level
  reference with no `feedUrl`, not in the directory, and a UUID guid is looked up with one
  `podcastsBatchByFeedGuid` call. The lookup is skipped when the artist feed was fetched with
  credentials (`credentialsState === 'sent'`), so a private feed's references are never sent to a
  third party. A lookup failure is logged and those refs end as `no_feed_url`.
- **Fan-out happens only on a full parse** (`status: 'parsed'`). A `not_modified` artist result
  has no body to read, so it returns no list; the client keeps the list it stored.
- **A fan-out failure never fails the artist parse.** The artist entry is written `parsed`
  without `publisherListedFeeds`, and the error is logged with the feed host only.

## MQ message (`packages/mq`)

`packages/mq/src/types/mq.ts`, `MQAddByRSSMessage`, add after `credentialsEnvelope`:

```typescript
  /**
   * Set when a publisher (artist) feed's parse queued this feed: that parse's request id. A
   * message with it set never fans out to the feeds its own feed lists.
   */
  publisherRequestId?: string;
  /**
   * The publisher feed had credentials, but scope kept them from this feed's URL. The parse
   * records it as its credentials state.
   */
  credentialsWithheld?: Exclude<CredentialScopeDecision, 'send'>;
```

(`import type { CredentialScopeDecision } from '@podverse/helpers';`.) In
`packages/mq/src/functions/mq/rss/addByRSS.ts`, add both to `MQAddByRSSAddOptions` and copy them
onto the message only when defined, the way `credentialsEnvelope` is copied. The dedupe id is
unchanged (it already reads only `feedUrl`).

## Worker

### `apps/workers/src/lib/addByRSS/resolveAddByRSSMessageCredentials.ts`

Add an optional `credentialsWithheld?: Exclude<CredentialScopeDecision, 'send'>` input. When there
is no envelope and it is set, return `{ credentialsState: credentialsWithheld }` instead of
`not_provided`. With an envelope, it is ignored (the envelope path decides). Update the doc
comment.

### `apps/workers/src/lib/addByRSS/fanOutAddByRSSPublisherListedFeeds.ts` (new)

One exported function with injected dependencies, so the unit test needs no broker, database, or
Valkey (the style of `applyAddByRSSFollowMetadata.ts`):

```typescript
export type FanOutAddByRSSPublisherListedFeedsDeps = {
  findDirectoryChannels: (refs: readonly { feedGuid: string; feedUrl: string | null }[]) =>
    Promise<ReadonlyMap<string, AddByRSSDirectoryChannelMatch>>;
  lookUpFeedUrlsByGuid: (guids: string[]) => Promise<ReadonlyMap<string, string>>;
  setCacheEntry: (entry: AddByRSSParseCacheEntry) => Promise<void>;
  enqueue: (options: {
    accountId: number;
    feedUrl: string;
    requestId: string;
    publisherRequestId: string;
    credentialsEnvelope?: string;
    credentialsWithheld?: Exclude<CredentialScopeDecision, 'send'>;
  }) => Promise<void>;
  sealCredentials: (input: { accountId: number; requestId: string; feedUrl: string }) => string;
  newRequestId: () => string;
  now: () => Date;
  logWarn: (message: string, context: Record<string, unknown>) => void;
  logError: (message: string, error: unknown) => void;
};

export const fanOutAddByRSSPublisherListedFeeds = async (
  input: {
    accountId: number;
    requestId: string;
    feedUrl: string;
    parsedFeed: FeedObject;
    /** The publisher parse's credentials state (sent, not_provided, withheld_*). */
    credentialsState: AddByRSSParseCredentialsState;
    /** True when the publisher message's envelope opened (basicAuth was available). */
    hasCredentials: boolean;
    allowInsecure: boolean;
  },
  deps: FanOutAddByRSSPublisherListedFeedsDeps
): Promise<AddByRSSPublisherListedFeed[] | undefined>;
```

`sealCredentials` closes over the opened username and password in the caller, so the plaintext
never enters this module's inputs or logs. `AddByRSSParseCacheEntry` is the workers type from
`@workers/lib/addByRSSParseCache.js`.

Steps:

1. If `!addByRSSResourceTypeListsFeeds(getAddByRSSResourceTypeFromParsedFeed(parsedFeed))`,
   return `undefined`.
2. `collectAddByRSSPublisherListedFeedRefs(parsedFeed, feedUrl)`. When `droppedCount > 0`,
   `logWarn` with `{ requestId, feedHost, droppedCount }`.
3. `findDirectoryChannels(refs)`.
4. Guids to look up: refs with `listedAtChannelLevel`, `feedUrl === null`, no directory match,
   and `isValidReliableUUID(guid)`. Skip the call when the list is empty or
   `credentialsState === 'sent'`. On a thrown lookup, `logError` and use an empty map.
5. `planAddByRSSPublisherListedFeeds({ refs, directoryByFeedGuid, lookedUpFeedUrlByFeedGuid, newRequestId })`.
6. For each `feedsToParse` entry, in order:
   1. `setCacheEntry({ requestId, accountId, feedUrl, status: 'queued', publisherRequestId: input.requestId, updatedAt })`.
   2. Credentials: when `hasCredentials`, `decision = resolveCredentialScope(input.feedUrl, feedUrl, { allowInsecure })`.
      `send` → `credentialsEnvelope = sealCredentials({ accountId, requestId, feedUrl })`; any other
      decision → `credentialsWithheld = decision`. Without credentials, neither.
   3. `enqueue(...)`. If it throws: `logError` (host only in the message), then
      `setCacheEntry({ ..., status: 'failed', error: 'Could not queue this feed for parsing.', publisherRequestId, updatedAt })`.
7. Return `listedFeeds`.

Any throw from steps 2–5 propagates to the caller, which logs it (see below). Steps run before the
artist entry is written, so every `requestId` the client can read already has an entry.

Log context carries `feedHost` (use the existing `feedHostForLog` shape: move it from
`runAddByRSSParser.ts` into this module or a sibling file and import it in both), never a path,
query, userinfo, or credential.

### `apps/workers/src/commands/mq/rss/runAddByRSSParser.ts`

- Pass `credentialsWithheld: message.credentialsWithheld` into
  `resolveAddByRSSMessageCredentials`.
- In the `result?.status === 'parsed' || result?.status === 'not_modified'` branch, before the
  first `setAddByRSSParseCacheEntry`, when `result.status === 'parsed'` and
  `message.publisherRequestId === undefined`, call `fanOutAddByRSSPublisherListedFeeds` inside its
  own `try`/`catch`. On catch, `loggerService.logError('mqAddByRSSRunParser: publisher fan-out failed', error)`
  and continue with `publisherListedFeeds` undefined.
- Wire the deps:
  - `findDirectoryChannels`: `new ChannelAddByRSSDirectoryMatchService().getForListedFeeds(refs)`.
  - `lookUpFeedUrlsByGuid`: `getPodcastIndexService().podcastsBatchByFeedGuid(guids)`, then a map
    of `feed.podcastGuid.toLowerCase()` → `feed.url` for entries where both are non-empty strings.
  - `setCacheEntry`: `setAddByRSSParseCacheEntry`.
  - `enqueue`: `mqAddByRSSAdd(activeMQArtemisService, { ...MQ_QUEUES['add-by-rss-background'], dedupeCacheTimeMS: null, ...options, closeAfterSend: false })`.
  - `sealCredentials`: only when `resolvedCredentials.basicAuth` is set; it calls
    `sealAddByRssCredentials({ username, password, accountId, requestId, feedUrl }, addByRSSConfig.credentialsEncryptionKey)`.
    `hasCredentials` is `resolvedCredentials.basicAuth !== undefined`.
  - `newRequestId`: `randomUUID` from `node:crypto`. `now`: `() => new Date()`.
- Add to the parsed entry, only when defined: `publisherListedFeeds` and
  `publisherRequestId: message.publisherRequestId`. Add `publisherRequestId` to the failed-entry
  writes too (both the classified failure and the outer `catch`), so a failed album still says
  which artist parse it belongs to.
- The follow-row updates (`updateRequiresCredentials`, `applyAddByRSSFollowMetadata`) stay as they
  are for album messages. They are `UPDATE … WHERE account_id AND feed_url`, so they do nothing
  unless the member follows that album as its own Add by RSS feed, in which case they are right.

### `apps/workers/src/lib/startup/categoriesForCommand.ts`

`mqAddByRSSRunParser` now needs Podcast Index. Rename
`BASE_ORM_MQ_PARSER_KEYVALDB_COMMANDS` to `BASE_ORM_MQ_PARSER_KEYVALDB_PODCAST_INDEX_COMMANDS`
and add `categories.add(CATEGORY_PODCAST_INDEX)` in its branch. Both Add by RSS deployments
already mount `podverse-api.podcastindex.org-opaque` and the workers ConfigMap carries the other
`PODCAST_INDEX_*` keys (checked in `infra/k8s/base/workers/`); confirm `index.ts` initializes the
service when the category is present (it does for `CATEGORY_PODCAST_INDEX`). No env file changes.

## Docs and guidance

- `apps/workers/ENV.md`: move `mqAddByRSSRunParser` in the category table to a
  "Base + MQ + Parser + KeyValDB + PodcastIndex" row (or add `PodcastIndex` to its row), and add one
  sentence to the Add by RSS paragraph near line 88: an artist parse re-seals credentials for
  albums on the artist's own domain and queues each album on `add-by-rss-background`.
- `docs/features/ADD-BY-RSS.md`: add a `### Artist feeds` section after `### Parse path (transit
  envelope)` describing: which feeds fan out (Add by RSS type artists), directory albums linked
  not parsed, other albums parsed as their own requests on the background queue,
  `publisherListedFeeds` on the artist entry and `publisherRequestId` on each album entry, the
  100-feed cap, item-level-only references not fetched, Podcast Index URL lookup for public
  artist feeds only, `not_modified` returning no list, and credentials only to in-scope album
  URLs. In step 2 of the parse path, note the worker also seals envelopes for those albums.
- `.cursor/rules/add-by-rss-client-held-credentials.mdc`, in the "Put plaintext credentials on the
  message queue" bullet: after "The API seals them with `sealAddByRssCredentialsForParse` …",
  add that the Add by RSS worker re-seals an artist feed's credentials for each listed album on the
  artist's registrable domain, bound to that album message, and sends none to albums out of scope.

## Must stay true

- No plaintext credential on any queue message, cache entry, or log line. Each album envelope is
  bound to its own `requestId` and `feedUrl`, and only in-scope URLs get one.
- An album message never fans out.
- Nothing here enqueues a directory parse (`rss-on-demand`), creates feed, channel, follow, or
  pending-follow rows, or writes `channel_verified_publisher`. Add by RSS stays per-member.
- Every `add_by_rss` row's `requestId` has a cache entry before the artist entry is `parsed`.
- A failure anywhere in the fan-out leaves the artist parse `parsed`.
- Messages without the new fields behave exactly as today (OPML import, member adds, parse-all).

## Tests

- `apps/workers/src/lib/addByRSS/fanOutAddByRSSPublisherListedFeeds.test.ts` (Vitest, fake deps):
  - A non-artist feed returns `undefined` and calls no dep.
  - An artist listing a directory album and an Add by RSS album: one directory row, one
    `add_by_rss` row; one `queued` entry with `publisherRequestId`, written before the function
    returns; one enqueue with no envelope and no `credentialsWithheld` when `hasCredentials` is
    false.
  - With credentials, an album on the artist's domain is enqueued with the envelope
    `sealCredentials` returned for that album's request id and URL; an album on another domain is
    enqueued with `credentialsWithheld: 'withheld_other_domain'` and `sealCredentials` is not
    called for it.
  - A channel-level ref without a URL is looked up when `credentialsState` is `not_provided`, and
    not looked up when it is `sent` (row ends `no_feed_url`).
  - A thrown lookup still returns the list, with those rows `no_feed_url`.
  - An enqueue that throws leaves that album's entry `failed` and the other albums queued.
- `apps/workers/src/lib/addByRSS/resolveAddByRSSMessageCredentials.test.ts`: no envelope plus
  `credentialsWithheld: 'withheld_other_domain'` returns that state; an envelope ignores it.
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`: `mqAddByRSSRunParser` returns
  Base, ORM, MQ, Parser, KeyValDB, PodcastIndex.
- `packages/mq/src/functions/mq/rss/addByRSS.test.ts` (new; mock `ActiveMQArtemisService` with an
  object of `vi.fn`s): `publisherRequestId` and `credentialsWithheld` reach the sent message when
  given and are absent when not; `dedupeCacheTimeMS: null` is passed through.

## Release scratchpad

```markdown
## Adding an Add by RSS artist also parses its albums

- Surfaces: workers, api (parse status response), web and mobile once they read it
- Change: when an Add by RSS parse is an artist (publisher) feed, the worker resolves every feed
  the artist lists. Albums already in the Podverse directory come back as links to the directory
  album and are not fetched. Other albums are parsed for that member as their own Add by RSS
  parses on the `add-by-rss-background` queue. The artist's parse status gains
  `publisherListedFeeds` (directory links, album request ids, or why a listed feed was skipped),
  and each album's status gains `publisherRequestId`. At most 100 listed feeds per artist. Feeds
  named only by track-level references are not fetched. A listed album with no feed URL is looked
  up on Podcast Index, except for artist feeds fetched with credentials. Credentials go only to
  albums on the artist feed's own domain, re-sealed per album message; albums elsewhere are
  fetched without them and report the withheld state. Nothing is added to the public directory.
- Who notices: members who add an Add by RSS artist, once web and mobile show the albums
- Operator steps: the Add by RSS parser workers now validate Podcast Index env at startup (the
  k8s deployments already mount it; a custom deployment of `mqAddByRSSRunParser` must provide
  `PODCAST_INDEX_*`). The `add-by-rss-background` consumer must be running.
```
