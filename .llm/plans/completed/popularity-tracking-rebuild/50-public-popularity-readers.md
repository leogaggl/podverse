**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 50 — Public range sorts read the range totals

Move every public "Top" list (channels, items and live items, clips, playlists, profiles) off the
`stats_aggregated_*` tables and onto the `stats_popularity_*` range totals that plan 10 creates and
area D's job rebuilds from the daily totals. The API contract does not change: the same routes,
the same `range` values (`day`, `week`, `month`, `all-time`), the same response shapes. No web or
mobile change.

The old `StatsAggregated*Service` classes stay in the tree (the old write path and worker still use
them until their own plans land); plan 19 deletes them. After this plan, no file under `apps/api`
references a `StatsAggregated*` symbol.

## Rows

R27

## Runs after

10, 11

## Files

- `packages/orm/src/services/stats/popularity/statsPopularityChannel.ts` (new)
- `packages/orm/src/services/stats/popularity/statsPopularityItem.ts` (new)
- `packages/orm/src/services/stats/popularity/statsPopularityClip.ts` (new)
- `packages/orm/src/services/stats/popularity/statsPopularityPlaylist.ts` (new)
- `packages/orm/src/services/stats/popularity/statsPopularityAccount.ts` (new)
- `packages/orm/src/index.ts`
- `packages/orm/src/services/item/item.ts`
- `packages/helpers-requests/src/api/queryParams.ts`
- `apps/api/src/lib/stats.ts`
- `apps/api/src/lib/stats.test.ts` (new)
- `apps/api/src/controllers/channel.ts`
- `apps/api/src/controllers/item.ts`
- `apps/api/src/controllers/clip.ts`
- `apps/api/src/controllers/playlist/playlist.ts`
- `apps/api/src/controllers/account/account.ts`
- `apps/api/src/test/category-channel-item-read.test.ts`
- `apps/api/src/test/clip.test.ts`
- `apps/api/src/test/playlist.test.ts`
- `apps/api/src/test/account-follows-notifications.test.ts`
- `apps/api/src/test/stats-popularity-readers.integration.test.ts` (new)
- `docs/features/POPULARITY-TRACKING.md`

## How R27 is met, and why it stays fast

- "Any window is a sum": each window total in `stats_popularity_*` is the sum of `listener_count`
  over the daily rows in that window, computed by area D's refresh job (plan 10 § "Range totals
  are rebuilt by a job"). Nothing is a rolling counter that can miss a day.
- "Existing range sorts read from it": the four ranges map to the four columns through
  `STATS_POPULARITY_COUNT_FIELDS` (`@podverse/helpers`, plan 11).
- Speed: a request never sums daily rows. It reads one small row per entity from the type's
  `stats_popularity_*` table, ordered by that range's index
  `stats_popularity_<type>_<range>_count_idx (<range>_count DESC, <type>_id)`. That is the same
  shape as the old tables (one row per entity, one index per range column), so list cost does not
  change. How fresh the totals are is set by how often area D's job runs.

## Reuse

Each new service is a port of the read methods of the matching
`packages/orm/src/services/stats/statsAggregated<Type>.ts`, with the same method names, arguments,
and filters, so controllers and their test mocks change only the class name. Do not port the write
methods (`updateAggregatedStats`, `updateAggregatedStatsRolling`, `upsertCounts`) or the base
class; the new services extend nothing.

## ORM services — `packages/orm/src/services/stats/popularity/`

Shared shape for all five files:

- Import the entity from `@orm/entities/stats/statsPopularity<Type>.js` (plan 11) and
  `AppDataSourceRead` from `@orm/db/index.js`.
- `private repositoryRead = AppDataSourceRead.getRepository(StatsPopularity<Type>);` — these are
  read-only services; no read-write repository.
- One short class doc comment: "Reads the range totals behind public Top lists. Rows are rebuilt
  from the daily totals by the popularity refresh job; see `docs/features/POPULARITY-TRACKING.md`."
