**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 60 — Management stats page reads range totals and a daily series

The management Stats page and its three read routes rank channels, items, clips, playlists,
and profiles from `stats_popularity_*`, and the row detail chart plots `listener_count` from
`stats_daily_*`. Range names match the public sorts: day, week, month, all-time. The counts
are the listener totals the range job stores (`docs/features/POPULARITY-TRACKING.md`, plan 10
§ "Range totals are rebuilt by a job" and § "Daily totals are filled at write time").

Reuse `STATS_POPULARITY_COUNT_FIELDS` and `STATS_POPULARITY_RANGE_LOOKBACK_DAYS` from
`@podverse/helpers` (plan 11). Do not edit that package, `docs/features/POPULARITY-TRACKING.md`,
or any public-API reader. Do not query listener-linked tables. The route file must not contain
the text `stats_aggregated_` or `stats_listener`; plan 19's leftover-caller search treats the
first as a caller that was not moved.

`apps/management-web/src/lib/requests/stats.ts` re-exports the request client. Leave it.

## Rows

R26, R27

## Runs after

11

## Files

- `apps/management-api/src/routes/stats.ts`
- `apps/management-api/src/lib/stats/dailyListenerSeries.ts` (new)
- `apps/management-api/src/lib/stats/dailyListenerSeries.test.ts` (new)
- `apps/management-api/src/routes/stats.integration.test.ts`
- `apps/management-api/openapi.yml` (anchors: parameter `StatsRangeQueryOptional`; schemas `StatsAggregatedRow`, `StatsAggregatedRowWithRange`, `ManagementGetStatsEntitytypeIdResponse200`, `ManagementGetStatsEntitytypeSearchResponse200`, `ManagementGetStatsEntitytypeTopResponse200`. Search those names. Do not read the whole file.)
- `packages/management-api-requests/src/stats.ts`
- `apps/management-web/src/app/(management)/stats/StatsPageClient.tsx`
- `apps/management-web/e2e/stats-page.spec.ts`
- `packages/ui/src/components/stats/StatsBarChart/StatsBarChart.tsx`
- `packages/i18n-catalog/management/originals/en-US.json` (key `statsPage` only)
- `packages/i18n-catalog/management/originals/es.json` (same key)
- `packages/i18n-catalog/management/originals/fr.json` (same key)
- `packages/i18n-catalog/management/originals/el-GR.json` (same key)

## Behavior

### Ranges

`range` accepts `day`, `week`, `month`, and `all-time`. The default is `all-time`. Any other
value, including `7day`, `30day`, and `1year`, is 400 from Joi on the list and search routes.
There is no year column on `stats_popularity_*`.

The selected count column is `STATS_POPULARITY_COUNT_FIELDS[range]` (`day_count`, `week_count`,
`month_count`, `all_time_count`). Look the column up from that map after Joi accepts the value.
Never interpolate `req.query.range` into SQL.

A window of N days is `day >= (UTC today - N)`, from
`STATS_POPULARITY_RANGE_LOOKBACK_DAYS` (day 1, week 7, month 30). Those totals are whatever the
refresh job last wrote. This plan does not recompute them.

### Routes

Keep `GET /:entityType/top`, `GET /:entityType/search`, and `GET /:entityType/:id`,
`ensureAuthenticated`, and `requireCrud('stats', 'read')`. Entity types stay `channel`, `item`,
`clip`, `playlist`, `account`. Replace the `as EntityType` check with a type predicate over that
list.

`id` in the path and in every JSON row is the entity id (`channel_id`, `item_id`, `clip_id`,
`playlist_id`, or `account_id`). Popularity tables have no separate row id.

Use `AppDbDataSourceRead`. Table names are `` `stats_popularity_${entityType}` `` and
`` `stats_daily_${entityType}` `` only after the entity type has been narrowed. Alias the
popularity table `sa`.

Title joins:

| Entity | Foreign key | Title expression | Join |
| --- | --- | --- | --- |
| channel | `channel_id` | `c.title` | `LEFT JOIN channel c ON c.id = sa.channel_id` |
| item | `item_id` | `i.title` | `LEFT JOIN item i ON i.id = sa.item_id` |
| clip | `clip_id` | `cl.title` | `LEFT JOIN clip cl ON cl.id = sa.clip_id` |
| playlist | `playlist_id` | `p.title` | `LEFT JOIN playlist p ON p.id = sa.playlist_id` |
| account | `account_id` | `ap.display_name` | `LEFT JOIN account_profile ap ON ap.account_id = sa.account_id` |

Account rows are profiles that were opened. The foreign key column is `account_id`.

Top and search select, with `::int` on every count so node-pg returns numbers:

```sql
sa.<fk>::int AS id,
<title> AS title,
sa.day_count::int AS day_count,
sa.week_count::int AS week_count,
sa.month_count::int AS month_count,
sa.all_time_count::int AS all_time_count,
sa.<count_field>::int AS range_count
```

