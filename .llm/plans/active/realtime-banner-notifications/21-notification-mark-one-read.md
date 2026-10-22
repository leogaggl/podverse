**Cursor model:** Codex 5.3 · **Reasoning:** high

# 21 — Mark one notification read (by id, and by push payload)

Two endpoints that set `read_at` (plan 20) on a single notification, return the new unread count,
and publish a `read_one` signal through plan 11's publisher so every open stream (plan 12) sends
`notification.read` with `scope: 'one'`. Clients call them; the client work is in areas C (web),
D (mobile stream and OS push taps), and E (mobile banner).

- **By id:** `POST /account/notifications/:notification_id/mark-read`. Callers know the id: a
  mobile banner built from a `notification.created` event, or an inbox row.
- **By push payload:** `POST /account/notifications/mark-read-by-item`, body
  `{ item_id_text, type }`. Callers are OS push taps (web service worker, mobile push response).
  Push data never carries the notification id. The parser sends one push per device group across
  many accounts, with only `itemIdText`, `channelIdText`, `mediumId`, and `type`. The inbox row the
  parser writes for the same event stores `payload.itemIdText` and `payload.type` from the same
  `itemNotification` (`handleNewItemNotifications`, `handleNewLiveItemNotifications`,
  `handleNewRemoteItemNotifications` in `packages/parser/src/lib/notifications/`), so the server
  can find the row for that account exactly. `type` is required because one item can produce
  both a `livestream-scheduled` and a `livestream-started` row.

Admin campaign notifications send no push today (`dispatchAdminNotificationCampaign` only
evaluates push eligibility), so the by-payload form only needs to match parser rows.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved: `AccountNotificationController` and `getUnreadCount` in
`apps/api/src/controllers/account/accountNotification.ts`, the `/notifications/mark-read` route in
`apps/api/src/routes/account.ts`, `queryRows` in `packages/orm/src/services/billingCheckoutChannel.ts`,
`publishAccountNotificationSignals` in `packages/orm/src/services/account/accountNotificationSignal.ts`
(plan 11), `reqNotificationsMarkRead` in
`packages/helpers-requests/src/api/account/notification/notifications.ts` and its method in
`packages/helpers-requests/src/api/_request.ts`, and the `/account/notifications/mark-read` path in
`apps/api/openapi.yml`.

## Rows

R28

## Runs after

20

(Plan 20 runs after 11 and 12. This plan edits the ORM service and its test after plans 11 and 20,
and `routes/account.ts` and `openapi.yml` after plan 12.)

## Files

packages/orm/src/lib/queryResultRows.ts
packages/orm/src/lib/queryResultRows.test.ts
packages/orm/src/services/billingCheckoutChannel.ts
packages/orm/src/services/account/accountNotification.ts
packages/orm/src/services/account/accountNotification.test.ts
apps/api/src/controllers/account/accountNotification.ts
apps/api/src/routes/account.ts
apps/api/src/test/account-notifications.test.ts
apps/api/openapi.yml
packages/helpers-requests/src/api/account/notification/notifications.ts
packages/helpers-requests/src/api/_request.ts
release-notes/scratchpad.md

## Contract

Both endpoints:

- Auth: `ensureAuthenticated(req, res, handler, { skipMembershipStatus: true })`, the same as
  `markRead` and `getUnreadCount`. Cookie or bearer.
- Validate before auth, as `getNotifications` does (`validateParamsObject` /
  `validateBodyObject`, then `ensureAuthenticated`). An invalid request returns 400 before 401.
- 200 body:

```json
{ "data": { "marked_ids": [101], "unread_count": 3 } }
```

  - `marked_ids`: the rows this request moved from unread to read, ascending. Empty when they were
    already read (by `read_at` or by the cutoff), or, for the by-payload form, when the account has
    no matching row (in-app disabled for that category, or purged).
  - `unread_count`: the account's unread count after the write, from `countUnread(account_id,
    account.notifications_last_read_at ?? null)`. Callers set their badge from it at once instead
    of waiting for the stream.
- A signal is published only for ids in `marked_ids`. An already-read row produces no event.
- By id only: 404 `{ "message": "Notification not found" }` when no row with that id belongs to the
  account. Another account's id gets the same 404, so nothing reveals that it exists.
- When the account row is missing after auth, 404 `{ "message": "Account not found" }`, as in
  `getUnreadCount`.

### Validation

- By id, params: `Joi.object({ notification_id: Joi.number().integer().positive().required() }).unknown(false)`.
  Read it with `Number(getParamRequired(req, 'notification_id'))` (`@api/lib/params.js`), the way
  `PodcastIndexController.podcastById` reads its numeric param.
- By payload, body:
  `Joi.object({ item_id_text: Joi.string().trim().min(1).max(64).required(), type: Joi.string().trim().min(1).max(64).required() })`.
  `type` is not checked against a list: the API does not depend on `@podverse/notifications`,
  where the message types live, and an unknown type simply matches nothing.
  Read the validated body into a typed local without `as`:
  `const { item_id_text, type }: MarkReadByItemInput = req.body;` with
  `type MarkReadByItemInput = { item_id_text: string; type: string };` declared beside
  `UpdateNotificationPreferenceInput`.

## ORM

### Shared result reader

TypeORM returns `[rows, affectedCount]` from a Postgres `UPDATE … RETURNING`. The only reader for
that shape is the file-private `queryRows` in `packages/orm/src/services/billingCheckoutChannel.ts`.
Move it so this plan does not add a second copy (**reuse-beyond-components**):

- New `packages/orm/src/lib/queryResultRows.ts` exporting
  `readQueryResultRows(value: unknown): unknown[] | null`, with the body of `queryRows` unchanged,
  including its comment about the `[rows, affectedCount]` shape.
- In `billingCheckoutChannel.ts`, delete `queryRows`, import
  `readQueryResultRows` from `'@orm/lib/queryResultRows.js'`, and call it where `queryRows` was
  called (`readUpdatedId`). No other change to that file.

### Service methods

In `packages/orm/src/services/account/accountNotification.ts`, import `readQueryResultRows` and
add `publishAccountNotificationSignals` to plan 11's import from `'./accountNotificationSignal.js'`.

Add a file-private reader below the imports:

```typescript
/** Ids from an `UPDATE … RETURNING id`, ascending. Accepts integer ids or digit strings. */
function readReturnedIds(value: unknown): number[] {
  const rows = readQueryResultRows(value) ?? [];
  const ids: number[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const id: unknown = Reflect.get(row, 'id');
    if (typeof id === 'number' && Number.isInteger(id)) {
      ids.push(id);
    } else if (typeof id === 'string' && /^\d+$/.test(id)) {
      ids.push(Number(id));
    }
  }
  return ids.sort((a, b) => a - b);
}
```

Add a private method that runs one guarded update and publishes:

```typescript
  /**
   * Sets read_at on the account's rows that match `matchSql` and are still unread: no read_at, and
   * created after the account's cutoff. The cutoff is read inside the same statement, so a Mark All
   * as Read that commits first leaves nothing for this to mark. Publishes one read_one signal per
   * marked row.
   */
  private async markUnreadRowsRead(
    account_id: number,
    matchSql: string,
    matchParams: unknown[]
  ): Promise<number[]> {
    const result: unknown = await this.repositoryReadWrite.query(
      `
      UPDATE account_notification AS n
      SET read_at = NOW()
      WHERE n.account_id = $1
        AND ${matchSql}
        AND n.read_at IS NULL
        AND n.created_at > COALESCE(
          (SELECT a.notifications_last_read_at FROM account AS a WHERE a.id = $1),
          '-infinity'::timestamptz
        )
      RETURNING n.id
      `,
      [account_id, ...matchParams]
    );
    const markedIds = readReturnedIds(result);
    await publishAccountNotificationSignals(
      markedIds.map((notification_id) => ({ kind: 'read_one', account_id, notification_id }))
    );
    return markedIds;
  }
```

`matchSql` is always one of the two fixed strings below, never caller input. Values go only
through `matchParams`. Plan 11's publisher returns without a Redis call for an empty list, and a
Redis failure never throws.

Public methods:

```typescript
  /** `found` is false when no row with this id belongs to the account. */
  async markReadById(
    account_id: number,
    notification_id: number
  ): Promise<{ found: boolean; marked_ids: number[] }> {
    const marked_ids = await this.markUnreadRowsRead(account_id, 'n.id = $2', [notification_id]);
    if (marked_ids.length > 0) {
      return { found: true, marked_ids };
    }
    const found = await this.repositoryReadWrite.existsBy({ id: notification_id, account_id });
    return { found, marked_ids };
  }

  /**
   * Marks the account's rows for one push: the parser writes `payload.itemIdText` and
   * `payload.type` from the same values it sends as push data.
   */
  async markReadByItem(account_id: number, item_id_text: string, type: string): Promise<number[]> {
    return this.markUnreadRowsRead(
      account_id,
      "n.payload->>'itemIdText' = $2 AND n.payload->>'type' = $3",
      [item_id_text, type]
    );
  }
```

The existence check uses the read-write repository so it reads the same database state the update
just saw.

## API

### Controller

In `apps/api/src/controllers/account/accountNotification.ts`:

- Add a private static helper and use it in `getUnreadCount` too, replacing that handler's inline
  account load and count:

```typescript
  /** The account's unread count, or null when the account row is missing. */
  private static async getUnreadCountForAccount(account_id: number): Promise<number | null> {
    const account = await AccountNotificationController.accountService.get(account_id);
    if (!account) {
      return null;
    }
    return AccountNotificationController.accountNotificationService.countUnread(
      account_id,
      account.notifications_last_read_at ?? null
    );
  }