- `StatsPopularityCountField` (type import from `@podverse/helpers`) replaces every
  `StatsAggregatedRangeCountField`.
- The key column differs per type: `channel_id`, `item_id`, `clip_id`, `playlist_id`,
  `account_id`. There is no surrogate `id` column.

### `statsPopularityChannel.ts` — `StatsPopularityChannelService`

Port from `statsAggregatedChannel.ts`: `StatsPopularityListOptions` (rename of
`StatsAggregatedListOptions`, same fields with `minCountField?: StatsPopularityCountField`), the
private `mergeWhere` and `buildWhere`, and the public `getMany`, `countRanked`,
`getRankedChannelIds`. In `getRankedChannelIds`, select `{ channel_id: true }` only (the old code
also selected `id`, which does not exist here). Do not port `getManyByChannelsAndCount`; nothing
calls it.

### `statsPopularityItem.ts` — `StatsPopularityItemService`

Port from `statsAggregatedItem.ts`: `StatsPopularityItemListOptions`, the private
`buildListWhere`, and the public `getMany`, `countRanked`, `getRankedItemIds`. In
`getRankedItemIds`, select `{ item_id: true }` only. Do not port `getManyByChannelsAndCount`;
nothing calls it. Keep the existing imports it needs (`getLiveItemStatusEnumValue`,
`getActiveFeedWhere`, `buildEndedLiveItemTimeVariants`, `LiveItem` type).

### `statsPopularityClip.ts` — `StatsPopularityClipService`

Port all four read methods from `statsAggregatedClip.ts` unchanged except the entity:
`getManyPublic`, `getManyAndCountPublic`, `getManyByChannelsAndCountPublic`,
`getManyByItemAndCountPublic`.

### `statsPopularityPlaylist.ts` — `StatsPopularityPlaylistService`

Port `getManyPublic`, `getManyPrivate`, `getManyPrivateByPlaylists` from
`statsAggregatedPlaylist.ts`. Their `select` blocks spread `STATS_AGGREGATED_SELECT_ALL`; replace
that with a module-level constant in this file:

```typescript
const STATS_POPULARITY_SELECT_ALL = {
  playlist_id: true,
  day_count: true,
  week_count: true,
  month_count: true,
  all_time_count: true,
};
```

Do not port `getMany` or `getManyCount`; nothing calls them.

### `statsPopularityAccount.ts` — `StatsPopularityAccountService`

Port `getMany` and `getManyByAccountsAndCount` from `statsAggregatedAccount.ts`, with the relation
renamed: the new entity's key is `account_id` with relation `account` (the profile that was
opened), not `tracked_account_id` / `tracked_account`.

- `profileWhere` becomes `{ account: { sharable_status: { id: In(ids) }, account_profile: { display_name: Not(IsNull()) } } }`.
- In `getManyByAccountsAndCount`, `tracked_account_id: In(account_ids)` becomes
  `account_id: In(account_ids)`.

### Exports — `packages/orm/src/index.ts`

After the existing `export * from './services/stats/statsTrackEventPlaylist.js';` line, add the
five new files, alphabetically:

```typescript
export * from './services/stats/popularity/statsPopularityAccount.js';
export * from './services/stats/popularity/statsPopularityChannel.js';
export * from './services/stats/popularity/statsPopularityClip.js';
export * from './services/stats/popularity/statsPopularityItem.js';
export * from './services/stats/popularity/statsPopularityPlaylist.js';
```

Plan 11 already exports the `statsPopularity*` entities; do not add them again.

## `packages/orm/src/services/item/item.ts` (large file)

Anchors: the type import on line 8 and the two constants `subItemGetManyRelations` and
`subItemGetManyRelationsWithChannel` (around lines 1048–1075).

- Replace `import type { StatsAggregatedItem } from '@orm/entities/stats/statsAggregatedItem.js';`
  with `import type { StatsPopularityItem } from '@orm/entities/stats/statsPopularityItem.js';`.
