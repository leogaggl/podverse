**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 21 — Find directory channels for the feeds an Add by RSS artist lists

A read-only ORM lookup: given the feeds an Add by RSS publisher feed lists (guid plus optional
URL), return the directory channels they already are. Plan 22 (worker) and plan 23 (API E2E
fixture) use it so an album already in the directory is linked instead of parsed again (R43).
It reads directory data only and writes nothing (R40).

## Rows

R40, R43

## Runs after

none

## Files

packages/orm/src/services/channel/channelAddByRSSDirectoryMatch.ts
packages/orm/src/index.ts
apps/api/src/test/channel-add-by-rss-directory-match.integration.test.ts

## Reuses

- `isValidReliableUUID` from `@podverse/helpers` (`packages/helpers/src/lib/guid.ts`), the check
  `filterInvalidFeedUuids` uses. `channel.podcast_guid` is a `uuid` column, so a non-UUID string
  in the query would be a Postgres error.
- `deriveHttpsAndHttpUrlsFromInput` from `packages/orm/src/services/feed/feed.helpers.js`, the
  helper `FeedService.getByUrl` uses to try both schemes.
- The directory visibility rule `ChannelService.getMany` applies: `channel_about` exists (the
  channel has been parsed) and `feed.feed_policy.public_visible` is true.
- `FeedLifecycleStateKeyEnum` from `@orm/entities/feed/feedLifecycleStateType.js`. A feed with no
  `feed_lifecycle_state` row counts as `Active`, as in `FeedLifecycleStateService`.

## `packages/orm/src/services/channel/channelAddByRSSDirectoryMatch.ts` (new)

```typescript
export type AddByRSSListedFeedLookupRef = {
  feedGuid: string;
  feedUrl: string | null;
};

export type AddByRSSDirectoryChannelMatchRow = {
  channelIdText: string;
  title: string | null;
  mediumId: number | null;
};

export class ChannelAddByRSSDirectoryMatchService {
  /**
   * Directory channels for feeds an Add by RSS publisher feed lists, keyed by the ref's lowercased
   * guid. Only parsed, publicly visible channels whose feed is active or pending archive match.
   * A guid match wins; otherwise a feed URL match counts when the channel has no guid or the same
   * guid. Reads only.
   */
  async getForListedFeeds(
    refs: readonly AddByRSSListedFeedLookupRef[]
  ): Promise<Map<string, AddByRSSDirectoryChannelMatchRow>>;
}
```

The row shape is structurally the same as `AddByRSSDirectoryChannelMatch` in
`@podverse/parser-mapping` (plan 20). Do not import parser-mapping into the ORM; callers pass the
map straight through.

Use `AppDataSourceRead.getRepository(Channel)` (import as the other channel services do). Steps:

1. Empty `refs` → return an empty map with no query.
2. **By guid.** `guids` = distinct `ref.feedGuid.trim().toLowerCase()` that pass
   `isValidReliableUUID`. When non-empty, `find` channels with:
   - `where: { podcast_guid: In(guids), channel_about: { id: Not(IsNull()) }, feed: { feed_policy: { public_visible: true } } }`
   - `relations: { feed: { feed_lifecycle_state: { feed_lifecycle_state_type: true } } }`
   - `select` is not needed; keep the default.
   Keep channels whose lifecycle is allowed (step 4). For each, set
   `map.set(channel.podcast_guid.toLowerCase(), row)` when `podcast_guid` is a string.
3. **By feed URL**, for refs whose lowercased guid is not yet in the map and whose `feedUrl` is a
   non-empty string. For each such ref, `deriveHttpsAndHttpUrlsFromInput(ref.feedUrl)` gives
   `{ httpsUrl, httpUrl }`; collect every variant into one list (deduped). When non-empty, one
   `find` with `where: { feed: { url: In(variants), feed_policy: { public_visible: true } }, channel_about: { id: Not(IsNull()) } }`
   and the same `relations`. Then, per ref in input order, take the first returned channel (by
   ascending `id`) whose `feed.url` is one of that ref's two variants, whose lifecycle is
   allowed, and whose `podcast_guid` is null or equals the ref's guid case-insensitively. Set it
   under the ref's lowercased guid.
4. **Lifecycle allowed:** `channel.feed?.feed_lifecycle_state?.feed_lifecycle_state_type?.state_key`
   is undefined/null, `FeedLifecycleStateKeyEnum.Active`, or
   `FeedLifecycleStateKeyEnum.PendingArchive`.
5. Row: `{ channelIdText: channel.id_text, title: channel.title, mediumId: channel.medium_id }`
   (`title` is `string | null` and `medium_id` is `number` on the entity).

Before writing the relation names, open `packages/orm/src/entities/feed/feed.ts`
(`feed_lifecycle_state`, `feed_policy`) and
`packages/orm/src/entities/feed/feedLifecycleState.ts` (`feed_lifecycle_state_type`) and use the
names as they are there. Read through optional chaining; no `as`.

Two queries at most per call. The caller caps refs at 100 (plan 20), so `In` lists stay small.

## `packages/orm/src/index.ts`

Add `export * from './services/channel/channelAddByRSSDirectoryMatch.js';` beside the other
`./services/channel/*` service exports, in alphabetical position. Plans 01 and 02 also add lines to
this file; keep theirs.

## Must stay true

- The service never writes. Add by RSS content does not create, follow, or alter a directory row.
- A non-UUID guid never reaches SQL.
- A channel that is hidden (`public_visible` false), unparsed (no `channel_about`), archived,
  merged, or taken down never matches.

## Tests

`apps/api/src/test/channel-add-by-rss-directory-match.integration.test.ts` (new; real database,
same harness as `channel-merge.integration.test.ts`: `startTestApp`, seed rows with repositories
or `manager.query`, unique guids and URLs per run via `randomUUID()`, clean up in `afterAll`).
One `it` each:

- A visible, parsed channel matches by guid, and the key is the lowercased guid when the ref's
  guid is upper case.
- A ref whose guid is not a UUID matches by its feed URL, and an `http://` ref URL matches a
  feed stored as `https://`.
- A URL match is refused when the channel's own guid differs from the ref's.
- A channel with `public_visible` false, one with no `channel_about`, and one whose lifecycle is
  `archived` do not match.
- An empty input returns an empty map.

## Release scratchpad

none