```

  `getUnreadCount` responds 404 `Account not found` when it returns null, and
  `{ data: { unread_count } }` otherwise, as today.

- Add `markReadOne(req, res)` after `markRead`: validate params, authenticate, call
  `markReadById`. 404 `Notification not found` when `found` is false. Otherwise get the count with
  the helper (404 `Account not found` on null) and respond
  `{ data: { marked_ids, unread_count } }`. Wrap the body in `try` / `handleGenericErrorResponse`
  like its siblings.
- Add `markReadByItem(req, res)` after it: validate the body, authenticate, call
  `markReadByItem`, then the count, then the same response.
- Doc comment on `markReadOne`: "Marks one notification read on its own. An already-read row
  succeeds with no ids and sends no event." On `markReadByItem`: "Marks read the notification an OS
  push was about. Push data carries the item id and message type, not the notification id."

### Routes

In `apps/api/src/routes/account.ts`, directly after the `/notifications/mark-read` line:

```typescript
router.post(
  '/notifications/mark-read-by-item',
  asyncHandler(AccountNotificationController.markReadByItem)
);
router.post(
  '/notifications/:notification_id/mark-read',
  asyncHandler(AccountNotificationController.markReadOne)
);
```

Neither collides with plan 12's `GET /events` or the existing routes: one has two
segments, the other three, and the only parameterized account route is `GET /:id_text`.

### OpenAPI

In `apps/api/openapi.yml` (**openapi-sync**), beside `/account/notifications/mark-read`:

- `/account/notifications/{notification_id}/mark-read` `post`:
  `operationId: apiPostAccountNotificationMarkReadOne`, tags `account`, summary
  `POST /account/notifications/{notification_id}/mark-read`, security bearer and cookie. Path
  parameter `notification_id` (integer, minimum 1, required). Description: marks one notification
  read; an already-read notification returns 200 with empty `marked_ids` and sends no stream event;
  another account's id returns 404. Responses: `200`
  (`ApiPostAccountNotificationsMarkReadOneResponse200`, with an example), `400`
  (`ValidationErrorResponse`), `401` (`AuthenticationErrorResponse`), `404`, `500`
  (`InternalServerErrorResponse`).
- `/account/notifications/mark-read-by-item` `post`:
  `operationId: apiPostAccountNotificationsMarkReadByItem`, same tags and security. Request body
  `ApiPostAccountNotificationsMarkReadByItemRequest` (required `item_id_text`, `type`; strings,
  1–64 characters), with an example `{ "item_id_text": "abcdefghi1", "type": "livestream-started" }`.
  Description: marks read the account's unread notifications whose payload matches an OS push's
  `itemIdText` and `type`; no match returns 200 with empty `marked_ids`. Responses: `200` (same
  response schema), `400`, `401`, `500`.
- Component schemas, beside `ApiPostAccountNotificationsMarkReadResponse200`:
  `ApiPostAccountNotificationsMarkReadOneResponse200` (`data` with required `marked_ids`, an
  integer array, and `unread_count`, an integer; example `{ "data": { "marked_ids": [101],
  "unread_count": 3 } }`) and `ApiPostAccountNotificationsMarkReadByItemRequest`.

## Request helpers

In `packages/helpers-requests/src/api/account/notification/notifications.ts`, after
`reqNotificationsMarkRead`:

```typescript
export type ReqNotificationsMarkReadOneResponse = {
  /** Rows this request moved from unread to read; empty when they were already read. */
  marked_ids: number[];
  unread_count: number;
};

export const reqNotificationsMarkReadOne = async (
  api: ApiRequestService,
  notification_id: number
): Promise<ReqNotificationsMarkReadOneResponse> => {
  const response = await api.apiRequest<{ data: ReqNotificationsMarkReadOneResponse }>({
    path: `/account/notifications/${notification_id}/mark-read`,
    method: 'POST',
    config: {
      withCredentials: true,
    },
  });
  return response.data;
};

export const reqNotificationsMarkReadByItem = async (
  api: ApiRequestService,
  params: { item_id_text: string; type: string }
): Promise<ReqNotificationsMarkReadOneResponse> => {
  const response = await api.apiRequest<{ data: ReqNotificationsMarkReadOneResponse }>({
    path: '/account/notifications/mark-read-by-item',
    method: 'POST',
    data: params,
    config: {
      withCredentials: true,
    },
  });
  return response.data;
};
```

`withCredentials: true` matches the file's other helpers. Mobile's bearer transport ignores it.

In `packages/helpers-requests/src/api/_request.ts`, add both functions and the response type to the
existing import from `'./account/notification/notifications.js'` (match how
`ReqNotificationsListResponse` is imported there), and add methods after
`reqNotificationsMarkRead()`:

```typescript
  reqNotificationsMarkReadOne(notification_id: number): Promise<ReqNotificationsMarkReadOneResponse> {
    return reqNotificationsMarkReadOne(this, notification_id);
  }

  reqNotificationsMarkReadByItem(params: {
    item_id_text: string;
    type: string;
  }): Promise<ReqNotificationsMarkReadOneResponse> {
    return reqNotificationsMarkReadByItem(this, params);
  }