- Retype both constants and their `findOptionsRelationsFromPaths` /
  `mergeFindOptionsRelations` generics from `StatsAggregatedItem` to `StatsPopularityItem`. The
  relation paths (`item`, `item.item_about`, …, `item.channel.channel_images`) stay the same.

No other edit in this file.

## `apps/api/src/lib/stats.ts`

Replace the switch with the shared map:

```typescript
import type { StatsPopularityCountField } from '@podverse/helpers';
import { STATS_POPULARITY_COUNT_FIELDS } from '@podverse/helpers';
import type { QueryParamsStatsRange } from '@podverse/helpers-requests';

export const getStatsOrder = (range?: QueryParamsStatsRange): StatsPopularityCountField =>
  STATS_POPULARITY_COUNT_FIELDS[range ?? 'day'];
```

Every route validates `range` as required, so the `day` fallback only satisfies the optional
parameter type.

## Controllers

In every controller below:

- Swap the type import `StatsAggregated<Type>` for `StatsPopularity<Type>` and the class
  `StatsAggregated<Type>Service` for `StatsPopularity<Type>Service` (both from `@podverse/orm`).
- Rename the static field `statsAggregated<Type>Service` to `statsPopularity<Type>Service`.
- Every stats `order` gains a tie-break on the key column so pages do not repeat or skip entities
  with equal counts, matching the range index order: `order: { [order]: 'DESC', <key>: 'ASC' }`
  (`channel_id`, `item_id`, `clip_id`, `playlist_id`, or `account_id`). Keep the variable name each
  call site already uses (`order` or `orderField`).

Per file:

- `apps/api/src/controllers/channel.ts`: `loadFilledTopChannels` and its `orderField` parameter
  type (`StatsAggregatedRangeCountField` → `StatsPopularityCountField`, type import from
  `@podverse/helpers`); `topConfig` in `loadStatsPage`.
- `apps/api/src/controllers/item.ts`: `loadFilledTopItems` and its `orderField` parameter type;
  `config` in `loadStatsPage`.
- `apps/api/src/controllers/clip.ts`: the three relation constants `statsAggregationRelations`,
  `statsAggregationChannelRelations`, `statsAggregationItemRelations` become
  `statsPopularityRelations`, `statsPopularityChannelRelations`, `statsPopularityItemRelations`,
  typed on `StatsPopularityClip` (paths unchanged); the five `getStatsOrder` call sites
  (`getManyPublicTop`, `getManyByCategoryPublicTop`, `getManyByChannelPublicTop`,
  `getManyByItemPublicTop`, `getManySubscribedPublicTop`).
- `apps/api/src/controllers/playlist/playlist.ts`: `getManyPublicTop`, `getManyPrivateTop`,
  `getManyFollowedPrivateTop`.
- `apps/api/src/controllers/account/account.ts`:
  - `trackedAccountProfileRelations` becomes `popularityAccountProfileRelations` with paths
    `'account'`, `'account.account_profile'`, `'account.sharable_status'`.
  - `statsTrackedAccountRelations` becomes `statsPopularityAccountRelations`, typed on
    `StatsPopularityAccount`.
  - In `getManyPublicTop` and `getManySubscribedTop`, map `(s: { account: Account }) => s.account`.

## `packages/helpers-requests/src/api/queryParams.ts`

Delete `STATS_SORT_COLUMNS` and `StatsSortColumn` (the `// Stats` block keeps
`QUERY_PARAMS_STATS_RANGE_VALUES` and `QueryParamsStatsRange`). Nothing imports them and they name
the old columns. Before deleting, grep the tree (excluding `node_modules`, `dist`, `.llm/`) for
both names; if anything outside this file uses them, leave them and say so in your final message.

## Doc — `docs/features/POPULARITY-TRACKING.md`

Add a short section `## Public range sorts`, after the range-totals contract section plan 10
wrote:

- Top lists for channels, items and live items, clips, playlists, and profiles read the
  `stats_popularity_*` table for their type through `StatsPopularity<Type>Service`.
