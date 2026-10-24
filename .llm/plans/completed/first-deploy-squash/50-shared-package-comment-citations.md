**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rewrite comments and one test title in shared packages so they name the first-deploy schema files and the behavior of the code as it stands. Do not change runtime behavior, exports, or types.

## Rows

R12, R28

## Runs after

none

## Files

packages/orm/src/lib/billingLimits.ts
packages/orm/src/lib/feedLifecycleLimits.ts
packages/orm/src/lib/feedTableLimits.ts
packages/helpers/src/lib/adminAccountCredentialsLimits.ts
packages/helpers/src/lib/addByRSSHash.ts
packages/helpers/src/lib/billing/membershipGrantSource.ts
packages/helpers/src/lib/descriptionIngest.test.ts
packages/helpers/src/lib/notificationDestination.test.ts
packages/helpers/src/dtos/channel/channel.ts
packages/helpers/src/dtos/item/item.ts
packages/helpers/src/dtos/account/accountSettings/accountSettingsNotification.ts
packages/orm/src/services/billingMembershipExtension.ts
packages/orm/src/services/queue/queueResource.ts
packages/orm/src/index.ts
packages/orm/src/config/index.ts
packages/orm/src/factories/loggerService.ts
packages/parser/src/config/index.ts
packages/parser/src/factories/loggerService.ts
packages/parser/src/factories/podcastIndex.ts
packages/parser/src/factories/timerManager.ts
packages/parser/src/lib/notifications/sharedNotificationHelpers.ts
packages/parser-mapping/src/addByRSS/types.ts
packages/parser-mapping/src/addByRSS/queuePlaylistHelpers.ts
packages/mq/src/lib/computeMqDuplicateId.test.ts

## Tests

none

Comment and test-title edits only. Do not add tests. Do not change assertions in `descriptionIngest.test.ts`, `notificationDestination.test.ts`, or `computeMqDuplicateId.test.ts`.

## Release scratchpad

none

## Docs (R12)

Shared package docs were checked. None of them cite a migration file or an upgrade-only path. Do not edit them:

- `packages/playback-core/PACKAGES-PLAYBACK-CORE.md`
- `packages/integrations-web/PACKAGES-INTEGRATIONS-WEB.md`
- `packages/external-services-google-play/PACKAGES-EXTERNAL-SERVICES-GOOGLE-PLAY.md`
- `packages/external-services-apple-app-store/PACKAGES-EXTERNAL-SERVICES-APPLE-APP-STORE.md`
- `packages/design-tokens/PACKAGES-DESIGN-TOKENS.md`

`packages/ui/**`, `packages/i18n-catalog/**`, and `packages/worker-commands/**` are not this area.

## Do not change behavior

Leave every export, type, and branch as it is. In particular, do not remove or rename:

- `getLegacyAddByRSSHashId` and `getAddByRSSHashIdsForResourceData` in `packages/helpers/src/lib/addByRSSHash.ts`
- `getAddByRSSHashIds` in `packages/parser-mapping/src/addByRSS/queuePlaylistHelpers.ts`
- the `migration_baseline` source, or `adoptCachedExpiryWithManager` in `packages/orm/src/services/billingMembershipExtension.ts`
- the `id_text`, `item_id_text`, `channel_id_text`, and `podcastId` reads in `resolveNotificationDestinationFromPayload`
- optional `?` on `verified_publishers`, `channel_wide_verified_publishers`, `auto_enable_on_subscribe`, or `feedUrl`

`packages/orm/src/services/queue/queueResource.ts` is a large file. Search for `findAddByRssQueueResource` and replace only the doc comment immediately above that method. Do not rewrite the file.

## Comment text

Replace each block below with the new text. Keep the surrounding code.

### `packages/orm/src/lib/billingLimits.ts`

The file header today cites `0028_billing_pricing_catalog.sql` and `0029_billing_events_and_retry_metadata.sql`. Those files are not in the app chain. `BILLING_IDEMPOTENCY_KEY_MAX_LENGTH` (128) matches `character varying(128)` on `billing_domain_event.idempotency_key` and `account_membership_status.last_extension_idempotency_key`. `ISO_4217_CURRENCY_CODE_CHAR_LENGTH` (3) matches `billing_price.currency_code` `character(3)`. Do not mention `last_renewal_idempotency_key`; `0013_membership_billing_ledger.sql` drops it, and the squashed `0001_app_schema.sql` will not have it.

```typescript
/**
 * Billing-related VARCHAR/CHAR lengths.
 *
 * Keep in sync with
 * `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`:
 * `billing_price.currency_code` is `character(3)`, and `billing_domain_event.idempotency_key`
 * and `account_membership_status.last_extension_idempotency_key` are `character varying(128)`.
 * That file is the DDL source of truth.
 */
```

