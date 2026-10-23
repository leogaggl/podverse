**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 90 — API: unfollow many feeds in one request

"Artist and Albums" ends the follow of an artist and every album of it the member follows: up to
one directory artist or Add by RSS artist plus its directory and Add by RSS albums. Today that is
one `POST /account/unfollow/channel` or `/account/unfollow/add-by-rss-channel` per feed, which
leaves a partial state when one call in the middle fails. This plan adds one request that takes
both lists. Web (plans 92, 93) and mobile (plan 94) call it.

## Rows

R55, R56

## Runs after

none

No code dependency. It shares `apps/api/openapi.yml` with plans 10, 11, 20, and 70, and
`packages/helpers-requests/src/api/_request.ts` with plan 70; assembly orders those edits.

## Files

packages/helpers/src/lib/followChannelsBulk.ts
packages/orm/src/services/account/accountFollowingChannel.ts
packages/orm/src/services/account/accountFollowingAddByRSSChannel.ts
apps/api/src/controllers/account/accountUnfollowBulk.ts
apps/api/src/routes/account.ts
apps/api/openapi.yml
apps/api/src/test/account-follows-notifications.test.ts
packages/helpers-requests/src/api/account/follow/unfollowBulk.ts
packages/helpers-requests/src/api/_request.ts
release-notes/scratchpad.md

## Reuses

- The shape of `followChannelsBulk` in `apps/api/src/controllers/account/accountFollowingChannel.ts`
  (Joi array with `.max`, `ensureAuthenticated`, `validateBodyObject`, `handleGenericErrorResponse`).
- `ChannelService.getManyByIdTexts` (already used by the ORM `followChannelsBulk`).
- `joiFeedUrl()` from `@api/lib/validation/uriSchemes.js` and
  `resolveAddByRSSFeedUrlCredentials` from `@podverse/helpers-validation`, exactly as
  `AccountFollowingAddByRSSChannelController.removeRSSChannel` normalizes one URL.
- `reqAuthMe` in helpers-requests, as `reqAccountUnfollowChannel` returns it.

## Decisions this plan fixes

- **One endpoint for both kinds:** `POST /account/unfollow/bulk`. Two bulk endpoints were the
  other choice; one press would then still be two requests and could still stop halfway.
- **Never membership-gated** (`skipMembershipStatus: true`), like both single unfollows. Ending a
  follow is always allowed.
- **Unknown ids and URLs are ignored**, not errors, so a stale local follow cannot block the rest.
  The response is `204` with no body; the caller refetches the account through the helper.
- **No transaction.** Deleting follows is idempotent; a retry after a partial failure finishes the
  job. Directory rows are deleted first, then Add by RSS rows.
- **Cap:** `MAX_BULK_UNFOLLOW_FEEDS = 1000`, applied to the two lists combined.

## `packages/helpers/src/lib/followChannelsBulk.ts`

Append below `MAX_BULK_FOLLOW_CHANNELS`:

```typescript
/**
 * Upper bound on feeds per `POST /account/unfollow/bulk`, counting directory channels and Add by
 * RSS feed URLs together.
 */
export const MAX_BULK_UNFOLLOW_FEEDS = 1000;
```

The file is already re-exported from `packages/helpers/src/index.ts`.

## ORM

`AccountFollowingChannelService` (after `unfollowChannel`):

```typescript
/** Ends this account's follow of each channel. Unknown `id_text`s are skipped. */
async unfollowChannelsBulk(account_id: number, channel_id_texts: string[]): Promise<void>
```

- `accountService.get(account_id)`; missing → `throw new Error('Account not found.')` (as
  `unfollowChannel`).
- Unique id texts; empty → return. `channelService.getManyByIdTexts(unique)`; no channels → return.
- `await this.repositoryReadWrite.delete({ account_id: Equal(account.id), channel_id: In(ids) } as FindOptionsWhere<AccountFollowingChannel>)`,
  the same `where` typing `followChannelsBulk` uses for its `find`.

`AccountFollowingAddByRSSChannelService` (after `removeRSSChannel`):

```typescript
/** Ends this account's follow of each Add by RSS feed URL. URLs it does not follow are skipped. */
async removeRSSChannelsBulk(account_id: number, feed_urls: string[]): Promise<void>
```

- Same account check as `removeRSSChannel`. Unique URLs; empty → return.
- `await this.repositoryReadWrite.delete({ account_id: Equal(account.id), feed_url: In(unique) } as FindOptionsWhere<AccountFollowingAddByRSSChannel>)`.
  Import `Equal`, `In`, and `FindOptionsWhere` from `typeorm` as the channel service does.

## `apps/api/src/controllers/account/accountUnfollowBulk.ts` (new)

`export class AccountUnfollowBulkController` with static service instances
(`new AccountFollowingChannelService()`, `new AccountFollowingAddByRSSChannelService()`), like the
other account controllers. Doc comment: ends many follows in one request so unsubscribing an
artist with its albums cannot stop partway.

`static async unfollowBulk(req, res)`:

- `ensureAuthenticated(req, res, async () => { … }, { skipMembershipStatus: true })`.
- Body schema:

```typescript
const bodySchema = Joi.object({
  channel_id_texts: Joi.array().items(Joi.string().required()).max(MAX_BULK_UNFOLLOW_FEEDS).default([]),
  add_by_rss_feed_urls: Joi.array().items(joiFeedUrl()).max(MAX_BULK_UNFOLLOW_FEEDS).default([]),
});
```

- Inside `validateBodyObject`: read both arrays from `req.body`. When both are empty → `400`
  `{ message: 'Provide channel_id_texts or add_by_rss_feed_urls.' }`. When the combined length is
  over `MAX_BULK_UNFOLLOW_FEEDS` → `400` `{ message: \`At most ${MAX_BULK_UNFOLLOW_FEEDS} feeds per request.\` }`.
- Map each feed URL with `resolveAddByRSSFeedUrlCredentials(url)?.feedUrl ?? url`.
- `await unfollowChannelsBulk(account.id, channel_id_texts)` when non-empty, then
  `await removeRSSChannelsBulk(account.id, feedUrls)` when non-empty. `res.status(204).end()`.
- `catch (err) { handleGenericErrorResponse(res, err); }`.

Import paths and helpers exactly as `accountFollowingChannel.ts` and
`accountFollowingAddByRSSChannel.ts` import them.

## `apps/api/src/routes/account.ts`

After `router.post('/unfollow/channel', …)`:

```typescript
router.post('/unfollow/bulk', asyncHandler(AccountUnfollowBulkController.unfollowBulk));
```

Import the controller beside the other account controller imports.

## `apps/api/openapi.yml`

- Path `/account/unfollow/bulk` directly after `/account/unfollow/channel`, copied from that
  entry: `operationId: apiPostAccountUnfollowBulk`, `summary: POST /account/unfollow/bulk`, the
  same security, a `requestBody` referencing `ApiPostAccountUnfollowBulkRequest`, and responses
  `204` (`Follows ended`), `400`, `401`, `500` with the same schema refs.
- Schema `ApiPostAccountUnfollowBulkRequest` beside `ApiPostAccountFollowChannelBulkRequest`:
  object with optional `channel_id_texts` (array of string, `maxItems: 1000`) and optional
  `add_by_rss_feed_urls` (array of string, `format: uri`, `maxItems: 1000`), and a description
  stating that at least one list is non-empty and the two together hold at most 1000 entries.

## helpers-requests

`packages/helpers-requests/src/api/account/follow/unfollowBulk.ts` (new), modeled on
`reqAccountUnfollowChannel` in `channel.ts`:

```typescript
/** Ends many follows in one request, then returns the refreshed account. */
export async function reqAccountUnfollowBulk(
  api: ApiRequestService,
  params: { channel_id_texts?: string[]; add_by_rss_feed_urls?: string[] }
): Promise<DTOAccount>
```

POST `/account/unfollow/bulk` with `data` holding only the lists that are present,
`config: { withCredentials: true }`, then `return reqAuthMe(api)`. Import `ApiRequestService` and
`reqAuthMe` the way `channel.ts` does.

`_request.ts`: import it in the account follow import block and add, after
`reqAccountUnfollowChannel(…)`:

```typescript
reqAccountUnfollowBulk(params: { channel_id_texts?: string[]; add_by_rss_feed_urls?: string[] }) {
  return reqAccountUnfollowBulk(this, params);
}
```

## Must stay true

- `POST /account/unfollow/channel` and `/account/unfollow/add-by-rss-channel` are unchanged.
- No new rate limit; the single unfollows have none.
- No `as` beyond the `FindOptionsWhere` typing the file already uses, no `any`, strict equality.

## Tests

`apps/api/src/test/account-follows-notifications.test.ts`:

- Add `unfollowChannelsBulkMock` and `removeRSSChannelsBulkMock` (`vi.fn(async () => {})`) to the
  hoisted mocks, and to `MockAccountFollowingChannelService` and
  `MockAccountFollowingAddByRSSChannelService`.
- New `describe('POST /unfollow/bulk', …)` after `POST /unfollow/channel`, one `it` each:
  - Both lists → 204; the channel mock gets `(TEST_USER_ID, ['a', 'b'])` and the Add by RSS mock
    gets the canonical feed URL.
  - Only `add_by_rss_feed_urls` → 204; the channel mock is not called.
  - Neither list (empty body) → 400; neither mock is called.
  - 1001 combined entries (600 + 401) → 400.
  - A feed URL that is not http(s) → 400.
  - No auth → 401.

## Release scratchpad

```markdown
## Unfollow many feeds in one request

- Surfaces: api, helpers-requests
- Change: `POST /account/unfollow/bulk` takes `channel_id_texts` and/or `add_by_rss_feed_urls`
  (at most 1000 together) and ends this account's follow of each; unknown ids and URLs are
  skipped. Returns 204. Never membership-gated, like the single unfollows. Web and mobile use it
  when a member unsubscribes from an artist together with its albums.
- Who notices: API consumers
- Operator steps: none
```
