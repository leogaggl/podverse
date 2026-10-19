# 05 — API, OpenAPI, seed fixture

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

Signed-in users can read their Removed Content rows. One seed row lets 06 and 07 render the
same fixture. Decisions: 00-SUMMARY 9 and 12.

Depends on 01 and 04. Do not edit catalogs, web UI, or mobile UI.

## Route

`GET /account/content-log` on `apps/api/src/routes/account.ts`, next to the notifications
routes. Controller under `apps/api/src/controllers/account/`. Use `ensureAuthenticated` and
`getAuthenticatedUser`, the same way `accountNotificationChannelType.ts` does.

Query `type` is required.

- Missing or unknown `type`: 400, a short English structural message.
- `type=removed_content`: 200 `{ rows: DTOAccountContentLog[] }`.
- No token: the same 401 the other account routes return.

`rows` is that account only, `log_type = removed_content`, `updated_at DESC`, `id DESC`,
limit `ACCOUNT_CONTENT_LOG_MAX_ROWS` (100). Map `id` with `String(id)`. `updated_at` is ISO
8601. Do not return `account_id`, `created_at`, or another account's rows.

Read through the ORM service from 04. Add a list method there rather than a query in the
controller:

```ts
export async function listAccountContentLogs(
  accountId: number,
  logType: 'removed_content'
): Promise<DTOAccountContentLog[]>;
```

## OpenAPI

Add the path to `apps/api/openapi.yml` beside the account notification paths. Document the
query, 200, 400, and 401. The row schema matches `DTOAccountContentLog`.

## Client

`packages/helpers-requests`: a function next to the account notification request helper.
Find that helper and follow its `path` / `method` shape. Return the `rows` array. Do not
call `fetch` directly.

## Integration test

`apps/api` integration test, same harness as the account notification tests.

- No token: 401.
- `type` omitted: 400.
- Two rows for the signed-in account, one for someone else, plus a row with a future
  `log_type` if the check constraint allows only `removed_content` (it does, so insert only
  `removed_content`). The response is the signed-in account's rows, newest first, without
  `account_id`.
- Insert the rows with SQL or the service. Do not depend on archiveAll.

## Seed fixture

One row so web and mobile E2E can open the screen without running workers.

In `tools/web/seed-e2e.mjs`, after accounts and channels exist, insert one
`account_content_log` row:

- the existing signed-in E2E account
- `log_type` `removed_content`
- a channel `id_text` and title already in the seed (a show that account follows is fine;
  the screen does not navigate to it)
- `reason` `left_directory`
- `follow_outcome` `ended`
- `clip_count` 0, `playlist_entry_count` 0
- `updated_at` recent

Put the id text and the expected title in both seed-constant files the web and mobile E2E
suites already import (`apps/web/e2e/helpers/seedConstants.ts` and
`apps/mobile/src/lib/e2e/e2eSeedConstants.ts`). Follow the names already in those files.
`ON CONFLICT DO NOTHING` is acceptable here because seed re-runs; the migration itself stays
greenfield.

Do not add a second spec in this prompt. 06 and 07 own the UI specs.

## Scratchpad

```markdown
## Removed Content log API

- Surfaces: api, helpers-requests, e2e seed
- Change: GET /account/content-log?type=removed_content returns the signed-in account's rows,
  newest first, at most 100. The E2E seed includes one left_directory row.
- Who notices: signed-in clients. The screens that call it ship in later prompts.
- Operator steps: none beyond the migration from 01
```

## Done when

- Another account's row is never in the response.
- `id` is a string.
- Comments do not cite a plan or a step number.

## Operator verification

**Root.** API tests need Postgres 5732 and Valkey 6679 (`make test_deps`).

```bash
npm run build:packages
npm run build -w apps/api
make test_deps
npm run test -w apps/api
```
