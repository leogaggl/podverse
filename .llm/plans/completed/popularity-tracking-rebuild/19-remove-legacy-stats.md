**Cursor model:** Opus 5.5 · **Reasoning:** high

# 19 — Remove the legacy stats tables, entities, services, and DTOs

Drop the old per-entity event tables, the rotating guid mapping, and the 17-column aggregate
tables with all their data (R48), and delete the ORM entities, services, tests, and DTOs built on
them. This runs last among the stats plans: every caller in the write path, jobs, public readers,
channel merge, and management has already moved to the new tables.

This plan moves no callers. If a caller is left, it stops and reports.

## Rows

R48

## Runs after

10, 11, 32, 42, 43, 50, 51, 60, 61, 83. Those are every plan that moves a caller off the old
stats code: the API write path (32), the workers jobs and dev seed (42, 43), the public readers
and channel merge (50, 51), management (60, 61), and the old request helpers (83). No area G plan
touches the old code.

## Files

- `infra/k8s/base/ops/source/database/linear-migrations/app/NNNN_drop_legacy_stats.sql` (new; next free app number, after plan 10's migration)
- `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` (regenerated)
- `infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz` (regenerated)
- `infra/k8s/base/api/source/api.env` (`API_EXPECTED_MIGRATION_FILENAME` only)
- `infra/k8s/base/ops/kustomization.yaml` (`podverse-ops-migration-scripts`: the `API_EXPECTED_MIGRATION_FILENAME` literal and the app migration `files` entry only)
- `packages/orm/src/entities/stats/statsAggregatedAccount.ts` (delete)
- `packages/orm/src/entities/stats/statsAggregatedChannel.ts` (delete)
- `packages/orm/src/entities/stats/statsAggregatedClip.ts` (delete)
- `packages/orm/src/entities/stats/statsAggregatedItem.ts` (delete)
- `packages/orm/src/entities/stats/statsAggregatedPlaylist.ts` (delete)
- `packages/orm/src/entities/stats/statsTrackAccountGuid.ts` (delete)
- `packages/orm/src/entities/stats/statsTrackEventAccount.ts` (delete)
- `packages/orm/src/entities/stats/statsTrackEventChannel.ts` (delete)
- `packages/orm/src/entities/stats/statsTrackEventClip.ts` (delete)
- `packages/orm/src/entities/stats/statsTrackEventItem.ts` (delete)
- `packages/orm/src/entities/stats/statsTrackEventPlaylist.ts` (delete)
- `packages/orm/src/services/stats/baseStatsAggregated.ts` (delete)
- `packages/orm/src/services/stats/baseStatsTrackEvent.ts` (delete)
- `packages/orm/src/services/stats/baseStatsTrackEvent.create.test.ts` (delete)
- `packages/orm/src/services/stats/baseStatsTrackEvent.sourceGuard.test.ts` (delete)
- `packages/orm/src/services/stats/statsAggregatedAccount.ts` (delete)
- `packages/orm/src/services/stats/statsAggregatedChannel.ts` (delete)
- `packages/orm/src/services/stats/statsAggregatedClip.ts` (delete)
- `packages/orm/src/services/stats/statsAggregatedItem.ts` (delete)
- `packages/orm/src/services/stats/statsAggregatedPlaylist.ts` (delete)
- `packages/orm/src/services/stats/statsTrackAccountGuid.ts` (delete)
- `packages/orm/src/services/stats/statsTrackAccountGuid.test.ts` (delete)
- `packages/orm/src/services/stats/statsTrackEventAccount.ts` (delete)
- `packages/orm/src/services/stats/statsTrackEventChannel.ts` (delete)
- `packages/orm/src/services/stats/statsTrackEventClip.ts` (delete)
- `packages/orm/src/services/stats/statsTrackEventItem.ts` (delete)
- `packages/orm/src/services/stats/statsTrackEventPlaylist.ts` (delete)
- `packages/orm/src/services/stats/statsTrackEventServices.subtype.test.ts` (delete)
- `packages/orm/src/db/entities.ts`
- `packages/orm/src/index.ts`
- `packages/helpers/src/dtos/stats/statsAggregatedAccount.ts` (delete)
- `packages/helpers/src/dtos/stats/statsAggregatedChannel.ts` (delete)
- `packages/helpers/src/dtos/stats/statsAggregatedClip.ts` (delete)
- `packages/helpers/src/dtos/stats/statsAggregatedItem.ts` (delete)
- `packages/helpers/src/dtos/stats/statsAggregatedPlaylist.ts` (delete)
- `packages/helpers/src/dtos/stats/statsTrackAccountGuid.ts` (delete)
- `packages/helpers/src/dtos/stats/statsTrackEventAccount.ts` (delete)
- `packages/helpers/src/dtos/stats/statsTrackEventChannel.ts` (delete)
- `packages/helpers/src/dtos/stats/statsTrackEventClip.ts` (delete)
- `packages/helpers/src/dtos/stats/statsTrackEventItem.ts` (delete)
- `packages/helpers/src/dtos/stats/statsTrackEventPlaylist.ts` (delete)
- `packages/helpers/src/dtos/index.ts`
- `packages/helpers/src/lib/statsAggregatedCountField.ts` (delete when unreferenced)
- `packages/helpers/src/lib/simulatedAggregatedStats.ts` (delete when unreferenced)
- `packages/helpers/src/lib/simulatedAggregatedStats.test.ts` (delete with it)
- `packages/helpers/src/index.ts`
- `apps/api/src/test/stats-guid-rotation.integration.test.ts` (delete when still present)
- `apps/api/src/test/stats-foundation-schema.integration.test.ts`

## Step 1 — confirm nothing still uses the old code

Search the tree, excluding `node_modules`, `dist`, `.llm/`, `docs/proposals/`,
`tools/qa/docs/faker/`, `tools/web-perf/bundle-analyzer/reports/`, and the SQL migrations
`0001_app_schema.sql`, `0007_popularity_tracking_consent.sql`, `0009_list_sort_indexes.sql`:

```text
\bStatsAggregated(Account|Channel|Clip|Item|Playlist)(Service)?\b|\bStatsTrackEvent(Account|Channel|Clip|Item|Playlist)(Service)?\b|\bStatsTrackAccountGuid(Service)?\b|\bDTOStats(Aggregated|Track)|\bBaseStats(Aggregated|TrackEvent)Service\b|STATS_AGGREGATED_SELECT_ALL|\bstats_aggregated_(account|channel|clip|item|playlist)\b|\bstats_track_event_(account|channel|clip|item|playlist)\b|\bstats_track_account_guid\b
```

The search is case-sensitive. It does not match `STATS_TRACK_EVENT_RETENTION_DAYS` (the retention
setting) or the two helpers libs below, which have their own check.

Every hit must be in a file this plan deletes, in `packages/orm/src/db/entities.ts`,
`packages/orm/src/index.ts`, or `packages/helpers/src/dtos/index.ts`. Any other hit — for example
the channel merge journal table list, a management route, an API test mock class, a worker
command, or the management OpenAPI — means an earlier plan left a caller. Stop, change nothing,
and report BLOCKED with the `path:line` list.

`statsAggregatedCountField.ts` and `simulatedAggregatedStats.ts` are deleted only when the same
search for their exported names (`StatsAggregatedRangeCountField`, `STATS_AGGREGATED_RANGE_COUNT_FIELDS`,
`SimulatedAggregatedCounts`, and the other exports in each file) finds nothing outside the file,
its test, and `packages/helpers/src/index.ts`. When one is still referenced, keep it and its
export line, and name the callers in your final message; that is not a blocker.

## Step 2 — migration

`NNNN_drop_legacy_stats.sql`, greenfield-only. One header sentence: the popularity tracking
tables replace these, and their data is not kept. Drop in this order, plain `DROP TABLE` (owned
sequences go with their tables):

1. `stats_track_event_account`, `stats_track_event_channel`, `stats_track_event_clip`,
   `stats_track_event_item`, `stats_track_event_playlist`
1. `stats_track_account_guid`
1. `stats_aggregated_account`, `stats_aggregated_channel`, `stats_aggregated_clip`,
   `stats_aggregated_item`, `stats_aggregated_playlist`

After the drops, per **linear-baseline-0004** and **migration-readiness-marker-sync**: run
`make db_regen_linear_baseline` and `make db_verify_linear_baseline` (artifact generation, which
agents run), leave both gz files in the tree, and set `API_EXPECTED_MIGRATION_FILENAME` to this
file in `api.env` and in the `podverse-ops-migration-scripts` literals of
`infra/k8s/base/ops/kustomization.yaml`, where you also add this file after the last app entry in
`files`. When the regen cannot run, stop and report; never hand edit the gz files.

## Step 3 — delete the code

- Delete the files listed above.
- `packages/orm/src/db/entities.ts`: remove the eleven old imports and array entries.
- `packages/orm/src/index.ts`: remove the eleven `./entities/stats/statsAggregated*` /
  `statsTrack*` exports and the eleven matching `./services/stats/…` exports.
- `packages/helpers/src/dtos/index.ts`: remove the eleven `./stats/…` export lines.
- `packages/helpers/src/index.ts`: remove the export lines of any helpers lib deleted in step 1.
- When `packages/helpers/src/dtos/stats/` or `packages/orm/src/services/stats/` would be empty,
  leave nothing behind; the new stats entities keep `packages/orm/src/entities/stats/`.

## Tests

- Add one case to `apps/api/src/test/stats-foundation-schema.integration.test.ts`: each of the
  eleven old table names resolves to `NULL` through `to_regclass('public.<name>')`.
- Deleted with their code: the four old ORM stats tests, `simulatedAggregatedStats.test.ts` when
  its file goes, and `stats-guid-rotation.integration.test.ts`.

## Release scratchpad

```markdown
## Old stats tables and their data are dropped

- Surfaces: api, workers, management-api, ops (app database)
- Change: a migration drops the old per-entity stats event tables, the rotating stats guid
  mapping, and the rolling aggregate count tables, with all their rows. Popularity counts start
  from zero in the new daily totals; nothing is imported from v4.
- Who notices: operators and alpha testers; Top and trending sorts are empty until new listens
  are counted
- Operator steps: run the linear migrations; `API_EXPECTED_MIGRATION_FILENAME` advances
```