`ORDER BY sa.<count_field> DESC, sa.<fk> ASC`. Top's count query is
`SELECT COUNT(*)::int AS total FROM stats_popularity_<type> sa` with no join. Search adds
`WHERE <title> ILIKE $1` with a `%q%` pattern on both the row query and its count query, and
keeps today's query order: rows, then count. Top keeps today's order: count, then rows.
Pagination (`limit` 1–100 default 25, `page` default 1, offset `(page - 1) * limit`) stays.

The response stays `{ rows, total, page, pageSize }`. Each row is `id`, `title` (string or
null), `day_count`, `week_count`, `month_count`, `all_time_count`, `range_count`.

Detail loads the popularity row with the same select list except `range_count`,
`WHERE sa.<fk> = $1`. No row is 404 `{ message: 'Stats record not found' }`. Then load:

```sql
SELECT day::text AS day, listener_count::int AS listener_count
FROM stats_daily_<type>
WHERE <fk> = $1 AND day >= $2::date
ORDER BY day ASC
```

`$2` is the UTC date string `lookback` days before today, where `lookback` is
`STATS_POPULARITY_RANGE_LOOKBACK_DAYS.month`. Pass the string computed in JavaScript. Do not
use `CURRENT_DATE`. `day::text` keeps the calendar date off the session time zone.

Build the `daily` array with `buildDailyListenerSeries`. The detail JSON is `id`, `title`,
the four counts, and `daily`. It has no `range_count`.

Read query values without `as`. A count is a finite number. `title` is a string or null.
`day` matches `/^\d{4}-\d{2}-\d{2}/` (a `timestamptz` cast to text may include a time; use the
first 10 characters). Anything else throws, and the existing catch returns 500. Put that
reading next to the series helper.

A short comment at the top of the route: these routes read popularity range totals and the
daily listener series; the window lengths live in `@podverse/helpers`; the storage rules are
in `docs/features/POPULARITY-TRACKING.md`.

### Daily series helper

`apps/management-api/src/lib/stats/dailyListenerSeries.ts`:

```typescript
export type DailyListenerPoint = { day: string; listener_count: number };

export function utcTodayDateString(now?: Date): string;

export function buildDailyListenerSeries(
  rows: readonly { day: string; listener_count: number }[],
  todayUtc: string,
  lookbackDays: number
): DailyListenerPoint[];
```

`utcTodayDateString` returns `now.toISOString().slice(0, 10)` (`now` defaults to `new Date()`).
`buildDailyListenerSeries` returns `lookbackDays + 1` points. Index 0 is `todayUtc` minus
`lookbackDays` days. The last point is `todayUtc`. Missing days are `listener_count: 0`. A row
whose `day` is outside the window is ignored. Two rows on one day: the later array entry wins.
Add and subtract days with `Date.UTC` and `setUTCDate`, then `toISOString().slice(0, 10)`.

The chart can disagree with `month_count` until the refresh job runs. Do not make the series
sum equal the stored month total.

### OpenAPI

In `StatsRangeQueryOptional`, the enum is `day`, `week`, `month`, `all-time`. Description: the
popularity window used to order the list. Default remains all-time when the query omits `range`.

Replace schemas `StatsAggregatedRow` and `StatsAggregatedRowWithRange` with:

- `StatsPopularityRow` — required `id`, `day_count`, `week_count`, `month_count`,
  `all_time_count`. `title` is a nullable string. `id` is the entity id. No per-type foreign-key
  properties and no rolling count properties.
- `StatsPopularityListRow` — `allOf` `StatsPopularityRow` plus required `range_count`.
- `StatsDailyListenerPoint` — required `day` (string, format date) and `listener_count`.

`ManagementGetStatsEntitytypeIdResponse200` is `allOf` `StatsPopularityRow` plus required
`daily` (array of `StatsDailyListenerPoint`). Search and top keep `StatsPaginationMeta` and
point `rows.items` at `StatsPopularityListRow`.

On path parameter `id` for `GET /stats/{entity_type}/{id}`, set the description to the entity
id. Leave `operationId`s and the auth responses as they are.

### Request client

In `packages/management-api-requests/src/stats.ts`, `StatsRange` is
`StatsPopularityRange` from `@podverse/helpers` (type-only import, re-exported under the name
`StatsRange`). `EntityType` stays the five-type union.

```typescript
export type StatsDailyPoint = { day: string; listener_count: number };

export type StatsCounts = {
  id: number;
  title: string | null;
  day_count: number;
  week_count: number;
  month_count: number;
  all_time_count: number;
};

export type StatsRow = StatsCounts & { range_count: number };

export type StatsDetail = StatsCounts & { daily: StatsDailyPoint[] };
```

`reqStatsDetail` returns `StatsDetail`. `reqStatsTop` and `reqStatsSearch` are unchanged aside
from the new `StatsRange` and `StatsRow`.

After the edit, from the repo root, build the package so management-web resolves `dist`:

```bash
npm run build -w @podverse/management-api-requests
```

