**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 20 — Per-notification read state: schema and unread rule

Adds a nullable `read_at` to each notification row and changes the unread rule everywhere the
server computes it. A notification is unread when it was created after the account's Mark All as
Read cutoff (`account.notifications_last_read_at`) **and** its own `read_at` is null. Nothing
writes `read_at` in this plan (plan 21 adds the mark-one write), so after this plan every row has
a null `read_at` and the counts and flags stay the same as today.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved: `AccountNotification` in `packages/orm/src/entities/account/accountNotification.ts`,
`AccountNotificationService.countUnread` in
`packages/orm/src/services/account/accountNotification.ts`, `accountNotificationToJson` in
`apps/api/src/lib/accountNotificationApiSerialization.ts`, `getNotifications` and `markRead` in
`apps/api/src/controllers/account/accountNotification.ts`, the `AccountNotificationItem` schema in
`apps/api/openapi.yml`, and `API_EXPECTED_MIGRATION_FILENAME` in
`infra/k8s/base/api/source/api.env`.

## Rows

R28, R29

## Runs after

11, 12

Plan 11 edits `packages/orm/src/services/account/accountNotification.ts` and its test (adds the
signal publish and three read helpers). Plan 12 edits `apps/api/openapi.yml`. Keep their changes;
add to them.

## Files

infra/k8s/base/ops/source/database/linear-migrations/app/0022_account_notification_read_at.sql
infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
infra/k8s/base/api/source/api.env
infra/k8s/base/ops/kustomization.yaml
packages/orm/src/entities/account/accountNotification.ts
packages/orm/src/services/account/accountNotification.ts
packages/orm/src/services/account/accountNotification.test.ts
packages/helpers/src/dtos/account/accountNotification.ts
apps/api/src/lib/accountNotificationApiSerialization.ts
apps/api/src/lib/accountNotificationApiSerialization.test.ts
apps/api/src/controllers/account/accountNotification.ts
apps/api/src/test/account-notifications.test.ts
apps/api/openapi.yml
release-notes/scratchpad.md

## Decisions this plan fixes

- **Storage is a nullable `read_at timestamptz` column on `account_notification`.** Not a separate
  table: every notification row already belongs to exactly one account, so one column holds the
  state at the right grain. The purge job deletes a row and its read state together, and the
  existing `ON DELETE CASCADE` from `account` covers account deletion.
- **Mark All as Read stays one timestamp write** (`AccountService.updateNotificationsLastReadAt`,
  unchanged). It does not stamp `read_at` on rows, because every row at or before the cutoff
  already reads as read whatever its `read_at`.
- **The DTO keeps its shape.** `DTOAccountNotification.is_unread` keeps its name and type; only
  how the server derives it changes. No `read_at` field is added to the DTO. Mobile does not store
  notifications in SQLite, and web holds them in memory only, so there is no device data to
  migrate (**dto-changes-are-device-data-migrations** checked).
- **No new index.** The unread count filters `account_id`, `created_at > cutoff`, and
  `read_at IS NULL`. The existing `idx_account_notification_account_id_created_at` bounds the scan
  to one account's rows after the cutoff, and retention keeps that set small.

## Migration

Create `infra/k8s/base/ops/source/database/linear-migrations/app/0022_account_notification_read_at.sql`.
`0021` is already taken by `0021_channel_may_have_live_items.sql`. If another change has also
taken `0022` by the time this runs, use the next free number, and use that same filename in
`api.env`, in `infra/k8s/base/ops/kustomization.yaml`, and in the release entry. Every
`0022_account_notification_read_at.sql` below means the filename you used.

Greenfield only (**linear-sql-greenfield-only**): no `IF NOT EXISTS`. Grants already cover the
table, so the new column needs none.

```sql
-- Per-notification read state, alongside account.notifications_last_read_at.
--
-- A notification is unread when it was created after the account's Mark All as Read cutoff and its
-- read_at is null. Opening one notification sets read_at on that row only. Mark All as Read moves
-- the cutoff and leaves read_at alone, because every row at or before the cutoff already reads as
-- read.
--
-- The state lives on the row because each notification row already belongs to one account. The
-- purge job deletes a row together with its read state.

ALTER TABLE public.account_notification
    ADD COLUMN read_at timestamp with time zone;
```