```

No client calls these in this plan.

## Must stay true

- Marking is idempotent: a second call for the same row, from any device, marks nothing and
  publishes nothing.
- A row at or before the account's cutoff is never stamped and never reported in `marked_ids`.
- No account can mark, or learn about, another account's notification.
- `POST /account/notifications/mark-read` (Mark All as Read) is unchanged.
- No `as` added outside the existing `validateParamsObject` internals; no `any`.

## Tests

- `packages/orm/src/lib/queryResultRows.test.ts`: a plain row array comes back as is;
  `[rows, 2]` comes back as `rows`; a non-array returns null.
- `packages/orm/src/services/account/accountNotification.test.ts`: add `queryMock` and
  `existsByMock` to the `AppDataSourceReadWrite.getRepository` mock, and
  `publishAccountNotificationSignals: vi.fn()` to plan 11's `vi.mock('./accountNotificationSignal.js', …)`
  factory (hoist it so tests can assert on it).
  - `markReadById` with `queryMock` resolving `[[{ id: 101 }], 1]` returns
    `{ found: true, marked_ids: [101] }`, passes params `[41, 101]`, sends SQL containing
    `read_at IS NULL` and `notifications_last_read_at`, and publishes
    `[{ kind: 'read_one', account_id: 41, notification_id: 101 }]`. `existsByMock` is not called.
  - Already read: `[[], 0]` and `existsByMock` true returns `{ found: true, marked_ids: [] }`, and
    the publisher receives an empty list (or is not called).
  - Missing: `[[], 0]` and `existsByMock` false returns `{ found: false, marked_ids: [] }`.
  - `markReadByItem` with `[[{ id: '8' }, { id: 7 }], 2]` returns `[7, 8]`, passes params
    `[41, 'item123456', 'livestream-started']`, and publishes two `read_one` signals.
- `apps/api/src/test/account-notifications.test.ts`: add
  `accountNotificationMarkReadByIdMock: vi.fn(async () => ({ found: true, marked_ids: [101] }))` and
  `accountNotificationMarkReadByItemMock: vi.fn(async () => [101])` to the hoisted mocks and to
  `MockAccountNotificationService`. With the default account (`notifications_last_read_at: null`),
  `countUnread` returns 25.
  - `POST /account/notifications/101/mark-read` returns 200 with
    `{ marked_ids: [101], unread_count: 25 }` and calls `markReadById` with `(TEST_USER_ID, 101)`.
  - An already-read row (`mockResolvedValueOnce({ found: true, marked_ids: [] })`) returns 200 with
    `marked_ids: []`.
  - `{ found: false, marked_ids: [] }` returns 404.
  - `POST /account/notifications/abc/mark-read` and `/0/mark-read` return 400 and never call
    `markReadById`.
  - `POST /account/notifications/101/mark-read` with no auth headers returns 401 (wrap in
    `withMutedExpectedErrorLogs`).
  - `POST /account/notifications/mark-read-by-item` with
    `{ item_id_text: 'abcdefghi1', type: 'livestream-started' }` returns 200 with
    `{ marked_ids: [101], unread_count: 25 }` and calls `markReadByItem` with
    `(TEST_USER_ID, 'abcdefghi1', 'livestream-started')`.
  - The same route with no `type` returns 400 and never calls `markReadByItem`.
  - A match of `[]` returns 200 with `marked_ids: []`.

## Release scratchpad

```markdown
## Mark one notification read

- Surfaces: api, web, mobile (request helpers in `@podverse/helpers-requests`)
- Change: new `POST /account/notifications/:notification_id/mark-read` and
  `POST /account/notifications/mark-read-by-item` (body `item_id_text`, `type`, as sent in push
  data). Each sets `read_at` on that notification only, returns `{ marked_ids, unread_count }`, and
  sends `notification.read` with `scope: 'one'` to every open notification stream for the account.
  An already-read notification returns 200 with empty `marked_ids` and sends nothing. Another
  account's id returns 404. Mark All as Read is unchanged. New request helpers
  `reqNotificationsMarkReadOne` and `reqNotificationsMarkReadByItem`.
- Who notices: no one until web and mobile call them from push taps, banner taps, and inbox rows.
- Operator steps: none beyond the read-state migration.
```
