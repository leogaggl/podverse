**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 41 — API comments that narrate an older v5 schema

Sweep of `apps/api` and `apps/management-api` for code, tests, and comments whose only job is upgrading an older state of this monorepo. No such code is removed. Four comments and test titles narrate an older schema or an older route. Rewrite those words. Keep the behavior they sit on.

A removal has to exist only to upgrade an older schema, older stored rows, or an older deployment of this monorepo. v4 / podverse-rn stays. A comment that states a constraint of the code as it stands stays, rewritten so it does not narrate history (**comments-future-forward**).

## Rows

R20, R27

## Runs after

none

## Files

apps/api/src/lib/addByRSSResourceData.ts
apps/api/src/controllers/account/accountFollowingAddByRSSChannel.ts
apps/api/src/test/account-notifications.test.ts
apps/api/src/test/add-by-rss-feed-identity.integration.test.ts
apps/api/src/test/stats-foundation-schema.integration.test.ts

## Tests

No new tests. No assertion changes.

`apps/api/src/test/account-notifications.test.ts`, `apps/api/src/test/add-by-rss-feed-identity.integration.test.ts`, and `apps/api/src/test/stats-foundation-schema.integration.test.ts` keep every expect. Only the `it` title, one seed label, one local variable name, and one local array name change, as specified below.

## Release scratchpad

none

## Rewrites

### `normalizeAddByRSSResourceData`

File: `apps/api/src/lib/addByRSSResourceData.ts`. Replace the block comment above `normalizeAddByRSSResourceData` with:

```typescript
/**
 * Canonicalizes `feed_url` in an Add by RSS payload before it is hashed or stored, so every device
 * produces the same add_by_rss_hash_id and no stored payload carries `user:pass@`. A `feed_url`
 * that is not a usable http(s) URL is dropped, and the payload is hashed from the remaining fields.
 */
```

Do not change the function. Dropping an unusable `feed_url` is current behavior. The hash of a payload with no `feed_url` is `getAddByRSSHashId` in `@podverse/helpers` (area E). Do not stop producing that hash.

### Follow route comment

File: `apps/api/src/controllers/account/accountFollowingAddByRSSChannel.ts`, inside `addOrUpdateRSSChannel`, replace the two-line comment above `bodySchema` with:

```typescript
        // Credentials are never stored on this route. `basic_auth_*` is not a field on this body;
        // stripUnknown drops those keys before the handler runs.
```

Do not add a special strip. Joi `stripUnknown` already drops unknown keys. Leave the handler and the test `drops basic_auth fields so no credential reaches storage` in `apps/api/src/test/account-follows-notifications.test.ts` as they are.

`apps/api/openapi.yml` is a large file (**large-file-reading**). The schema `ApiPostAccountFollowAddByRssChannelRequest` already says credentials are not accepted and unknown keys such as `basic_auth_*` are ignored. Do not open the file to edit it.

### Notification-type test title

File: `apps/api/src/test/account-notifications.test.ts`. The `it` at the end of the file is titled `POST /account-settings/notification-type still supports legacy notification-type route`.

`POST` and `DELETE /account-settings/notification-type` are the current routes (`apps/api/src/routes/accountSettings.ts`). Web settings and mobile notification settings call them. Rename that `it` to:

`POST /account-settings/notification-type creates the account notification type`

Do not delete the test. Do not remove the route. `apps/api/src/test/account-settings.test.ts` also covers the route; leave that file alone.

### Queue row hashed without `feed_url`

File: `apps/api/src/test/add-by-rss-feed-identity.integration.test.ts`. The `it` titled `moves a row written before feed identity instead of adding a second one` inserts a `queue_resource` whose payload has no `feed_url`, then posts the same episode with `feed_url`, and expects one row under the feed hash.

That match is current server behavior. Queue and playlist Add by RSS bodies require an object (`Joi.object().required()` in `queueResourceItemAddByRSS.ts`) and do not require `feed_url`. `findAddByRssQueueResource` in `packages/orm/src/services/queue/queueResource.ts` (area E) finds the row hashed without `feed_url` and saves it under the feed hash. Keep the insert, the request, and every expect.

Rename only:

- the `it` title to `updates one queue row when the stored hash has no feed_url and the same episode is added with one`
- `seedAccount('legacy-row', runId)` to `seedAccount('no-feed-url', runId)`
- the local `legacyData` to `storedWithoutFeedUrl` at every use in that test

Leave the fixture strings `legacyChan1`, `legacy-episode`, and `Legacy` in place so the expected `getAddByRSSHashId({ feed_url: FEED_URL, guid: 'legacy-episode' })` stays byte-identical.

### Absent stats tables

File: `apps/api/src/test/stats-foundation-schema.integration.test.ts`. The `it` `has no per-entity event, guid mapping, or rolling aggregate stats tables` asserts those table names are absent. That is the current schema. Keep the `it` title, the table-name list, and every expect.

Rename the local `legacyTables` to `absentStatsTables` at both uses in that test. Do not edit SQL.

## Do not remove

These look like older-schema support and are current behavior. Do not edit them.

- `getAddByRSSHashIdsForResourceData` in `apps/api/src/controllers/playlist/playlist.ts` (likes toggle, around the `getAddByRSSLikeHashIds` call). A payload with no usable `feed_url` is still identified by the hash of the remaining fields. The same lookup lives in `packages/orm` (area E). Removing only this call would disagree with the ORM.
- `legacyHeaders: false` in `apps/api/src/lib/rateLimiter.ts`. That is the rate-limit library option that turns off its older response headers. It is not a v5 schema path.
- `compatParsedChapters` in `apps/api/src/controllers/account/accountAddByRSSChaptersTranscript.ts`. It maps parsed chapter shapes. The helper is in `packages/parser-mapping` (area E).
- `migration_baseline` in `apps/management-api/src/routes/billingMembershipLedger.integration.test.ts` (`adopts a cached expiry no grant covers before extending, so no time is lost`). `adoptCachedExpiryWithManager` in `packages/orm/src/services/billingMembershipExtension.ts` (area E) still writes that source when `membership_expires_at` is ahead of the grants, including a seed that set the cache directly. Keep the test and the expects.
- `legacy_import` anywhere it appears. That source is membership carried over from v4. Out of scope.
- `apps/management-api/openapi.yml` (**large-file-reading**). Under schema `BillingAccountGrant`, property `admin_editable`, the description names admin, trial, legacy import, and migration baseline. Those sources stay. Do not edit the file.
- `apps/management-api/src/lib/database/tablePolicy.test.ts` and `apps/management-api/src/routes/database.integration.test.ts`. They assert `stats_aggregated_*` is off the admin allowlist, and they also keep current tables (`stats_daily_*`, `stats_listen_event`, `stats_taste_profile`) off that allowlist. Leave both files.
- `migrations: []` in `apps/management-api/src/orm/db/index.ts` and `apps/management-api/src/orm/db/appDb.ts`. TypeORM does not run migrations; linear SQL does. Leave the empty arrays.
- `requireSupportedClientVersion` in `apps/api/src/lib/billing/billingHttp.ts`. A checkout channel's `min_client_version` is a current sales control, not an older deployment.
