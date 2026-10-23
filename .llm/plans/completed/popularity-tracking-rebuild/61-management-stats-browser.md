**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 61 — Management database browser lists popularity tables

Replace the five `stats_aggregated_*` entries in the database-browser allowlist with the five
read-only `stats_popularity_*` tables. Those tables are one row per entity and use a single
integer primary key, which is what `queryEngine.ts` addresses (`WHERE "<primaryKeyField>" = $1`).

The browser lists only those five stats tables:

| Table | Primary key |
| --- | --- |
| `stats_popularity_channel` | `channel_id` |
| `stats_popularity_item` | `item_id` |
| `stats_popularity_clip` | `clip_id` |
| `stats_popularity_playlist` | `playlist_id` |
| `stats_popularity_account` | `account_id` |

Leave daily, event, and taste tables off the list. Their primary keys are composite
(`(<type>_id, day)`, `(created_at, id)`, `(listener_id, channel_id)`), and the browser cannot
address a composite key. Recent days are on the Stats page (plan 60). Taste and event rows are
linked to a listener id; the Stats page and the popularity tables are the operator views of
public counts.

Leave the listener-id mapping table off the list by not mentioning it. `tablePolicy.ts` is an
allowlist (`isTableAllowlisted`), so a table that is absent is hidden. Plan 12's source-guard
test fails if `apps/management-api/src/lib/database/tablePolicy.ts` contains `stats_listener`.
Do not add a comment that names that table. The tests below may name it: plan 12 skips files
ending in `.test.ts`.

`readOnly` is `true` on each of the five, hardcoded. Do not consult
`MGMT_DB_ALLOWED_WRITE_TABLES`. The refresh job owns these counts.

The database index and table browser already render whatever `GET /database/tables` returns,
and they fall back to the raw table name when no label key exists. The stats aggregate tables
have no label keys today. Do not add management-web copy or label maps.

## Rows

R26, R27

## Runs after

10

## Files

- `apps/management-api/src/lib/database/tablePolicy.ts`
- `apps/management-api/src/lib/database/tablePolicy.test.ts`
- `apps/management-api/src/routes/database.integration.test.ts`

## Policy shape

Delete the five objects whose `tableName` is `stats_aggregated_channel`,
`stats_aggregated_item`, `stats_aggregated_clip`, `stats_aggregated_playlist`, and
`stats_aggregated_account`. Put the five popularity objects in that same position, after
`feed_policy_override`. Keep each object written out, matching the surrounding policies. Do not
add a factory.

For each table, `permissionResource` is `'stats'`. `fields`, in order, all
`type: 'integer'`, `nullable: false`, `updatable: false`:

1. the primary-key column named above
2. `day_count`
3. `week_count`
4. `month_count`
5. `all_time_count`

`defaultSortField` is `all_time_count`, `defaultSortDirection` is `'DESC'`. `maxPageSize` 100,
`maxFilters` 10, `maxSorts` 3, `maxInValues` 50. `readOnly: true`.

After the edit, `tablePolicy.ts` contains no `stats_aggregated_` text.

## Tests

In `tablePolicy.test.ts`, one case that for each of the five popularity tables:

- `getTablePolicy` returns a policy with that `primaryKeyField`, `permissionResource` `'stats'`,
  `readOnly` true, and `defaultSortField` `'all_time_count'`
- `fields` is exactly the five names above, every one `updatable: false`
- `isTableAllowlisted` is true and `isTableReadOnly` is true

And one case that `isTableAllowlisted` is false for `stats_aggregated_channel`,
`stats_aggregated_item`, `stats_aggregated_clip`, `stats_aggregated_playlist`,
`stats_aggregated_account`, `stats_daily_channel`, `stats_daily_item`, `stats_daily_clip`,
`stats_daily_playlist`, `stats_daily_account`, `stats_listen_event`, `stats_open_event`,
`stats_taste_profile`, `stats_taste_profile_hidden`, and `stats_listener`.

In `database.integration.test.ts`, the `GET /database/tables` case expects the five
`stats_popularity_*` names and does not expect the five `stats_aggregated_*` names. Also expect
the body not to include `stats_listener`, `stats_daily_channel`, or `stats_taste_profile`.

No management-web spec. The browser page lists the API's table names, and its existing spec
mocks the feed table only. The two tests above are the allowlist contract.

## Release scratchpad

```markdown
## Management database browser lists popularity tables

- Surfaces: management-api, management-web
- Change: the database browser lists five read-only popularity tables, one row per channel,
  item, clip, playlist, and profile, with day, week, month, and all-time counts, in place of
  the rolling aggregate tables. Listener-linked stats tables stay off the browser.
- Who notices: operators using the database browser
- Operator steps: none
```
