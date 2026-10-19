# 03 — Follow conversion, archived 410, empty show deletion, seed

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Once per archived show, the server checks whether its feed still works. If it does, members who
follow the show get an Add-by-RSS follow in place of the directory follow. The episode list
tells clients a show is archived. Shows with no episodes left are then deleted, keeping the feed
row. This prompt also seeds the fixtures 04 and 05 test against.

Depends on 02. Decisions: 00-SUMMARY 6 through 8.

## Feed probe

The probe makes a network call, so it lives in workers, not the ORM:
`apps/workers/src/lib/archive/feedProbe.ts`.

```ts
export type FeedProbe = (url: string) => Promise<boolean>;
export const probeFeedUrl: FeedProbe;
```

Use `fetchWithTimeout` from `@podverse/helpers-backend`: GET, 10-second timeout, the workers
user agent. Success means a 2xx and the first 64 KB of the body contains `<rss` or `<feed`,
case-insensitive. If `fetchWithTimeout` cannot stop reading at a byte limit, add an optional
`maxBodyBytes` to it, with a unit test. Never call `fetch` directly (AGENTS.md). Any thrown
error means false.

`ArchiverService.archiveAll` takes `{ feedProbe: FeedProbe }`. The workers `archiveAll`
command passes `probeFeedUrl`. Update every caller and test.

## Conversion — `packages/orm/src/services/archivedFollowConversion.ts`

```ts
export const FOLLOW_CONVERSION_MAX_CHANNELS_PER_RUN = 100;
export const FOLLOW_CONVERSION_MAX_ATTEMPTS = 3;
export const FOLLOW_CONVERSION_RETRY_HOURS = 24;

export async function convertArchivedShowFollows(probe: FeedProbe): Promise<{
  converted: number;
  followsMoved: number;
  unreachable: number;
  skipped: number;
}>;
```

Select up to 100 channels where the feed lifecycle is `archived`, `follow_conversion_status`
is null, and `follow_conversion_last_attempt_at` is null or older than 24 hours. For each:

1. If a `channel_merge` row has it as `from_channel_id`, or the feed URL is empty, set
   `skipped`.
2. If no `account_following_channel` rows exist, set `no_followers`.
3. Otherwise, probe the feed URL once.
   - **False:** increment `follow_conversion_attempts` and set the last attempt time. At 3
     attempts, set `unreachable`.
   - **True:** load the followers' accounts with the fields `deriveMembershipState` needs.
     For each follower where `evaluateFeatureAccess('add_by_rss_add', state).allowed`, in one
     transaction:
     - insert into `account_following_add_by_rss_channel` with the canonical feed URL, the
       channel title, the first channel image URL, and `requires_credentials` false. Skip it if
       the row exists (`ON CONFLICT DO NOTHING` is fine in runtime SQL);
     - delete that follower's `account_following_channel` row.

     Use the same URL normalizer the Add-by-RSS follow endpoint uses; find it from
     `reqAccountFollowAddByRSSChannel`'s server handler. Set `converted`, even when no follower
     was eligible.

Followers who are not eligible keep the directory follow. It cascades when the show is deleted.

## Empty show deletion — `packages/orm/src/services/archivedChannelCleanup.ts`

```ts
export const EMPTY_SHOW_DELETE_MAX_PER_RUN = 200;
export async function deleteEmptyRemovedShows(): Promise<{ deleted: number }>;
```

Select up to 200 channel ids where:

- the feed lifecycle is `takedown`, or `archived` with `follow_conversion_status` not null;
- `NOT EXISTS` any `item` with that `channel_id`;
- `NOT EXISTS` a `channel_merge` row with it as `from_channel_id` or `to_channel_id`.

Then run `DELETE FROM channel WHERE id = ANY($1)`. Follows, notification settings,
auto-download rows, stats, and any remaining related rows cascade. The `feed` row stays.

Management must still find a feed whose channel was deleted, so it can restore it. Read
`apps/management-api/src/lib/feed/feedFlagStatusAppDb.ts`. Where the feed list or lookup
inner-joins `channel`, make it a left join and show the feed URL where a channel title would
be. A restored feed reparses, and the parser creates a new channel (`getOrCreateByFeed`).