Do not edit `0006_notifications_read_state.sql`. It has shipped; its header still holds.

### Baselines and readiness marker

Per **linear-baseline-0004** and **migration-readiness-marker-sync**:

1. Run `make db_regen_linear_baseline`, then `make db_verify_linear_baseline`, from the repo root.
   Leave the regenerated `0004_app_linear_baseline.sql.gz` and `0005_management_linear_baseline.sql.gz`
   in the working tree. This generates committed files; it is not a test run. If either target
   fails because Docker or the database container is unavailable, finish everything else and
   report it as a blocker in the final message, with the two commands for the operator.
1. In `infra/k8s/base/api/source/api.env`, set
   `API_EXPECTED_MIGRATION_FILENAME=0022_account_notification_read_at.sql` (or the renumbered
   name). Leave `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` alone; this is the app chain.
1. In `infra/k8s/base/ops/kustomization.yaml`, move the `API_EXPECTED_MIGRATION_FILENAME=` literal
   to the new filename, and add
   `source/database/linear-migrations/app/<new filename>` to the app migration file list directly
   after the `0021_channel_may_have_live_items.sql` line.
1. Confirm `infra/k8s/base/api/deployment.yaml` reads the marker from the env var and has no
   hardcoded filename. Change nothing there unless it does.

## Entity

In `packages/orm/src/entities/account/accountNotification.ts`, add after `payload`:

```typescript
  @Column({ type: 'timestamptz', nullable: true })
  read_at?: Date | null;
```

## ORM service

In `packages/orm/src/services/account/accountNotification.ts`, add `IsNull` to the existing
`typeorm` value import (`import { IsNull, LessThan, MoreThan } from 'typeorm';`).

### `countUnread`

Keep the signature `countUnread(account_id: number, last_read_at: Date | null): Promise<number>`.
Plan 12's stream hub calls it, and it must not change. Replace its doc comment and body:

```typescript
  /**
   * Rows the account has not read: created after its Mark All as Read cutoff and not read one at a
   * time. A null cutoff means the inbox has never been marked read, so only `read_at` decides.
   */
  async countUnread(account_id: number, last_read_at: Date | null): Promise<number> {
    const where: FindOptionsWhere<AccountNotification> = {
      account_id,
      read_at: IsNull(),
    };
    if (last_read_at !== null) {
      where.created_at = MoreThan(last_read_at);
    }

    return this.repositoryRead.count({ where });
  }
```

### `countForAccount` (new)

`getNotifications` uses `countUnread(account_id, null)` as the total row count for pagination.
Under the new rule that call would stop counting rows read one at a time, so add a real total and
switch the controller to it:

```typescript
  /** Every row the account has, read or not. Pagination counts pages from this. */
  async countForAccount(account_id: number): Promise<number> {
    return this.repositoryRead.count({ where: { account_id } });
  }
```

Place it directly above `countUnread`.

## Serializer

In `apps/api/src/lib/accountNotificationApiSerialization.ts`, keep the signature
`accountNotificationToJson(row: AccountNotification, lastReadAt: Date | null)`. Plan 12's hub calls
it. Replace the comment and the `isUnread` line:

```typescript
  // Unread means created after the Mark All as Read cutoff and not read on its own. With no cutoff,
  // only read_at decides.
  const isReadOnItsOwn = row.read_at !== null && row.read_at !== undefined;
  const isAfterCutoff =
    lastReadAt === null ? true : row.created_at.getTime() > lastReadAt.getTime();
  const isUnread = !isReadOnItsOwn && isAfterCutoff;
```

The returned object is unchanged (`is_unread: isUnread`, no new field).

## DTO comment

In `packages/helpers/src/dtos/account/accountNotification.ts`, replace the `is_unread` doc comment
(the type stays `boolean`):

```typescript
  /**
   * True when the row was created after the account's Mark All as Read cutoff and has not been read
   * on its own (a banner tap, a push tap, or opening it from the inbox).
   *
   * Derived per response: the cutoff is one timestamp on the account, and per-row read state is a
   * timestamp on the row.
   */
  is_unread: boolean;
```