- `range` maps to a column through `STATS_POPULARITY_COUNT_FIELDS`; ties order by the entity id.
- Channel and item Top lists include only entities whose count for the chosen range is above zero
  and pad a short page with recent entities (`fillTopPage` in `@podverse/helpers`). Clip,
  playlist, and profile Top lists list every row and do not pad.
- Requests never sum daily rows; freshness follows the refresh job's schedule.

Present tense, no plan numbers.

## Tests

- `apps/api/src/lib/stats.test.ts` (new, vitest): `getStatsOrder` returns `day_count`,
  `week_count`, `month_count`, `all_time_count` for the four ranges and `day_count` for
  `undefined`.
- Mocked route tests: rename the mocked classes and the `vi.mock` keys to the new service names,
  keeping the existing mock functions and cases.
  - `category-channel-item-read.test.ts`: `StatsAggregatedChannelService` →
    `StatsPopularityChannelService`, `StatsAggregatedItemService` → `StatsPopularityItemService`.
    Drop the `getManyByChannelsAndCount` members from both mock classes.
  - `clip.test.ts`: `StatsAggregatedClipService` → `StatsPopularityClipService`.
  - `playlist.test.ts`: `StatsAggregatedPlaylistService` → `StatsPopularityPlaylistService`.
  - `account-follows-notifications.test.ts`: `StatsAggregatedAccountService` →
    `StatsPopularityAccountService`. Any mocked row shaped `{ tracked_account: … }` becomes
    `{ account: … }`.
  - Rename the mock variables that carry the old name (`statsAggregatedClip…Mock`,
    `statsAggregatedGetManyMock`, …) to the matching `statsPopularity…` names.
- `apps/api/src/test/stats-popularity-readers.integration.test.ts` (new, DB-backed). Follow
  `channel-merge.integration.test.ts` for setup (`startTestApp`, read-write manager, run-id
  suffixes so reruns do not collide) and call the ORM services directly. Seed a channel so it
  passes `getActiveFeedWhere`: a `feed`, a `feed_policy` row with `public_visible = true`, a
  `channel` (any medium; the service calls pass `mediumType: null` and `category_id: null`), and a
  `channel_about` row. Cases:
  1. Three seeded channels with `stats_popularity_channel` rows `week_count` 5, 5, 0:
     `StatsPopularityChannelService.getMany` with `order: { week_count: 'DESC', channel_id: 'ASC' }`
     and `minCountField: 'week_count'`, scoped by `channelIds` to the seeded ids, returns the two
     non-zero channels in id order; `countRanked` returns 2; `getRankedChannelIds` returns both ids.
  1. A channel with a popularity row but no `channel_about` row is left out.
  1. An item on a seeded channel with a `stats_popularity_item` row is returned by
     `StatsPopularityItemService.getMany` (`itemType: 'normal'`) with its `item` relation loaded.
  1. Two accounts with public `sharable_status_id` and a non-null `account_profile.display_name`,
     plus `stats_popularity_account` rows: `StatsPopularityAccountService.getManyByAccountsAndCount`
     with `'global'` returns them ordered by `all_time_count` with the `account.account_profile`
     relation loaded, and count 2.
  Delete what the test seeds in `afterAll`.

No OpenAPI change: routes, parameters, and response shapes are unchanged. No Playwright or Maestro
change: no client changes, and no E2E seed writes stats rows.

## Release scratchpad

```markdown
## Top lists read the new popularity totals

- Surfaces: api
- Change: every Top sort (podcasts and other channels, episodes and live items, clips, playlists,
  profiles; global, category, subscribed, and per-channel or per-item) reads range totals rebuilt
  from anonymous daily listener counts instead of the old rolling count columns. Day covers today
  and yesterday (UTC), week today plus the previous 7 days, month today plus the previous 30, and
  all time every counted day. Entities with equal counts now come back in a stable order, so
  paging no longer repeats or skips them. Routes, parameters, and responses are unchanged.
- Who notices: listeners using Top sorts; lists are empty or padded with recent items until new
  listens are counted
- Operator steps: none beyond running the popularity refresh job that fills the totals
```
