# 81 — Upcoming livestreams endpoint (live first, then scheduled)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Rows

- **R52** (server half): one list of livestream items, live now first, then scheduled, and no
  ended items. The web and mobile chips (plans 83–86) read only this endpoint.

Runs after plan 80 (the seed's scheduled item). Plans 83, 85, and 86 call the request helper.

## Parity source

`ItemController.getManySubscribedRecent` (auth, followed channels, paging, response shape) and
`ItemService.getMany` / `getManyByChannels` (the channel and flag-status filters). Today's
`/live-item/*` routes keep working; nothing on them changes.

## Locked decisions

1. **Routes.** `GET /live-item/global/upcoming` (public) and `GET /live-item/subscribed/upcoming`
   (signed in). Query: `medium` and `page` only (`mediumPageQuerySchema`). No `liveItemType`,
   sort, range, or category.
2. **Status filter.** `live_item_status_id IN (Live, Pending)`. Ended items never appear,
   however recent.
3. **Order.** `live_item_status_id DESC` (Live is 2, Pending is 1), then `start_time ASC` (the
   next scheduled first, and the longest-running live first), then `item.id ASC` for a stable
   page boundary.
4. **Global channel filter.** As `getMany`: `channel_about` not null, the feed's
   `feed_policy.public_visible` true, and the medium filter (`'all'` means none).
5. **Subscribed channel filter.** As `getManyByChannels`: `getFollowedChannelIds(account_id,
medium)`, then `id In(ids)` with `channel_about` not null. No follows → the empty list
   response. Auth uses `{ skipMembershipStatus: true }`, as the other subscribed lists do.
6. **Response.** `ApiListResponse<DTOItem>` with `meta: { page, count: null, limit }`, relations
   `itemGetManyRelationsWithChannel` (rows need `channel` and `live_item`).
7. **Shared comparator.** Clients merge Add by RSS live items into this list (plans 84 and 86).
   `@podverse/helpers` gets one comparator with the same order, so every surface sorts alike.

## Files

| Path                                                     | Change                     |
| -------------------------------------------------------- | -------------------------- |
| `packages/helpers/src/lib/liveItemVisibility.ts`         | Status check, comparator   |
| `packages/helpers/src/lib/liveItemVisibility.test.ts`    | Cases                      |
| `packages/orm/src/services/item/item.ts`                 | `getManyUpcomingLiveItems` |
| `apps/api/src/controllers/liveItem.ts`                   | Two handlers               |
| `apps/api/src/routes/liveItem.ts`                        | Two routes                 |
| `apps/api/openapi.yml`                                   | Two paths                  |
| `apps/api/src/test/category-channel-item-read.test.ts`   | Cases and the mock         |
| `packages/helpers-requests/src/api/liveItem/liveItem.ts` | Request helper             |
| `packages/helpers-requests/src/api/_request.ts`          | Service method             |

## Implementation

### Helpers — `liveItemVisibility.ts`

Already exported from `packages/helpers/src/index.ts` (line 92). Add beside
`isLiveItemEndedAndStale`:

```typescript
export type UpcomingLiveItemSortKey = {
  statusId: LiveItemStatusEnum | null | undefined;
  startTimeMs: number | null;
};

/** On the air now or scheduled; ended items are not upcoming. */
export const isUpcomingLiveItemStatus = (
  statusId: LiveItemStatusEnum | null | undefined
): boolean => statusId === LiveItemStatusEnum.Live || statusId === LiveItemStatusEnum.Pending;

/**
 * The upcoming-livestreams order: live before scheduled; within each, the earliest start first,
 * and no start time after every dated one. Matches `ItemService.getManyUpcomingLiveItems`.
 */
export const compareUpcomingLiveItems = (
  a: UpcomingLiveItemSortKey,
  b: UpcomingLiveItemSortKey
): number => { … };
```

Rank: Live 0, Pending 1, anything else 2. Equal rank → compare `startTimeMs` ascending with
`null` last; both null → 0 (callers use `Array.prototype.sort`, which is stable).

### ORM — `ItemService.getManyUpcomingLiveItems`

Place after `getManyByChannels` (lines 866–921). Same imports that file already uses.

```typescript
/**
 * Live and scheduled live items, live first. `channelIds` null lists public channels;
 * an empty array lists nothing.
 */
async getManyUpcomingLiveItems(
  config: FindManyOptions<Item>,
  params: { channelIds: number[] | null; mediumType: QueryParamsMedium | null }
): Promise<Item[]>
```

- `channelIds` is `[]` → return `[]`.
- `channelWhere`: always `channel_about: { id: Not(IsNull()) }`. When `channelIds` is null, add
  `feed: { feed_policy: { public_visible: true } }` and, when `getMediumIdArrayFromType` gives
  ids, `medium_id: In(ids)`. When it is an array, add `id: In(channelIds)` only.
- `where`: `{ channel: channelWhere, live_item: { live_item_status_id:
In([LiveItemStatusEnum.Live, LiveItemStatusEnum.Pending]) }, item_flag_status: { id:
ItemFlagStatusStatusEnum.Active } }`.
- `order`: `{ live_item: { live_item_status_id: 'DESC', start_time: 'ASC' }, id: 'ASC' }` with
  the comment `// Live (2) sorts before Pending (1).`
- Pass `...config` (skip, take, relations) through the repository `find`, as `getMany` does.

### API — `LiveItemController`

Two static handlers beside `getManySubscribedRecent`. Import what `controllers/item.ts` imports
for the same jobs: `getPaginationParams`, `ensureAuthenticated`, `getAuthenticatedUser`,
`getFollowedChannelIds`, `handleGenericErrorResponse`, `mediumPageQuerySchema`,
`emptyApiListResponse`, and `itemGetManyRelationsWithChannel`.

- `getManyGlobalUpcoming(req, res)`: `validateQueryObject(Joi.object(mediumPageQuerySchema)
.unknown(true), req, res, async () => { … })`. Inside: `getPaginationParams(req)`, read
  `medium`, call `itemService.getManyUpcomingLiveItems({ skip: offset, take: limit, relations:
itemGetManyRelationsWithChannel }, { channelIds: null, mediumType: medium })`, respond
  `{ data, meta: { page, count: null, limit } }`. Errors → `handleGenericErrorResponse`.
- `getManySubscribedUpcoming(req, res)`: the same validation, wrapped in `ensureAuthenticated(req,
res, cb, { skipMembershipStatus: true })` the way `ItemController.getManySubscribedRecent`
  wraps its body. Inside: `getFollowedChannelIds(account_id, medium)`; empty →
  `res.json(emptyApiListResponse(page, limit))` (match the call shape used in `item.ts`); else
  the same service call with `channelIds`.
- Use the `ItemService` instance the controller already uses for its other lists; if it builds
  one per call, do the same.

### Routes

In `apps/api/src/routes/liveItem.ts`, after `/global/top` add `router.get('/global/upcoming',
asyncHandler(LiveItemController.getManyGlobalUpcoming));` and after `/subscribed/top` add the
subscribed route.

### OpenAPI (**openapi-sync**)

Add `/live-item/global/upcoming` after `/live-item/global/recent`'s sibling `/global/top`, and
`/live-item/subscribed/upcoming` after `/live-item/subscribed/top`. Copy the matching `recent`
entry (line 12816 and line 12959) and change:

- `operationId`: `apiGetLiveItemGlobalUpcoming` / `apiGetLiveItemSubscribedUpcoming`.
- `summary`: `GET /live-item/global/upcoming` / `GET /live-item/subscribed/upcoming`.
- `description`: "Live items on the air now, then scheduled ones, by start time. Ended live
  items are never listed." (subscribed adds "from channels the account follows").
- Remove the `liveItemType` parameter. Keep `medium`, `PageQueryRequired`, the security block,
  and the `ItemListResponse` response refs.

### helpers-requests

In `api/liveItem/liveItem.ts`:

```typescript
export type QueryParamsLiveItemUpcoming = {
  type: 'global' | 'subscribed';
  medium: QueryParamsMedium;
  page: number;
};

export async function reqLiveItemGetManyUpcoming(
  api: ApiRequestService,
  params: QueryParamsLiveItemUpcoming
) {
  const { type, ...query } = params;
  return api.apiRequest<ApiListResponse<DTOItem>>({
    path: `/live-item/${type}/upcoming`,
    method: 'GET',
    config: { params: query },
  });
}
```

Import `QueryParamsMedium` as a type from `@podverse/helpers`. Export the type from the package
the same way the file's other types reach `index.ts` (check `src/index.ts`). In `_request.ts`,
add it to the line 198 import and a method after `reqLiveItemGetManyByChannel` (line 1098):

```typescript
reqLiveItemGetManyUpcoming(params: QueryParamsLiveItemUpcoming) {
  return reqLiveItemGetManyUpcoming(this, params);
}
```

## Reuse

`mediumPageQuerySchema`, `getFollowedChannelIds`, `getPaginationParams`,
`emptyApiListResponse`, `itemGetManyRelationsWithChannel`, the `getMany` channel filter, and the
existing request-helper pattern.

## Tests

**Unit** — `liveItemVisibility.test.ts`, a `describe('compareUpcomingLiveItems')`:

- A live item with a later start sorts before a scheduled item with an earlier start.
- Two scheduled items: the earlier start first; a null start after a dated one.
- `isUpcomingLiveItemStatus`: true for Live and Pending; false for Ended, null, and undefined.

**API integration** — `category-channel-item-read.test.ts`:

- Wire `itemGetManyUpcomingLiveItemsMock` exactly like `itemGetManyByChannelWithLiveItemMock`:
  the hoisted `vi.fn(default…)`, the defaults map (lines 263–270), the `beforeEach` reset, and
  `getManyUpcomingLiveItems = itemGetManyUpcomingLiveItemsMock;` on `MockItemService`
  (line 318). The default resolves `[]`.
- Inside `describe('live-item')` (line 847):
  - `GET /live-item/global/upcoming?medium=all&page=1` returns 200 with the mock's items in the
    mock's order (use `buildLiveItemMock` for one live and one pending item); the mock got
    `channelIds: null` and `mediumType: 'all'`.
  - `GET /live-item/global/upcoming?page=1` (no medium) returns 400.
  - `GET /live-item/subscribed/upcoming?medium=all&page=1` signed out returns 401.
  - The same signed in (the `getAccountMock` setup the subscribed-recent test at line 976 uses)
    returns 200.

The SQL order itself is checked by the Playwright and Maestro steps in plan 87 against the seed
(live rows above `E2E Scheduled Livestream`).

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Upcoming livestreams endpoints

- Surfaces: api, helpers-requests
- Change: `GET /live-item/global/upcoming` (public) and `GET /live-item/subscribed/upcoming`
  (signed in) list live items on the air now, then scheduled ones by start time. Ended live
  items are never listed. Query: `medium` and `page`.
- Who notices: API clients; the web and mobile Livestreams chips use them
- Operator steps: none
```