## Controller

In `apps/api/src/controllers/account/accountNotification.ts`:

- `getNotifications`: replace the `totalCount` call `countUnread(account_id, null)` with
  `countForAccount(account_id)`. Leave the `unreadCount` call as is.
- `markRead`: replace its doc comment, because "there is no per-row state to keep" stops being
  true. The handler body is unchanged:

```typescript
  /**
   * Mark All as Read: moves the account's cutoff to now in one write. Rows read one at a time keep
   * their own `read_at`; the cutoff covers every row created at or before it either way, so this
   * never touches notification rows and its cost does not grow with the inbox.
   */
```

## OpenAPI

In `apps/api/openapi.yml`:

- `components.schemas.AccountNotificationItem.properties.is_unread.description`: replace with
  "True when the row was created after the account's Mark All as Read cutoff (last_read_at) and
  has not been read on its own. Derived per response."
- `/account/notifications/mark-read` `post.description`: replace with "Mark All as Read. Moves the
  authenticated account's notifications_last_read_at cutoff to now. Every notification created at
  or before the cutoff reads as read; per-notification read state is left as is."

No route or response shape changes in this plan.

## Must stay true

- `countUnread` and `accountNotificationToJson` keep their exact signatures (plan 12's hub calls
  both).
- With every `read_at` null, `unread_count`, `is_unread`, and `total_count` equal what they are
  today.
- `AccountService.updateNotificationsLastReadAt` and plan 11's read-all publish are unchanged.
- No `as` added. `read_at` is optional on the entity, so the serializer checks both `null` and
  `undefined` (**eqeqeq-strict-equality**).

## Tests

- `packages/orm/src/services/account/accountNotification.test.ts` (keep plan 11's `vi.mock` of the
  signal module and its cases):
  - Update `countUnread counts all rows when last_read_at is null` to expect
    `{ where: { account_id: 41, read_at: expect.any(Object) } }`, and rename it to
    `countUnread with no cutoff counts rows not read on their own`.
  - Update the cutoff case to expect `expect.objectContaining({ account_id: 41, created_at:
    expect.any(Object), read_at: expect.any(Object) })`.
  - Add `countForAccount counts every row for the account`, expecting
    `{ where: { account_id: 41 } }`.
- `apps/api/src/lib/accountNotificationApiSerialization.test.ts` (new, Vitest, beside the
  serializer the way `accountPlaylistApiSerialization.test.ts` sits beside its source). Build a
  plain object typed as `AccountNotification` (import the type with `import type` from
  `@podverse/orm`; spread a base row, no `as`):
  - No cutoff and `read_at` null: `is_unread` is true.
  - No cutoff and `read_at` set: false.
  - Created after the cutoff and `read_at` null: true.
  - Created after the cutoff and `read_at` set: false.
  - Created at or before the cutoff and `read_at` null: false.
- `apps/api/src/test/account-notifications.test.ts`:
  - Add `accountNotificationCountForAccountMock: vi.fn(async () => 25)` to the hoisted mocks and
    `countForAccount = accountNotificationCountForAccountMock;` to `MockAccountNotificationService`.
  - In `GET /account/notifications returns paginated feed payload`, assert
    `accountNotificationCountForAccountMock` was called with `TEST_USER_ID`, and keep
    `total_count: 25`, `unread_count: 25`, and `is_unread: true`.

## Release scratchpad

```markdown
## Per-notification read state (schema)

- Surfaces: api, ops
- Change: new app migration `0022_account_notification_read_at.sql` adds a nullable `read_at` to
  `account_notification`. A notification is now unread only when it was created after the
  account's Mark All as Read cutoff and its own `read_at` is null. The unread count, the inbox's
  `is_unread` flags, and the stream's counts all follow that rule. The inbox's `total_count` now
  comes from a plain row count. Nothing sets `read_at` yet, so counts and flags are unchanged
  until the mark-one endpoints ship.
- Who notices: no one yet.
- Operator steps: run app linear migrations before rolling the API. The API readiness marker
  `API_EXPECTED_MIGRATION_FILENAME` moves to `0022_account_notification_read_at.sql`; a GitOps
  overlay that pins it must move with it.
```