Build `@podverse/helpers` first only when its `dist` does not yet export `StatsPopularityRange`.

### Stats page

`StatsPageClient.tsx` keeps the entity tabs, the table columns (rank, title, the selected
range, all-time), client sort of the loaded page, search, pagination, and the top-10 chart.
`RANGES` is `day`, `week`, `month`, `all-time`. `parseRangeParam` returns `all-time` for every
other value, including a bookmarked `7day`, `30day`, or `1year`.

The detail overview is four `StatSummaryGrid` items, in order: `ranges.day`, `ranges.week`,
`ranges.month`, `ranges.allTime`, bound to `day_count`, `week_count`, `month_count`,
`all_time_count`.

One detail chart, under the existing `detail.dailyBreakdown` heading. Its data is `daily`
mapped to `{ label: day, value: listener_count }` in the helper's order (oldest at the left).
Pass `xTickInterval="preserveStartEnd"`. The top-10 chart does not pass `xTickInterval`.
Remove the second chart.

`packages/ui/src/components/stats/StatsBarChart/StatsBarChart.tsx` is the only caller of this
chart. Add optional `xTickInterval` (`number | 'preserveStartEnd' | 'equidistantPreserveStart'`),
default `0`, and pass it to the recharts `XAxis` `interval`. Export stays as it is. No new copy
inside `@podverse/ui`.

The value label stays `statsPage.views` (`Views`). The page shows listener counts only.
`completion_count` is not selected and not displayed.

### Catalog

Edit only the `statsPage` object in the four management originals. Do not edit `overrides/` or
anything under `compiled/`. Then run `npm run i18n:compile` from the repo root. Compiled output
is gitignored.

`ranges` becomes:

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| day | Day | Día | Jour | Ημέρα |
| week | Week | Semana | Semaine | Εβδομάδα |
| month | Month | Mes | Mois | Μήνας |
| allTime | All-time | Todo el tiempo | Depuis toujours | Συνολικά |

`detail` keeps only `dailyBreakdown`: en-US `Daily Breakdown`, es `Desglose diario`, fr
`Répartition quotidienne`, el-GR `Ημερήσια ανάλυση`. Remove `ranges.day7`, `ranges.day30`,
`ranges.year1`, `detail.dayToday`, `detail.dayN`, `detail.weekCurrent`, `detail.weekN`,
`detail.monthCurrent`, and `detail.weeklyBreakdown` from all four locales. Leave every other
`statsPage` string, including `views` and `table.rangeViews`.

## Tests

- `dailyListenerSeries.test.ts`: a lookback of 2 from `2026-10-21` returns
  `2026-10-19`, `2026-10-20`, `2026-10-21`; a row on `2026-10-20` fills that point and the
  other two are 0; a row on `2026-01-01` is ignored; two rows on `2026-10-21` use the later
  count. `utcTodayDateString(new Date('2026-10-21T00:00:00.000Z'))` is `2026-10-21`, and
  `utcTodayDateString(new Date('2026-10-20T23:59:59.999Z'))` is `2026-10-20`.
- `stats.integration.test.ts`: keep the 401, 403, invalid-entity, and invalid-id cases.
  `range=7day`, `range=30day`, and `range=1year` on top return 400. `range=week` on top returns
  200, and the row-query SQL includes `stats_popularity_channel` and `week_count` and does not
  include `stats_aggregated` or `day_current_count`. Detail with an empty daily result returns
  `daily` of length `STATS_POPULARITY_RANGE_LOOKBACK_DAYS.month + 1`, all zeros, plus the
  popularity counts from the first query. Detail still returns 404 when the popularity query is
  empty. Account search SQL includes `stats_popularity_account`, `account_profile`, and
  `account_id`, and does not include `tracked_account_id`.
- `stats-page.spec.ts`: extend the existing superuser test (keep its login and the Items tab).
  Mock detail as the list row's counts plus `daily: [{ day: '2026-10-20', listener_count: 1 }, { day: '2026-10-21', listener_count: 2 }]`, and omit the rolling count fields from both mocks.
  After the row opens, the heading `Daily Breakdown` is visible and `Weekly breakdown` is not.
  Click the `Week` button and assert, from `new URL(page.url())`, `entity=item` and
  `range=week`. Assert the following top request's URL contains `range=week`. Keep the Close
  assertions and both `capturePageLoad` calls. Do not raise the timeout.

`page.test.tsx` needs no edit. No new Playwright spec: this spec already covers the page, and
the range contract is the assertion above.

## Release scratchpad

```markdown
## Management stats read range totals and daily listener counts

- Surfaces: management-api, management-web
- Change: the Stats page ranks channels, items, clips, playlists, and profiles by Day, Week,
  Month, and All-time counts from the popularity tables. Opening a row shows those four counts
  and a chart of each UTC day's listener count across the month window. The 7-day, 30-day, and
  1-year tabs and the rolling day and week charts are gone.
- Who notices: operators using the management Stats page
- Operator steps: none
```