## `archiveAll` order

```ts
await this.processPendingArchiveFeeds();
await this.processSpamFeeds();
await this.processPendingArchiveItems();
await this.deleteArchivedItemsWithoutClipOrPlaylist();
await slimArchivedItems();
await slimArchivedChannels();
await convertArchivedShowFollows(options.feedProbe);
await this.removeAllItemsForTakedownFeeds();
await deleteEmptyRemovedShows();
await pruneNonActiveItemBackedQueueResourceRows();
```

Log each count at info level.

## Archived 410 on the episode list

Find the API endpoints behind mobile `channelItemsRepository.syncChannel` and `extendWindow`,
and the web channel page's episode list. After the existing merge redirect check, read the
channel's feed lifecycle:

- `archived`: 410 `{ message: 'Show is no longer in the directory', gone: { reason:
  'archived', add_by_rss_feed_url } }`. `add_by_rss_feed_url` is the feed URL only when the
  signed-in requester has an `account_following_add_by_rss_channel` row for it; otherwise null.
- `takedown`: 404, the same body as a missing channel.

Do not change channel detail or item detail. Add a shared `DTOChannelGone` type in helpers for
the 410 body. Update `apps/api/openapi.yml` for these endpoints.

## Seed — `tools/web/seed-e2e.mjs`

Fixed `id_text` values (**e2e-seed-nano-id-limits**), exported from
`apps/web/e2e/helpers/seedConstants.ts` and `apps/mobile/src/lib/e2e/e2eSeedConstants.ts`:

- **E2E Removed Clip**: owned by the seeded E2E user. `item_id` null, `removed_source` with
  `item_title` **E2E Removed Episode** and `channel_title` **E2E Removed Show**,
  `source_removed_at` set.
- **E2E Removed Playlist**: owned by the E2E user. Two entries: a seeded Active episode, and a
  removed entry with the same snapshot.
- **E2E Archived Show**: a channel whose feed lifecycle is `archived`, with About and an image,
  no Active episodes, and `follow_conversion_status` `converted`. The E2E user follows it.

## Tests — `apps/api/src/test/archived-follow-conversion.integration.test.ts`

Stub the probe.

- An archived show followed by a member and a non-member, with the probe true: the member has
  an Add-by-RSS follow and no directory follow; the non-member keeps the directory follow; the
  status is `converted`.
- With the probe false, three runs with the last attempt time moved back: `unreachable` after
  the third run, never sooner than 24 hours apart.
- A merge-source show is `skipped` and never probed.
- Episode list: 410 archived, with `add_by_rss_feed_url` only for the converted member; 404 for
  takedown; the merge 410 wins over archived.
- `deleteEmptyRemovedShows` deletes an empty converted archived show, keeps the feed row, and
  removes the remaining follow. It skips a show with an archived episode, a show still awaiting
  conversion, and a show in `channel_merge`.
- The management feed lookup still finds the feed after its channel is deleted.

## Scratchpad

```markdown
## Archived shows move members to Add by RSS; empty shows are deleted

- Surfaces: workers (archiveAll), api, management-api, orm
- Change: When a show is archived and its RSS feed still responds, members who follow it get an
  Add-by-RSS follow in place of the directory follow. The episode list for an archived show
  returns 410 with reason archived (404 for takedown). Archived or taken-down shows with no
  episodes left are deleted; the feed row stays, so management can still restore it.
- Who notices: members following shows that leave the directory; API clients of the episode
  list
- Operator steps: none; the next archiveAll processes up to 100 archived shows per run
```

## Done when

- No takedown or merge show is ever converted.
- No channel with an `item` row or a merge row is deleted.
- Comments must not cite this plan or any plan number.

## Operator verification

**Root** — needs `make test_deps`.

```bash
npm run build:packages
npm run test -w packages/helpers-backend
npm run test -w packages/orm
npm run test -w apps/api
npm run test -w apps/management-api
npm run build -w apps/workers
npm run test -w apps/workers
make e2e_seed
```