### `packages/orm/src/lib/feedLifecycleLimits.ts`

The header cites `0025_feed_lifecycle_state_replacement.sql`, which is not in the chain. The widths are already on `0001_app_schema.sql`: `state_key` and `reason_key` are `character varying(64)`; `updated_by_source` and `feed_lifecycle_event.source` are `character varying(16)`.

```typescript
/**
 * VARCHAR lengths for feed lifecycle columns (`feed_lifecycle_state_type`,
 * `feed_lifecycle_state`, `feed_lifecycle_event`).
 *
 * `state_key` and `reason_key` are `character varying(64)`. `updated_by_source` and
 * `feed_lifecycle_event.source` are `character varying(16)`. Keep in sync with
 * `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`.
 * That file is the DDL source of truth; these values are shared across ORM entities and API
 * validation in TypeScript.
 */
```

### `packages/orm/src/lib/feedTableLimits.ts`

The header cites `0001_init_podcasting_20_database.sql`, which is not a file. `feed.container_id` is `character varying(12)` in `0001_app_schema.sql`.

```typescript
/**
 * Feed table column widths not covered elsewhere.
 *
 * `feed.container_id` is `character varying(12)` in
 * `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`.
 */
```

### `packages/helpers/src/lib/adminAccountCredentialsLimits.ts`

Keep the `0000_init_helpers.sql` domain lines. `0008_admin_credentials_username_email_optional.sql` is not a file. `username character varying(64)` and `admin_account_credentials_username_length_check` are in `0001_management_schema.sql`. `0000_init_helpers.sql` stays after the squash (`varchar_email` `VARCHAR(255)`, `varchar_password` `VARCHAR(60)`).

```typescript
/**
 * Column width limits for management DB `admin_account_credentials`.
 * Keep aligned with:
 * - `varchar_email` (`VARCHAR(255)`) in
 *   `infra/k8s/base/ops/source/database/linear-migrations/management/0000_init_helpers.sql`
 * - `varchar_password` (`VARCHAR(60)`) — bcrypt hashes — in
 *   `infra/k8s/base/ops/source/database/linear-migrations/management/0000_init_helpers.sql`
 * - `username` `character varying(64)` and `admin_account_credentials_username_length_check` in
 *   `infra/k8s/base/ops/source/database/linear-migrations/management/0001_management_schema.sql`
 */
```

### `packages/helpers/src/lib/addByRSSHash.ts`

Replace the file header. `0020_add_by_rss_feed_identity.sql` is deleted by the squash; `public.add_by_rss_hash_id_from_feed` then lives in `0001_app_schema.sql`. Say "per-device form", not "legacy form". Do not rename `getLegacyAddByRSSHashId`.

```typescript
/**
 * Add-by-RSS hash: compute add_by_rss_hash_id from a minimal, stable set of fields.
 *
 * Feed form (the episode has the same id on every device): `feed_url` + `guid`, or
 * `feed_url` + `enclosure_url` when the guid is missing or device-local.
 *
 * Per-device form (payloads without `feed_url`): `channel_id_text` + `guid`, or
 * `channel_id_text` + `enclosure_url` when the guid is missing. `channel_id_text` is a random id
 * each device creates for its copy of the feed, so this form differs per device.
 *
 * `getMd5Hash` hashes `JSON.stringify`, so key insertion order is part of the contract.
 * `public.add_by_rss_hash_id_from_feed` in
 * `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`
 * reproduces the feed form. The two must stay byte for byte identical.
 */
```

Replace the doc comment on `getLegacyAddByRSSHashId`:

```typescript
/**
 * The hash of this payload with `feed_url` left out. When the payload has no `feed_url`, this
 * is the same id as `getAddByRSSHashId`. When it has `feed_url`, a stored row may still carry
 * this id.
 */
```

Replace the doc comment on `getAddByRSSHashIdsForResourceData`:

```typescript
/**
 * Every add_by_rss_hash_id a stored row for this payload may carry: the hash of the payload,
 * then the hash with `feed_url` left out when that id differs.
 */
```

### `packages/parser-mapping/src/addByRSS/types.ts`

On `AddByRSSItemIndexItem.feedUrl`, replace the comment. Leave `feedUrl?` optional. The livestream type's `feedUrl` comment points at this field; leave that pointer.

```typescript
  /**
   * Parent feed URL. Absent when the item has none; without it the item hashes in the per-device
   * form (`channel_id_text` plus guid or enclosure URL).
   */
```

### `packages/parser-mapping/src/addByRSS/queuePlaylistHelpers.ts`

Replace the file header's third sentence and the doc comment on `getAddByRSSHashIds`. Do not change `getAddByRSSHashIds`.

Header sentences:

```typescript
/**
 * Add-by-RSS queue and playlist: build minimal hash input and full resource
 * payload for API. Same resource => same add_by_rss_hash_id (matches backend).
 *
 * Hash uses canonical feed_url + guid (or enclosure_url). An index item with no feed URL hashes
 * `channel_id_text` plus guid or enclosure URL. See `extractAddByRSSHashInput` in `@podverse/helpers`.
 */
```

```typescript
/**
 * Every add_by_rss_hash_id a server row for this item may carry: the feed form first, then the
 * form with no feed URL when that id differs. One entry when the item has no feed URL.
 */
```

### `packages/orm/src/services/queue/queueResource.ts`

Doc comment immediately above `findAddByRssQueueResource` only:

```typescript
  /**
   * The queue row for an Add by RSS payload: the row whose `add_by_rss_hash_id` is `hashId`,
   * otherwise a row stored under the payload's hash with `feed_url` left out. Callers save the
   * returned row under `hashId`.
   */
```

### `packages/orm/src/services/billingMembershipExtension.ts`

Doc comment on `adoptCachedExpiryWithManager` only. Leave the method body, including `source: 'migration_baseline'`.

```typescript
  /**
   * A cached expiry no grant covers would be dropped on the next recompute. Before any ledger
   * write, that uncovered time becomes a `migration_baseline` grant. Returns the account's
   * status and the access expiry after adoption. The caller holds the account lock.
   */
```

### `packages/helpers/src/lib/billing/membershipGrantSource.ts`

Replace only the `migration_baseline` bullet. Leave `legacy_import` (membership carried over from the previous Podverse app) and every array entry.

```typescript
 * - `migration_baseline` — cached membership time that no grant covered, written on the next ledger update.
```

### `packages/helpers/src/dtos/channel/channel.ts`

Comment on `verified_publishers` only. Leave the `?`.

```typescript
  /**
   * Publishers verified on the whole channel, primary first. Empty when there are none. Absent
   * when the response did not include it.
   */
```

### `packages/helpers/src/dtos/item/item.ts`

Comment on `channel_wide_verified_publishers` in `DTOItem` only. Leave the `?`. Do not edit the `verified_publishers` comment on `DTOItem` or `DTOItemQueueItem`.

```typescript
  /**
   * Publishers verified on this item's whole channel, primary first. Set only by by-channel item
   * lists, whose items carry no embedded `channel`. Absent on other responses.
   */
```

### `packages/helpers/src/dtos/account/accountSettings/accountSettingsNotification.ts`

Comment on `auto_enable_on_subscribe` only. Leave the `?`. Callers treat a missing value as off.

```typescript
  /**
   * Absent means off, which is the server default.
   */
```

### `packages/parser/src/lib/notifications/sharedNotificationHelpers.ts`

Replace the doc comment on `getAccountIdsForChannelNotification`. The parameter is the current `AccountNotificationTypeEnum`. Leave the function body.

```typescript
/**
 * Account ids subscribed to this channel for `notificationType`, after membership and
 * `allow_notifications` checks.
 */
```

### Proxy comments

Drop the phrase "for backwards compatibility". These proxies are the import path callers use.

- `packages/parser/src/factories/timerManager.ts` line 1 becomes `// Proxy so callers read the timer manager from the current context.`
- `packages/parser/src/factories/podcastIndex.ts` line 1 becomes `// Proxy so callers read the podcast index service from the current context.`
- `packages/parser/src/factories/loggerService.ts` line 1 becomes `// Proxy so callers read the logger from the current context.`
- `packages/parser/src/config/index.ts`: the line `// Re-export config from context for backwards compatibility` becomes `// Proxy so callers read config from the current context.`
- `packages/orm/src/index.ts`: `// DB exports (proxies to context for backwards compatibility)` becomes `// DB connection exports.`
- `packages/orm/src/factories/loggerService.ts`: delete " for backwards compatibility" from line 1. Keep the next line about `createORMContext()`.
- `packages/orm/src/config/index.ts`: delete " for backwards compatibility" from the re-export comment. Keep the following lines about the proxy and `createORMContext()`.

### Test titles

- `packages/helpers/src/lib/descriptionIngest.test.ts`: rename the test `repairs old raw truncation that lands inside href markup` to `keeps a readable document when a cut lands inside an href`. Rename the local `legacyTruncated` to `cutInsideHref`. Keep the `slice(0, 2500)` and the assertions. The lenient parse of a cut href stays; it is how ingest handles markup that was cut mid-tag.
- `packages/helpers/src/lib/notificationDestination.test.ts`: rename `maps legacy { type, id_text } resource payloads` to `maps a { type, id_text } resource payload`. Keep the payload and the assertion.
- `packages/mq/src/lib/computeMqDuplicateId.test.ts`: delete the two-line comment that starts `Before the fix, OPML messages fell through`. Keep the test `regression: two OPML batches with different requestIds are not collapsed as duplicates` and its assertions.
